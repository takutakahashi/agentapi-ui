// カスタムService Worker - 通知機能拡張
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data?.text()}"`);

  const title = 'AgentAPI 通知';
  const options = {
    body: event.data?.text() || '新しい通知があります',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: '開く',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: '閉じる',
        icon: '/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');

  event.notification.close();

  if (event.action === 'explore') {
    // This looks to see if the current is already open and
    // focuses if it is
    event.waitUntil(clients.openWindow('/'));
  } else if (event.action === 'close') {
    event.notification.close();
  }
});

// メッセージ受信ハンドラー
self.addEventListener('message', function(event) {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, ...options } = event.data.data;
    self.registration.showNotification(title || 'AgentAPI 通知', {
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      ...options
    }).then(() => {
      // クライアントに成功を通知
      event.ports[0]?.postMessage({ type: 'NOTIFICATION_DISPLAYED', success: true });
    }).catch((error) => {
      console.error('[Service Worker] Failed to show notification:', error);
      event.ports[0]?.postMessage({ type: 'NOTIFICATION_ERROR', error: error.message });
    });
  }
});

console.log('[Service Worker Custom] Loaded');