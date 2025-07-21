import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getSubscriptions } from '../../../lib/subscriptions';

const VAPID_PUBLIC_KEY = 'BOv-qOWAZ4--eLYAQNk-0jZPDGHH3rrmb4RFaQglVpdz_zQrS5wH1quNS4aWoWSDnRbPO764YURRZt8_B2OMkDQ';
const VAPID_PRIVATE_KEY = '-ni1VcRxrb-o_6h2Sy2TmQyk1iNRJCCBcqZXgKu94Zk';
const VAPID_SUBJECT = 'mailto:admin@agentapi.example.com';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { title, body, url, icon, badge, tag }: NotificationPayload = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'タイトルと本文は必須です' },
        { status: 400 }
      );
    }

    const subscriptions = getSubscriptions();
    
    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'アクティブなサブスクリプションがありません' },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: icon || '/icon-192x192.png',
      badge: badge || '/icon-192x192.png',
      tag: tag || 'agentapi-notification'
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, payload);
          return { endpoint: subscription.endpoint, success: true };
        } catch (error) {
          console.error('通知送信エラー:', error);
          return { 
            endpoint: subscription.endpoint, 
            success: false, 
            error: error instanceof Error ? error.message : '不明なエラー'
          };
        }
      })
    );

    const successful = results.filter(
      (result): result is PromiseFulfilledResult<{ endpoint: string; success: true }> => 
        result.status === 'fulfilled' && result.value.success
    ).length;

    const failed = results.length - successful;

    console.log(`通知送信結果: 成功=${successful}, 失敗=${failed}`);

    return NextResponse.json({
      success: true,
      message: `${successful}件の通知を送信しました`,
      sent: successful,
      failed: failed,
      total: subscriptions.length
    });

  } catch (error) {
    console.error('通知送信処理エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const subscriptions = getSubscriptions();
  return NextResponse.json({
    vapidPublicKey: VAPID_PUBLIC_KEY,
    subscriptionCount: subscriptions.length,
    status: 'ready'
  });
}