import fs from 'fs';
import path from 'path';

interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'tmp', 'subscriptions.json');

function ensureDirectory() {
  const dir = path.dirname(SUBSCRIPTIONS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadSubscriptions(): SubscriptionData[] {
  try {
    ensureDirectory();
    if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
    return JSON.parse(data) || [];
  } catch (error) {
    console.error('サブスクリプション読み込みエラー:', error);
    return [];
  }
}

function saveSubscriptions(subscriptions: SubscriptionData[]): void {
  try {
    ensureDirectory();
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
  } catch (error) {
    console.error('サブスクリプション保存エラー:', error);
    throw error;
  }
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