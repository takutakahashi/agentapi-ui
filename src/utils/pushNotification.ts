const VAPID_PUBLIC_KEY = 'BGzUvb_nB64C8JP8vxV7VRAgOVuD38wnCgM2KPd4_TPgsqRtr6VGadc66ka7lET0cEYlbh_IOooLO_qnXx8fnD0';

export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return false;
    }

    try {
      // Service Worker登録を取得
      this.registration = await navigator.serviceWorker.ready;
      
      // 通知許可を求める
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return false;
      }

      // プッシュ購読を確認/作成
      let subscription = await this.registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      console.log('Push subscription created:', subscription);
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
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