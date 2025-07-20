import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getSubscriptionStore } from '../subscription-store';

const VAPID_PUBLIC_KEY = 'BGzUvb_nB64C8JP8vxV7VRAgOVuD38wnCgM2KPd4_TPgsqRtr6VGadc66ka7lET0cEYlbh_IOooLO_qnXx8fnD0';
const VAPID_PRIVATE_KEY = 'JYb1Rga5c_5Ap5yDIVhgM2-PiVwdl7mBDJhQMpqXi8w';

webpush.setVapidDetails(
  'mailto:noreply@agentapi.dev',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export async function POST(request: NextRequest) {
  try {
    const { title, body, subscriptionId } = await request.json();
    
    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'agentapi-notification'
    });

    const subscriptions = getSubscriptionStore();
    let sentCount = 0;
    let failedCount = 0;

    if (subscriptionId) {
      const subscription = subscriptions.get(subscriptionId);
      if (subscription) {
        try {
          await webpush.sendNotification(subscription, payload);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send to subscription ${subscriptionId}:`, error);
          failedCount++;
        }
      }
    } else {
      for (const [id, subscription] of subscriptions.entries()) {
        try {
          await webpush.sendNotification(subscription, payload);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send to subscription ${id}:`, error);
          subscriptions.delete(id);
          failedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      totalSubscriptions: subscriptions.size
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}