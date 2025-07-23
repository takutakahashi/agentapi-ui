import { pushNotificationSettings } from '../lib/pushNotificationSettings';

// Runtime configurationからVAPIDキーを取得（Next.js推奨方式）
let vapidKeyCache: string | null = null;
let vapidKeyPromise: Promise<string | null> | null = null;

async function fetchVAPIDKey(): Promise<string | null> {
  if (vapidKeyCache !== null) {
    return vapidKeyCache;
  }

  if (vapidKeyPromise) {
    return vapidKeyPromise;
  }

  vapidKeyPromise = (async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        const key = config.vapidPublicKey;
        
        // VAPIDキーの形式検証（Base64URL）
        if (key && /^[A-Za-z0-9_-]+$/.test(key)) {
          vapidKeyCache = key;
          return key;
        }
        console.error('Invalid VAPID_PUBLIC_KEY format from API');
      }
    } catch (error) {
      console.error('Failed to fetch VAPID key:', error);
    }
    
    // フォールバック: ビルド時環境変数
    const fallbackKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (fallbackKey) {
      vapidKeyCache = fallbackKey;
      return fallbackKey;
    }
    
    vapidKeyCache = null;
    return null;
  })();

  return vapidKeyPromise;
}

const getVAPIDKey = () => fetchVAPIDKey();

