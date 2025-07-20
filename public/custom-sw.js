// カスタム Service Worker for Push Notifications
console.log('Custom Service Worker loaded');

// Push イベントリスナー
self.addEventListener('push', function(event) {
  console.log('Push event received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'AgentAPI通知',
        body: event.data.text() || 'エージェントからの通知です',
      };
    }
  }

  const options = {
    body: data.body || '通知内容',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: data.tag || 'agentapi-notification',
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    data: data.data || {},
    ...data
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AgentAPI', options)
  );
});

// Notification click イベントリスナー
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received:', event);
  
  event.notification.close();

  // ページを開く/フォーカス
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Service Worker のインストール
self.addEventListener('install', function(event) {
  console.log('Custom Service Worker installing');
  self.skipWaiting();
});

// Service Worker のアクティベート
self.addEventListener('activate', function(event) {
  console.log('Custom Service Worker activating');
  event.waitUntil(self.clients.claim());
});

// メッセージイベントリスナー（フォアグラウンド通知用）
self.addEventListener('message', function(event) {
  console.log('Service Worker received message:', event.data);
  
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    
    self.registration.showNotification(title, {
      body: options.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: options.tag || 'manual-notification',
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      ...options
    });
  }
});