import { NextRequest, NextResponse } from 'next/server';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

import { getSubscriptionStore } from '../subscription-store';

export async function POST(request: NextRequest) {
  try {
    const subscriptionData: PushSubscriptionData = await request.json();
    
    if (!subscriptionData.endpoint || !subscriptionData.keys.p256dh || !subscriptionData.keys.auth) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    const subscriptionId = generateSubscriptionId(subscriptionData.endpoint);
    const subscriptions = getSubscriptionStore();
    subscriptions.set(subscriptionId, subscriptionData);

    console.log(`Push subscription stored: ${subscriptionId}`);
    
    return NextResponse.json({
      success: true,
      subscriptionId
    });
  } catch (error) {
    console.error('Error storing push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to store subscription' },
      { status: 500 }
    );
  }
}

function generateSubscriptionId(endpoint: string): string {
  const hash = endpoint.split('/').pop() || Math.random().toString(36);
  return hash.substring(0, 16);
}