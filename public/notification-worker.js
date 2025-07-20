// 通知専用 Service Worker - Redundant問題対策版
console.log('[NotificationSW] Loading...');

// インストール時に即座にアクティブ化
self.addEventListener('install', function(event) {
  console.log('[NotificationSW] Installing...');
  // 待機せずにアクティブ化
  self.skipWaiting();
});

// アクティブ化時にすべてのクライアントを制御
self.addEventListener('activate', function(event) {
  console.log('[NotificationSW] Activating...');
  event.waitUntil(
    clients.claim().then(() => {
      console.log('[NotificationSW] Now controlling all clients');
    })
  );
});

// メッセージハンドラー（skipWaiting制御用）
self.addEventListener('message', function(event) {
  console.log('[NotificationSW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[NotificationSW] SkipWaiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, ...options } = event.data.data;
    self.registration.showNotification(title || 'AgentAPI 通知', {
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      ...options
    }).then(() => {
      console.log('[NotificationSW] Notification displayed');
      event.ports[0]?.postMessage({ type: 'NOTIFICATION_DISPLAYED', success: true });
    }).catch((error) => {
      console.error('[NotificationSW] Failed to show notification:', error);
      event.ports[0]?.postMessage({ type: 'NOTIFICATION_ERROR', error: error.message });
    });
  }
});

// プッシュ通知ハンドラー
self.addEventListener('push', function(event) {
  console.log('[NotificationSW] Push Received.');
  
  const title = 'AgentAPI 通知';
  const options = {
    body: event.data?.text() || '新しい通知があります',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知クリックハンドラー
self.addEventListener('notificationclick', function(event) {
  console.log('[NotificationSW] Notification click received');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('[NotificationSW] Ready');