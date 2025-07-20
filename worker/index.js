// Push notification event handlers
self.addEventListener('push', (event) => {
  console.log('Push event received:', event)
  
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch (e) {
      data = { title: 'AgentAPI Notification', body: event.data.text() }
    }
  }

  const options = {
    title: data.title || 'AgentAPI Notification',
    body: data.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'agentapi-notification',
    data: data,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'AgentAPI Notification', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event)
  
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  event.waitUntil(
    clients.openWindow('/')
  )
})

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event)
})