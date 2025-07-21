import { NextRequest, NextResponse } from 'next/server';

interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

let subscriptions: SubscriptionData[] = [];

export async function POST(request: NextRequest) {
  try {
    const subscription: SubscriptionData = await request.json();

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: '無効なサブスクリプションデータです' },
        { status: 400 }
      );
    }

    const existingIndex = subscriptions.findIndex(
      sub => sub.endpoint === subscription.endpoint
    );

    if (existingIndex !== -1) {
      subscriptions[existingIndex] = subscription;
      console.log('サブスクリプションが更新されました:', subscription.endpoint);
    } else {
      subscriptions.push(subscription);
      console.log('新しいサブスクリプションが追加されました:', subscription.endpoint);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'サブスクリプションが正常に保存されました',
      subscriptionCount: subscriptions.length
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
  return NextResponse.json({
    subscriptionCount: subscriptions.length,
    subscriptions: subscriptions.map(sub => ({
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

    const initialLength = subscriptions.length;
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    
    const removed = initialLength - subscriptions.length;
    
    if (removed > 0) {
      console.log('サブスクリプションが削除されました:', endpoint);
      return NextResponse.json({ 
        success: true, 
        message: 'サブスクリプションが削除されました',
        removedCount: removed
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

export { subscriptions };