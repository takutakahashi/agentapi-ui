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
      
      // まずカスタムService Workerを登録を試行
      try {
        console.log('Attempting to register custom service worker...');
        const customRegistration = await navigator.serviceWorker.register('/custom-sw.js', {
          scope: '/'
        });
        console.log('Custom service worker registered:', customRegistration);
        
        // アクティブになるまで待機
        await new Promise((resolve) => {
          if (customRegistration.active) {
            resolve(void 0);
          } else {
            const worker = customRegistration.installing || customRegistration.waiting;
            if (worker) {
              worker.addEventListener('statechange', () => {
                if (worker.state === 'activated') {
                  console.log('Custom service worker activated');
                  resolve(void 0);
                }
              });
            }
          }
        });
        
        this.registration = customRegistration;
      } catch (customError) {
        console.log('Custom SW registration failed, trying default:', customError);
        
        // フォールバック: デフォルトのService Worker
        if (!navigator.serviceWorker.controller) {
          console.log('No service worker controlling this page, registering default...');
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Default service worker registered:', registration);
          
          if (registration.installing || registration.waiting) {
            console.log('Waiting for default service worker to activate...');
            await new Promise((resolve) => {
              const worker = registration.installing || registration.waiting;
              if (worker) {
                worker.addEventListener('statechange', () => {
                  if (worker.state === 'activated') {
                    console.log('Default service worker activated');
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
      }
      
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
    console.log('Document visibility:', document.visibilityState);
    console.log('Document focused:', document.hasFocus());
    
    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    // 複数の方法で通知を試行
    const methods = [
      // 方法1: Service Worker経由
      async () => {
        if (this.registration) {
          console.log('Trying Service Worker notification...');
          await this.registration.showNotification(title, {
            body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: `notification-${Date.now()}`,
            requireInteraction: false,
            silent: false
          });
          console.log('Service Worker notification sent');
          return true;
        }
        return false;
      },
      
      // 方法2: ブラウザ標準通知（常にフォールバック）
      async () => {
        console.log('Trying browser notification...');
        const notification = new Notification(title, { 
          body, 
          icon: '/icon-192x192.png',
          tag: `notification-${Date.now()}`,
          requireInteraction: false,
          silent: false
        });
        
        notification.onclick = () => {
          console.log('Browser notification clicked');
          window.focus();
          notification.close();
        };
        
        notification.onshow = () => {
          console.log('Browser notification shown');
        };
        
        notification.onerror = (error) => {
          console.error('Browser notification error:', error);
        };
        
        console.log('Browser notification created');
        return true;
      },
      
      // 方法3: メッセージ経由でService Workerに送信
      async () => {
        if (this.registration && this.registration.active) {
          console.log('Trying message to Service Worker...');
          this.registration.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options: {
              body,
              icon: '/icon-192x192.png',
              tag: `message-notification-${Date.now()}`
            }
          });
          console.log('Message sent to Service Worker');
          return true;
        }
        return false;
      }
    ];

    // 各方法を順番に試行
    for (let i = 0; i < methods.length; i++) {
      try {
        const success = await methods[i]();
        if (success) {
          console.log(`Notification method ${i + 1} succeeded`);
          break;
        }
      } catch (error) {
        console.error(`Notification method ${i + 1} failed:`, error);
        if (i === methods.length - 1) {
          // 最後の方法も失敗した場合
          console.error('All notification methods failed');
        }
      }
    }
  }

  // 強制的に通知をテストするメソッド
  async forceNotificationTest(): Promise<void> {
    console.log('=== 強制通知テスト開始 ===');
    
    // 1. 基本チェック
    console.log('Document visible:', document.visibilityState);
    console.log('Document focused:', document.hasFocus());
    console.log('Permission:', Notification.permission);
    
    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }
    
    // 2. 異なるタイミングで複数の通知を送信
    const notifications = [
      { title: 'テスト1', body: '即座の通知', delay: 0 },
      { title: 'テスト2', body: '1秒後の通知', delay: 1000 },
      { title: 'テスト3', body: '3秒後の通知', delay: 3000 }
    ];
    
    for (const notif of notifications) {
      setTimeout(async () => {
        try {
          // 複数の方法で同時に通知
          if (this.registration) {
            await this.registration.showNotification(notif.title, {
              body: notif.body,
              icon: '/icon-192x192.png',
              tag: `test-${Date.now()}`,
              requireInteraction: false
            });
          }
          
          new Notification(notif.title, {
            body: notif.body + ' (Browser)',
            icon: '/icon-192x192.png',
            tag: `browser-test-${Date.now()}`
          });
          
          console.log(`${notif.title} sent successfully`);
        } catch (error) {
          console.error(`Failed to send ${notif.title}:`, error);
        }
      }, notif.delay);
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

// 通知設定を取得する関数
export function getNotificationSettings() {
  const defaultConfig = {
    agentResponses: true,
    sessionEvents: true,
    systemNotifications: true,
    quiet: false,
    quietStart: '22:00',
    quietEnd: '08:00',
  };

  const savedConfig = localStorage.getItem('notification-settings');
  if (savedConfig) {
    return { ...defaultConfig, ...JSON.parse(savedConfig) };
  }
  return defaultConfig;
}

// 通知が許可されているかチェック
export function isNotificationEnabled(): boolean {
  return Notification.permission === 'granted';
}

// 特定の通知タイプが有効かチェック
export function shouldSendNotification(type: 'agentResponses' | 'sessionEvents' | 'systemNotifications'): boolean {
  if (!isNotificationEnabled()) return false;
  
  const config = getNotificationSettings();
  if (!config[type]) return false;
  
  // マナーモードのチェック
  if (config.quiet) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const startTime = config.quietStart;
    const endTime = config.quietEnd;
    
    // 時間帯チェック（日をまたぐ場合も考慮）
    if (startTime <= endTime) {
      // 同日内の時間帯
      if (currentTime >= startTime && currentTime <= endTime) {
        return false;
      }
    } else {
      // 日をまたぐ時間帯
      if (currentTime >= startTime || currentTime <= endTime) {
        return false;
      }
    }
  }
  
  return true;
}