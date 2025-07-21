import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptions, addSubscription, removeSubscription } from '../../../lib/subscriptions';
import { decryptCookie } from '@/lib/cookie-encryption';

interface SubscriptionRequest {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userType?: 'github' | 'api_key';
  userName?: string;
}

interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userType?: 'github' | 'api_key';
  userName?: string;
  createdAt?: Date;
}

async function getUserInfo(request: NextRequest): Promise<{ userId?: string; userType?: 'github' | 'api_key'; userName?: string }> {
  const authToken = request.cookies.get('agentapi_token')?.value;
  
  if (!authToken) {
    return {};
  }

  try {
    const decryptedData = decryptCookie(authToken);
    const sessionData = JSON.parse(decryptedData);

    // GitHub OAuth認証の場合
    if (sessionData.sessionId && sessionData.accessToken) {
      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${sessionData.accessToken}`,
            'User-Agent': 'agentapi-ui'
          }
        });

        if (response.ok) {
          const githubUser = await response.json();
          return {
            userId: githubUser.id.toString(),
            userType: 'github',
            userName: githubUser.login
          };
        }
      } catch (error) {
        console.error('Failed to fetch GitHub user info:', error);
      }
    }
  } catch (error) {
    // デクリプションに失敗した場合はAPIキー認証とみなす
    console.log('Using API key authentication:', error);
  }

  // APIキー認証の場合は一意のセッションIDを生成
  const sessionId = authToken.substring(0, 16); // トークンの一部を使用
  return {
    userId: sessionId,
    userType: 'api_key',
    userName: 'API User'
  };
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authToken = request.cookies.get('agentapi_token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: 'プッシュ通知を利用するにはログインが必要です' },
        { status: 401 }
      );
    }

    const subscriptionRequest: SubscriptionRequest = await request.json();

    if (!subscriptionRequest || !subscriptionRequest.endpoint || !subscriptionRequest.keys) {
      return NextResponse.json(
        { error: '無効なサブスクリプションデータです' },
        { status: 400 }
      );
    }

    // ユーザー情報を取得
    const userInfo = await getUserInfo(request);
    
    // ユーザー情報が取得できない場合はエラー
    if (!userInfo.userId) {
      return NextResponse.json(
        { error: 'ユーザー情報の取得に失敗しました。再度ログインしてください' },
        { status: 401 }
      );
    }
    
    // サブスクリプションデータを構築
    const subscription: SubscriptionData = {
      endpoint: subscriptionRequest.endpoint,
      keys: subscriptionRequest.keys,
      userId: subscriptionRequest.userId || userInfo.userId,
      userType: subscriptionRequest.userType || userInfo.userType,
      userName: subscriptionRequest.userName || userInfo.userName,
      createdAt: new Date()
    };

    addSubscription(subscription);
    console.log('サブスクリプションが保存されました:', {
      endpoint: subscription.endpoint.substring(0, 50) + '...',
      userId: subscription.userId,
      userType: subscription.userType,
      userName: subscription.userName
    });

    const allSubscriptions = getSubscriptions();
    return NextResponse.json({ 
      success: true, 
      message: 'サブスクリプションが正常に保存されました',
      subscriptionCount: allSubscriptions.length,
      userInfo: {
        userId: subscription.userId,
        userType: subscription.userType,
        userName: subscription.userName
      }
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
      hasKeys: !!sub.keys.p256dh && !!sub.keys.auth,
      userId: sub.userId,
      userType: sub.userType,
      userName: sub.userName,
      createdAt: sub.createdAt
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