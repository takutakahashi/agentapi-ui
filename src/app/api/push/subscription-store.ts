interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

let subscriptions: Map<string, PushSubscriptionData> | null = null;

export function getSubscriptionStore(): Map<string, PushSubscriptionData> {
  if (!subscriptions) {
    subscriptions = new Map<string, PushSubscriptionData>();
  }
  return subscriptions;
}