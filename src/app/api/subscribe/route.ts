import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptions, addSubscription, removeSubscription } from '../../../lib/subscriptions';

interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const subscription: SubscriptionData = await request.json();

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: '無効なサブスクリプションデータです' },
        { status: 400 }
      );
    }

    addSubscription(subscription);
    console.log('サブスクリプションが保存されました:', subscription.endpoint);

    const allSubscriptions = getSubscriptions();
    return NextResponse.json({ 
      success: true, 
      message: 'サブスクリプションが正常に保存されました',
      subscriptionCount: allSubscriptions.length
    });

  } catch (error) {
    console.error('サブスクリプション保存エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const allSubscriptions = getSubscriptions();
  return NextResponse.json({
    subscriptionCount: allSubscriptions.length,
    subscriptions: allSubscriptions.map(sub => ({
      endpoint: sub.endpoint.substring(0, 50) + '...',
      hasKeys: !!sub.keys.p256dh && !!sub.keys.auth
    }))
  });
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'エンドポイントが指定されていません' },
        { status: 400 }
      );
    }

    const removed = removeSubscription(endpoint);
    
    if (removed) {
      console.log('サブスクリプションが削除されました:', endpoint);
      return NextResponse.json({ 
        success: true, 
        message: 'サブスクリプションが削除されました',
        removedCount: 1
      });
    } else {
      return NextResponse.json(
        { error: '指定されたサブスクリプションが見つかりません' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('サブスクリプション削除エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// subscriptions変数は内部でのみ使用