// 専用通知Service Worker (Zenn記事のベストプラクティス適用)
console.log('🔧 Notification Service Worker loaded');

// Service Worker のインストール
self.addEventListener('install', (event) => {
  console.log('📦 Notification SW installing...');
  self.skipWaiting(); // 即座にアクティブ化
});

// Service Worker のアクティベート
self.addEventListener('activate', (event) => {
  console.log('🚀 Notification SW activating...');
  event.waitUntil(self.clients.claim()); // 即座にコントロール取得
});

// Push イベントハンドラー（Zenn記事のパターン適用）
self.addEventListener('push', (event) => {
  console.log('📨 Push event received:', event);
  
  // データの解析
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
      console.log('📄 Push data (JSON):', data);
    } catch (e) {
      // JSONパースに失敗した場合はテキストとして扱う
      const text = event.data.text();
      data = {
        title: 'AgentAPI通知',
        body: text || 'エージェントからの通知です',
      };
      console.log('📄 Push data (text):', data);
    }
  } else {
    // データがない場合のデフォルト
    data = {
      title: 'AgentAPI通知',
      body: '新しい通知があります',
    };
    console.log('📄 Push data (default):', data);
  }

  // 通知オプションの設定（記事のベストプラクティス）
  const notificationOptions = {
    body: data.body || '通知内容',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-192x192.png',
    tag: data.tag || `notification-${Date.now()}`,
    image: data.image,
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    renotify: data.renotify || false,
    timestamp: data.timestamp || Date.now(),
    actions: data.actions || [],
    dir: data.dir || 'auto',
    lang: data.lang || 'ja',
    vibrate: data.vibrate || [200, 100, 200],
    // iOS/Safari 対応
    sound: data.sound,
  };

  console.log('🔔 Showing notification:', data.title, notificationOptions);

  // 通知の表示（非同期処理でラップ）
  event.waitUntil(
    self.registration.showNotification(data.title || 'AgentAPI', notificationOptions)
      .then(() => {
        console.log('✅ Notification displayed successfully');
        
        // 通知表示の成功をクライアントに報告
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'NOTIFICATION_DISPLAYED',
              data: { title: data.title, success: true }
            });
          });
        });
      })
      .catch((error) => {
        console.error('❌ Failed to display notification:', error);
        
        // エラーをクライアントに報告
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'NOTIFICATION_ERROR',
              data: { error: error.message }
            });
          });
        });
      })
  );
});

// 通知クリックイベント（記事のパターン拡張）
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event.notification);
  
  const notification = event.notification;
  const data = notification.data;
  
  // 通知を閉じる
  notification.close();
  
  // アクションボタンが押された場合の処理
  if (event.action) {
    console.log('🔘 Action clicked:', event.action);
    
    // カスタムアクション処理
    switch (event.action) {
      case 'open':
        event.waitUntil(openApp(data.url));
        break;
      case 'dismiss':
        // 何もしない（通知は既に閉じられている）
        break;
      default:
        event.waitUntil(openApp(data.url));
    }
  } else {
    // 通知本体がクリックされた場合
    console.log('📱 Notification body clicked');
    event.waitUntil(openApp(data.url));
  }
  
  // クリック情報をクライアントに送信
  event.waitUntil(
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NOTIFICATION_CLICKED',
          data: {
            tag: notification.tag,
            action: event.action,
            timestamp: Date.now()
          }
        });
      });
    })
  );
});

// 通知閉じるイベント
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notification closed:', event.notification);
  
  // 閉じた情報をクライアントに送信
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NOTIFICATION_CLOSED',
        data: {
          tag: event.notification.tag,
          timestamp: Date.now()
        }
      });
    });
  });
});

// アプリを開く処理（記事のベストプラクティス）
async function openApp(targetUrl) {
  const url = targetUrl || '/';
  
  try {
    // 既存のウィンドウを探す
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    console.log('🔍 Found clients:', clients.length);
    
    // 同じオリジンのクライアントを探す
    for (const client of clients) {
      const clientUrl = new URL(client.url);
      const targetUrlObj = new URL(url, self.location.origin);
      
      if (clientUrl.origin === targetUrlObj.origin) {
        console.log('🎯 Focusing existing client:', client.url);
        
        // 既存のウィンドウにフォーカス
        await client.focus();
        
        // 必要に応じてナビゲート
        if (client.navigate && url !== '/') {
          await client.navigate(targetUrlObj.href);
        }
        
        return client;
      }
    }
    
    // 新しいウィンドウを開く
    console.log('🆕 Opening new window:', url);
    return await self.clients.openWindow(url);
    
  } catch (error) {
    console.error('❌ Failed to open app:', error);
    
    // フォールバック：強制的に新しいウィンドウを開く
    try {
      return await self.clients.openWindow('/');
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
    }
  }
}

