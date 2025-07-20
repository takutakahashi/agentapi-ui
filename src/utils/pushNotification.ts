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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return false;
    }

    // HTTPSまたはlocalhostでのみ動作
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      console.warn('Push notifications require HTTPS or localhost');
      return false;
    }

    try {
      console.log('Starting push notification initialization...');
      
      // Service Workerの登録を確認
      console.log('Checking for service worker registration...');
      
      // まず既存の登録を確認
      let registration = await navigator.serviceWorker.getRegistration('/');
      
      if (!registration) {
        console.log('No existing registration found, registering new service worker...');
        // Service Workerを手動で登録
        try {
          // まずNext.js PWAのService Workerを試す
          registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service worker registered successfully');
          
          // 登録が完了するまで待つ
          await new Promise((resolve) => {
            if (registration.active) {
              resolve(undefined);
            } else {
              registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                  newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated') {
                      resolve(undefined);
                    }
                  });
                }
              });
            }
          });
        } catch (registerError) {
          console.error('Failed to register sw.js, trying fallback:', registerError);
          
          // フォールバック: シンプルなpush notifications service workerを使用
          try {
            registration = await navigator.serviceWorker.register('/push-notifications-sw.js');
            console.log('Fallback service worker registered successfully');
            
            // アクティベーションを待つ
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (fallbackError) {
            console.error('Failed to register fallback service worker:', fallbackError);
            throw fallbackError;
          }
        }
      } else {
        console.log('Using existing service worker registration');
      }
      
      this.registration = registration;
      console.log('Service worker is ready:', this.registration);
      
      // 通知許可を求める
      console.log('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return false;
      }

      // プッシュ購読を確認/作成
      console.log('Checking existing subscription...');
      this.subscription = await this.registration.pushManager.getSubscription();
      
      if (!this.subscription) {
        console.log('Creating new subscription...');
        this.subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        console.log('New subscription created');
      } else {
        console.log('Using existing subscription');
      }

      // サーバーに購読情報を送信（失敗しても初期化は成功とする）
      try {
        console.log('Sending subscription to server...');
        await this.sendSubscriptionToServer(this.subscription);
        console.log('Subscription sent to server successfully');
      } catch (serverError) {
        console.warn('Failed to send subscription to server, but initialization will continue:', serverError);
      }

      console.log('Push notification initialization completed successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };

      // 10秒でタイムアウト
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscriptionData),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }

        console.log('Subscription sent to server successfully');
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) return null;
    return await this.registration.pushManager.getSubscription();
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) return false;
    
    try {
      const result = await this.subscription.unsubscribe();
      if (result) {
        this.subscription = null;
        // サーバーに購読解除を通知
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    }
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  async getPermissionStatus(): Promise<NotificationPermission> {
    return Notification.permission;
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const pushNotificationManager = new PushNotificationManager();