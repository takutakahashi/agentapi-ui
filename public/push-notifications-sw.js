// Simple service worker for push notifications
console.log('Push notifications service worker loaded');

self.addEventListener('install', (event) => {
  console.log('Push SW: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Push SW: Activating...');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Push SW: Push event received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'AgentAPI Notification', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'agentapi-notification',
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AgentAPI Notification', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Push SW: Notification click received:', event);
  
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});