// クライアントからのメッセージ処理（記事のパターン拡張）
self.addEventListener('message', (event) => {
  console.log('💬 Message received:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SHOW_NOTIFICATION':
      // クライアントからの通知表示要求
      handleClientNotificationRequest(data);
      break;
      
    case 'GET_NOTIFICATION_STATUS':
      // 通知状態の問い合わせ
      handleNotificationStatusRequest(event.source);
      break;
      
    case 'CLEAR_NOTIFICATIONS':
      // 通知のクリア
      handleClearNotifications(data);
      break;
      
    case 'TEST_NOTIFICATION':
      // テスト通知
      handleTestNotification(event.source);
      break;
      
    default:
      console.warn('🤷 Unknown message type:', type);
  }
});

// クライアントからの通知表示要求処理
async function handleClientNotificationRequest(data) {
  try {
    const options = {
      body: data.body || 'クライアントからの通知',
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/icon-192x192.png',
      tag: data.tag || `client-notification-${Date.now()}`,
      data: data.data || {},
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
    };
    
    await self.registration.showNotification(
      data.title || 'AgentAPI通知',
      options
    );
    
    console.log('✅ Client notification displayed');
  } catch (error) {
    console.error('❌ Client notification failed:', error);
  }
}

// 通知状態の問い合わせ処理
async function handleNotificationStatusRequest(source) {
  try {
    const notifications = await self.registration.getNotifications();
    
    source.postMessage({
      type: 'NOTIFICATION_STATUS_RESPONSE',
      data: {
        count: notifications.length,
        notifications: notifications.map(n => ({
          title: n.title,
          body: n.body,
          tag: n.tag,
          timestamp: n.timestamp
        }))
      }
    });
  } catch (error) {
    console.error('❌ Failed to get notification status:', error);
    
    source.postMessage({
      type: 'NOTIFICATION_STATUS_ERROR',
      data: { error: error.message }
    });
  }
}

// 通知クリア処理
async function handleClearNotifications(data) {
  try {
    const notifications = await self.registration.getNotifications();
    
    if (data.tag) {
      // 特定のタグの通知をクリア
      notifications
        .filter(n => n.tag === data.tag)
        .forEach(n => n.close());
    } else {
      // 全ての通知をクリア
      notifications.forEach(n => n.close());
    }
    
    console.log('🧹 Notifications cleared');
  } catch (error) {
    console.error('❌ Failed to clear notifications:', error);
  }
}

// テスト通知処理
async function handleTestNotification(source) {
  try {
    const testNotification = {
      title: 'Service Worker テスト通知',
      body: `通知時刻: ${new Date().toLocaleTimeString('ja-JP')}`,
      icon: '/icon-192x192.png',
      tag: `sw-test-${Date.now()}`,
      requireInteraction: false,
      silent: false,
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    };
    
    await self.registration.showNotification(testNotification.title, {
      body: testNotification.body,
      icon: testNotification.icon,
      tag: testNotification.tag,
      requireInteraction: testNotification.requireInteraction,
      silent: testNotification.silent,
      data: testNotification.data
    });
    
    // 成功を報告
    source.postMessage({
      type: 'TEST_NOTIFICATION_SUCCESS',
      data: { timestamp: Date.now() }
    });
    
    console.log('✅ Test notification sent');
  } catch (error) {
    console.error('❌ Test notification failed:', error);
    
    // エラーを報告
    source.postMessage({
      type: 'TEST_NOTIFICATION_ERROR',
      data: { error: error.message }
    });
  }
}

// エラーハンドリング
self.addEventListener('error', (event) => {
  console.error('💥 Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('🚫 Unhandled promise rejection:', event.reason);
});

console.log('✅ Notification Service Worker setup complete');