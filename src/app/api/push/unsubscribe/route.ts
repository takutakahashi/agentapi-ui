import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionStore } from '../subscription-store';

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json();
    
    const subscriptions = getSubscriptionStore();
    if (subscriptionId && subscriptions.has(subscriptionId)) {
      subscriptions.delete(subscriptionId);
      console.log(`Push subscription removed: ${subscriptionId}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}