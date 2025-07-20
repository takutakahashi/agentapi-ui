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

    try {
      // Service Worker登録
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      await navigator.serviceWorker.ready;
      this.registration = await navigator.serviceWorker.ready;
      
      // 通知許可を求める
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return false;
      }

      // プッシュ購読を確認/作成
      this.subscription = await this.registration.pushManager.getSubscription();
      if (!this.subscription) {
        this.subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // サーバーに購読情報を送信
      await this.sendSubscriptionToServer(this.subscription);

      console.log('Push subscription created:', this.subscription);
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

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscriptionData),
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      console.log('Subscription sent to server successfully');
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