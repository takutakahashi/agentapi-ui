interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// サーバーレス環境対応: メモリベースの保存
// 注意: これは一時的な実装です。本番環境では以下を使用してください:
// - データベース (PostgreSQL, MySQL, etc.)
// - Redis/Memcached
// - KVストレージ (Vercel KV, Upstash, etc.)
let subscriptionsCache: SubscriptionData[] = [];

function loadSubscriptions(): SubscriptionData[] {
  return subscriptionsCache;
}

function saveSubscriptions(subscriptions: SubscriptionData[]): void {
  subscriptionsCache = subscriptions;
  console.log(`サブスクリプション保存完了: ${subscriptions.length}件`);
}

export function getSubscriptions(): SubscriptionData[] {
  return loadSubscriptions();
}

export function addSubscription(subscription: SubscriptionData): void {
  const subscriptions = loadSubscriptions();
  
  const existingIndex = subscriptions.findIndex(
    sub => sub.endpoint === subscription.endpoint
  );

  if (existingIndex !== -1) {
    subscriptions[existingIndex] = subscription;
  } else {
    subscriptions.push(subscription);
  }

  saveSubscriptions(subscriptions);
}

export function removeSubscription(endpoint: string): boolean {
  const subscriptions = loadSubscriptions();
  const initialLength = subscriptions.length;
  
  const filteredSubscriptions = subscriptions.filter(
    sub => sub.endpoint !== endpoint
  );
  
  if (filteredSubscriptions.length !== initialLength) {
    saveSubscriptions(filteredSubscriptions);
    return true;
  }
  
  return false;
}