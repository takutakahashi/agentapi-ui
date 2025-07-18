const VAPID_PUBLIC_KEY = 'BGzUvb_nB64C8JP8vxV7VRAgOVuD38wnCgM2KPd4_TPgsqRtr6VGadc66ka7lET0cEYlbh_IOooLO_qnXx8fnD0';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  async initialize(): Promise<boolean> {
    console.log('PushNotificationManager.initialize() called');
    
    // 基本的な通知許可のみ求める（Service Worker なしでも動作）
    try {
      console.log('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('Notification permission result:', permission);
      
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return false;
      }
      
      // Service Worker があれば使用、なければフォールバック
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        console.log('Push notifications are supported');
        // Service Worker の初期化は非同期で実行（失敗してもOK）
        this.initializeServiceWorker().catch(error => {
          console.log('Service Worker initialization failed (using fallback):', error);
        });
      } else {
        console.log('Service Worker not supported, using fallback notifications');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  private async initializeServiceWorker(): Promise<void> {
    try {
      // Service Worker登録を取得
      console.log('Waiting for service worker ready...');
      
      // Service Worker が利用可能かチェック
      if (!navigator.serviceWorker.controller) {
        console.log('No service worker controlling this page, registering...');
        // Service Worker を手動で登録
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered manually:', registration);
        
        // Service Worker がアクティブになるまで待機
        if (registration.installing || registration.waiting) {
          console.log('Waiting for service worker to activate...');
          await new Promise((resolve) => {
            const worker = registration.installing || registration.waiting;
            if (worker) {
              worker.addEventListener('statechange', () => {
                if (worker.state === 'activated') {
                  console.log('Service worker activated');
                  resolve(void 0);
                }
              });
            }
          });
        }
      }
      
      // タイムアウト付きでService Worker待機
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Service Worker ready timeout')), 5000);
      });
      
      this.registration = await Promise.race([
        navigator.serviceWorker.ready,
        timeoutPromise
      ]) as ServiceWorkerRegistration;
      
      console.log('Service worker ready:', this.registration);

      // プッシュ購読を確認/作成
      console.log('Getting existing subscription...');
      let subscription = await this.registration.pushManager.getSubscription();
      console.log('Existing subscription:', subscription);
      
      if (!subscription) {
        console.log('Creating new subscription...');
        subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        console.log('New subscription created:', subscription);
      }

      this.subscription = subscription;
      
      // サーバーに購読情報を送信
      await this.sendSubscriptionToServer();
      
      console.log('Push subscription created:', subscription);
    } catch (error) {
      console.error('Failed to initialize service worker:', error);
      console.log('Continuing with fallback notifications only');
    }
  }

  async getSubscription(): Promise<PushSubscriptionData | null> {
    if (!this.subscription) {
      return null;
    }

    const key = this.subscription.getKey('p256dh');
    const auth = this.subscription.getKey('auth');

    if (!key || !auth) {
      return null;
    }

    return {
      endpoint: this.subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(key),
        auth: this.arrayBufferToBase64(auth)
      }
    };
  }

  async sendSubscriptionToServer(): Promise<void> {
    try {
      const subscriptionData = await this.getSubscription();
      if (!subscriptionData) {
        throw new Error('Failed to get subscription data');
      }

      // TODO: サーバーサイドのAPIエンドポイントを実装後に有効化
      // const response = await fetch('/api/push/subscribe', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(subscriptionData)
      // });

      // if (!response.ok) {
      //   throw new Error('Failed to send subscription to server');
      // }

      console.log('Subscription sent to server:', subscriptionData);
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return false;
    }

    try {
      const success = await this.subscription.unsubscribe();
      if (success) {
        this.subscription = null;
        // TODO: サーバーサイドのAPIエンドポイントを実装後に有効化
        // await fetch('/api/push/unsubscribe', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({ endpoint: this.subscription.endpoint })
        // });
      }
      return success;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    }
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  async sendLocalNotification(title: string, body: string): Promise<void> {
    console.log('sendLocalNotification called:', { title, body });
    console.log('Registration available:', !!this.registration);
    console.log('Notification permission:', Notification.permission);
    
    if (!this.registration) {
      // フォールバック: ブラウザ標準通知
      console.log('Using fallback browser notification');
      if (Notification.permission === 'granted') {
        console.log('Creating fallback notification');
        new Notification(title, { body, icon: '/icon-192x192.png' });
      } else {
        console.log('Notification permission not granted for fallback');
      }
      return;
    }

    // Service Worker経由で通知
    console.log('Using service worker notification');
    try {
      await this.registration.showNotification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'agent-response'
      });
      console.log('Service worker notification sent successfully');
    } catch (error) {
      console.error('Failed to send service worker notification:', error);
    }
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

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export const pushNotificationManager = new PushNotificationManager();