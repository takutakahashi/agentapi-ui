interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string; // ユーザー識別子（GitHubユーザーIDまたはセッションID）
  userType?: 'github' | 'api_key'; // 認証タイプ
  userName?: string; // ユーザー名（表示用）
  createdAt?: Date; // サブスクリプション作成日時
  lastValidated?: Date; // 最後に有効性を確認した日時
  failureCount?: number; // 連続送信失敗回数
}

// サーバーレス環境対応: メモリベースの保存
// 注意: これは一時的な実装です。本番環境では以下を使用してください:
// - データベース (PostgreSQL, MySQL, etc.)
// - Redis/Memcached
// - KVストレージ (Vercel KV, Upstash, etc.)
let subscriptionsCache: SubscriptionData[] = [];

// 定期クリーンアップの実行フラグ
let cleanupInterval: NodeJS.Timeout | null = null;

// 定期クリーンアップを開始（アプリケーション起動時に呼び出す）
export function startPeriodicCleanup(): void {
  if (cleanupInterval) return; // 既に開始している場合はスキップ
  
  // 1時間毎にクリーンアップを実行
  cleanupInterval = setInterval(() => {
    try {
      const removed = cleanupInvalidSubscriptions();
      if (removed > 0) {
        console.log(`定期クリーンアップ: ${removed}件のsubscriptionを削除`);
      }
    } catch (error) {
      console.error('定期クリーンアップエラー:', error);
    }
  }, 60 * 60 * 1000); // 1時間 = 60分 * 60秒 * 1000ms
  
  console.log('定期subscriptionクリーンアップを開始しました');
}

// 定期クリーンアップを停止
export function stopPeriodicCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('定期subscription クリーンアップを停止しました');
  }
}

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

export function getSubscriptionsByUserId(userId: string): SubscriptionData[] {
  return loadSubscriptions().filter(sub => sub.userId === userId);
}

export function getUserSubscriptions(userType?: 'github' | 'api_key'): SubscriptionData[] {
  const subscriptions = loadSubscriptions();
  if (userType) {
    return subscriptions.filter(sub => sub.userType === userType);
  }
  return subscriptions;
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

// 無効なsubscriptionを自動クリーンアップする関数
export function cleanupInvalidSubscriptions(): number {
  const subscriptions = loadSubscriptions();
  const now = new Date();
  const maxFailureCount = 5; // 連続失敗5回で削除
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30日間
  
  const validSubscriptions = subscriptions.filter(sub => {
    // 連続失敗回数が上限を超えた場合は削除
    if (sub.failureCount && sub.failureCount >= maxFailureCount) {
      console.log(`無効なsubscription削除 (失敗回数): ${sub.endpoint}`);
      return false;
    }
    
    // 作成から30日経過した場合は削除
    if (sub.createdAt && (now.getTime() - sub.createdAt.getTime()) > maxAge) {
      console.log(`期限切れsubscription削除: ${sub.endpoint}`);
      return false;
    }
    
    return true;
  });
  
  const removedCount = subscriptions.length - validSubscriptions.length;
  
  if (removedCount > 0) {
    saveSubscriptions(validSubscriptions);
    console.log(`クリーンアップ完了: ${removedCount}件のsubscriptionを削除`);
  }
  
  return removedCount;
}

// subscription送信失敗時に呼び出す関数
export function markSubscriptionFailure(endpoint: string): void {
  const subscriptions = loadSubscriptions();
  const subscription = subscriptions.find(sub => sub.endpoint === endpoint);
  
  if (subscription) {
    subscription.failureCount = (subscription.failureCount || 0) + 1;
    subscription.lastValidated = new Date();
    saveSubscriptions(subscriptions);
    console.log(`Subscription失敗記録: ${endpoint} (失敗回数: ${subscription.failureCount})`);
  }
}

// subscription送信成功時に呼び出す関数
export function markSubscriptionSuccess(endpoint: string): void {
  const subscriptions = loadSubscriptions();
  const subscription = subscriptions.find(sub => sub.endpoint === endpoint);
  
  if (subscription) {
    subscription.failureCount = 0; // 成功時はカウンターリセット
    subscription.lastValidated = new Date();
    saveSubscriptions(subscriptions);
  }
}

// 重複subscription検出の改善
export function removeDuplicateSubscriptions(): number {
  const subscriptions = loadSubscriptions();
  const seen = new Map<string, SubscriptionData>();
  
  for (const sub of subscriptions) {
    const key = `${sub.userId || 'anonymous'}_${sub.endpoint}`;
    const existing = seen.get(key);
    
    if (!existing || (sub.createdAt && existing.createdAt && sub.createdAt > existing.createdAt)) {
      seen.set(key, sub);
    }
  }
  
  const uniqueSubscriptions = Array.from(seen.values());
  const removedCount = subscriptions.length - uniqueSubscriptions.length;
  
  if (removedCount > 0) {
    saveSubscriptions(uniqueSubscriptions);
    console.log(`重複subscription削除: ${removedCount}件`);
  }
  
  return removedCount;
}