export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  async initialize(): Promise<boolean> {
    const vapidKey = await getVAPIDKey();
    if (!vapidKey) {
      console.error('VAPID公開キーが設定されていません');
      return false;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('プッシュ通知はサポートされていません');
      return false;
    }

    // 認証状態をチェック
    const isAuthenticated = await this.checkAuthenticationStatus();
    if (!isAuthenticated) {
      console.warn('プッシュ通知を利用するにはログインが必要です');
      return false;
    }

    try {
      // プッシュ通知用のService Workerを登録
      const pushSWRegistration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/'
      });
      console.log('プッシュ通知用Service Worker登録成功:', pushSWRegistration);
      
      // プッシュ通知用のService Workerを使用
      this.registration = pushSWRegistration;
      await this.registration.update();
      
      return true;
    } catch (error) {
      console.error('Service Worker登録失敗:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('通知許可が拒否されました');
      return false;
    }
    return true;
  }

  async subscribe(): Promise<boolean> {
    const vapidKey = await getVAPIDKey();
    if (!vapidKey) {
      console.error('VAPID公開キーが設定されていません');
      return false;
    }

    if (!this.registration) {
      console.error('Service Workerが登録されていません');
      return false;
    }

    try {
      // 既存のサブスクリプションを確認
      this.subscription = await this.registration.pushManager.getSubscription();
      
      if (this.subscription) {
        // 既存のsubscriptionがサーバーに登録されているか確認
        const isValid = await this.validateExistingSubscription(this.subscription);
        if (isValid) {
          console.log('既存のサブスクリプションを使用します:', this.subscription.endpoint);
          pushNotificationSettings.setEndpoint(this.subscription.endpoint);
          return true;
        } else {
          // 無効な場合は削除して新規作成
          await this.subscription.unsubscribe();
          console.log('無効なサブスクリプションを削除しました');
        }
      }

      // 新しいサブスクリプションを作成
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
      });

      // サーバーにサブスクリプションを送信
      await this.sendSubscriptionToServer(this.subscription);
      console.log('プッシュサブスクリプション作成成功:', this.subscription);
      return true;
    } catch (error) {
      console.error('プッシュサブスクリプション作成失敗:', error);
      return false;
    }
  }

  // 既存subscriptionの有効性をサーバーで確認
  private async validateExistingSubscription(subscription: PushSubscription): Promise<boolean> {
    try {
      const response = await fetch('/api/subscriptions/cleanup');
      if (!response.ok) return false;
      
      const data = await response.json();
      const subscriptions = data.subscriptions || [];
      
      // endpointが一致し、failureCountが低いsubscriptionが存在するかチェック
      const existing = subscriptions.find((sub: any) => 
        sub.endpoint.includes(subscription.endpoint.substring(-50)) && 
        (sub.failureCount || 0) < 3
      );
      
      return !!existing;
    } catch (error) {
      console.warn('Subscription validation failed:', error);
      return false; // エラー時は新規作成
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      console.warn('アクティブなサブスクリプションがありません');
      return false;
    }

    try {
      await this.subscription.unsubscribe();
      await this.removeSubscriptionFromServer(this.subscription);
      this.subscription = null;
      console.log('プッシュサブスクリプション削除成功');
      return true;
    } catch (error) {
      console.error('プッシュサブスクリプション削除失敗:', error);
      return false;
    }
  }

  async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    // ユーザー情報を含めたサブスクリプションデータを送信
    const subscriptionData = {
      ...subscription.toJSON(),
      // ユーザー情報はサーバー側で自動取得されるため、クライアントからは送信しない
      // 必要に応じて明示的に送信したい場合は以下を有効化
      // userId: 'user-id',
      // userType: 'github' | 'api_key',
      // userName: 'user-name'
    };

    const response = await fetch('/api/proxy/notification/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionData),
    });

    if (!response.ok) {
      throw new Error('サブスクリプション送信に失敗しました');
    }

    const result = await response.json();
    console.log('サブスクリプション送信結果:', result);

    // 成功時に設定を更新
    pushNotificationSettings.setEndpoint(subscription.endpoint);
  }

  async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    const response = await fetch('/api/proxy/notification/subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    if (!response.ok) {
      throw new Error('サブスクリプション削除に失敗しました');
    }
  }

  // testNotification機能はagentapi-proxyのhelperコマンドに移行
  // クライアント側からの直接送信は不要

  getSubscriptionStatus(): { isSubscribed: boolean; endpoint?: string } {
    return {
      isSubscribed: !!this.subscription,
      endpoint: this.subscription?.endpoint
    };
  }

  // ワンクリック有効化機能
  async enableOneClick(): Promise<{ success: boolean; message: string }> {
    const vapidKey = await getVAPIDKey();
    if (!vapidKey) {
      return { success: false, message: 'VAPID公開キーが設定されていません。環境変数を確認してください。' };
    }

    // 認証状態をチェック
    const isAuthenticated = await this.checkAuthenticationStatus();
    if (!isAuthenticated) {
      return { success: false, message: 'プッシュ通知を利用するにはログインが必要です' };
    }

    try {
      // 1. Service Worker初期化
      const initialized = await this.initialize();
      if (!initialized) {
        return { success: false, message: 'Service Workerの初期化に失敗しました' };
      }

      // 2. 通知許可取得
      const permissionGranted = await this.requestPermission();
      if (!permissionGranted) {
        return { success: false, message: '通知許可が拒否されました' };
      }

      // 3. サブスクリプション作成
      const subscribed = await this.subscribe();
      if (!subscribed) {
        return { success: false, message: 'サブスクリプションの作成に失敗しました' };
      }

      // 4. 設定を永続化
      pushNotificationSettings.setEnabled(true);
      pushNotificationSettings.setEndpoint(this.subscription?.endpoint);

      // 5. テスト通知送信（設定で有効な場合）
      if (pushNotificationSettings.shouldShowTestNotifications()) {
        try {
          // ローカル通知でテスト（サーバー送信は不要）
          await this.sendLocalNotification('✅ プッシュ通知が有効になりました', 'AgentAPIからの通知を受け取れるようになりました');
        } catch (error) {
          console.warn('テスト通知の送信に失敗:', error);
        }
      }

      return { success: true, message: 'プッシュ通知が正常に有効化されました' };
    } catch (error) {
      console.error('ワンクリック有効化エラー:', error);
      return { success: false, message: `有効化に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` };
    }
  }

  // ワンクリック無効化機能
  async disableOneClick(): Promise<{ success: boolean; message: string }> {
    try {
      const unsubscribed = await this.unsubscribe();
      if (unsubscribed) {
        pushNotificationSettings.setEnabled(false);
        pushNotificationSettings.setEndpoint(undefined);
        return { success: true, message: 'プッシュ通知が無効化されました' };
      } else {
        return { success: false, message: 'サブスクリプションの削除に失敗しました' };
      }
    } catch (error) {
      console.error('ワンクリック無効化エラー:', error);
      return { success: false, message: `無効化に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` };
    }
  }

  // 自動初期化（ページロード時に呼び出し）
  async autoInitialize(): Promise<boolean> {
    const vapidKey = await getVAPIDKey();
    if (!vapidKey) {
      console.warn('VAPID公開キーが設定されていないため、自動初期化をスキップします');
      return false;
    }

    // 明示的に有効化されている場合のみ自動購読
    if (!pushNotificationSettings.isEnabled()) {
      console.log('プッシュ通知が無効のため、自動初期化をスキップします');
      return false;
    }

    // 認証状態をチェック
    const isAuthenticated = await this.checkAuthenticationStatus();
    if (!isAuthenticated) {
      console.warn('未ログインのため、プッシュ通知の自動初期化をスキップします');
      return false;
    }

    try {
      const initialized = await this.initialize();
      if (!initialized) return false;

      // 既存のsubscriptionが存在するかチェック
      const existingSubscription = await this.registration?.pushManager.getSubscription();
      if (existingSubscription) {
        this.subscription = existingSubscription;
        const isValid = await this.validateExistingSubscription(existingSubscription);
        if (isValid) {
          console.log('既存の有効なsubscriptionを確認しました');
          pushNotificationSettings.setEndpoint(existingSubscription.endpoint);
          return true;
        }
      }

      // autoSubscribeが有効な場合のみ新規購読
      if (pushNotificationSettings.shouldAutoSubscribe()) {
        console.log('自動購読を実行します');
        const subscribed = await this.subscribe();
        if (subscribed) {
          pushNotificationSettings.setEndpoint(this.subscription?.endpoint);
        }
        return subscribed;
      }

      console.log('自動購読は無効化されています');
      return initialized;
    } catch (error) {
      console.error('自動初期化エラー:', error);
      return false;
    }
  }

  // 認証状態をチェックするメソッド
  async checkAuthenticationStatus(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const authStatus = await response.json();
        return authStatus.authenticated === true;
      }
      return false;
    } catch (error) {
      console.error('認証状態の確認に失敗:', error);
      return false;
    }
  }

  // 設定管理用のヘルパーメソッド
  getSettings() {
    return pushNotificationSettings.getSettings();
  }

  updateSettings(updates: Parameters<typeof pushNotificationSettings.updateSettings>[0]) {
    pushNotificationSettings.updateSettings(updates);
  }

  async sendLocalNotification(title: string, body: string): Promise<void> {
    if (!this.registration) {
      // フォールバック: ブラウザ標準通知
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192x192.png' });
      }
      return;
    }

    // Service Worker経由で通知
    await this.registration.showNotification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'agent-response'
    });
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const pushNotificationManager = new PushNotificationManager();