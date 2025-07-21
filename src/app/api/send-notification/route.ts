import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getSubscriptions, getSubscriptionsByUserId, getUserSubscriptions } from '../../../lib/subscriptions';
import { decryptCookie } from '@/lib/cookie-encryption';

// 環境変数からVAPIDキーを取得（必須）
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@agentapi.example.com';

// VAPID設定の検証
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('VAPID keys not configured. Please set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
} else {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  targetUserId?: string; // 特定のユーザーに送信（targetUserIdかtargetUserTypeのいずれかは必須）
  targetUserType?: 'github' | 'api_key'; // 特定の認証タイプのユーザーに送信
  senderInfo?: {
    userId?: string;
    userName?: string;
    userType?: 'github' | 'api_key';
  };
}

async function getSenderInfo(request: NextRequest): Promise<{ userId?: string; userName?: string; userType?: 'github' | 'api_key' }> {
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
            userName: githubUser.login,
            userType: 'github'
          };
        }
      } catch (error) {
        console.error('Failed to fetch GitHub user info:', error);
      }
    }
  } catch (error) {
    console.log('Using API key authentication:', error);
  }

  // APIキー認証の場合
  const sessionId = authToken.substring(0, 16);
  return {
    userId: sessionId,
    userName: 'API User',
    userType: 'api_key'
  };
}

export async function POST(request: NextRequest) {
  try {
    // VAPID設定のチェック
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'VAPID keys are not configured. Please set environment variables.' },
        { status: 500 }
      );
    }

    const { title, body, url, icon, badge, tag, targetUserId, targetUserType, senderInfo }: NotificationPayload = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'タイトルと本文は必須です' },
        { status: 400 }
      );
    }

    // targetUserIdまたはtargetUserTypeのいずれかは必須
    if (!targetUserId && !targetUserType) {
      return NextResponse.json(
        { error: 'targetUserIdまたはtargetUserTypeのいずれかは必須です' },
        { status: 400 }
      );
    }

    // 送信者情報を取得
    const actualSenderInfo = senderInfo || await getSenderInfo(request);

    // 送信対象のサブスクリプションを決定
    let subscriptions;
    if (targetUserId) {
      // 特定のユーザーに送信
      subscriptions = getSubscriptionsByUserId(targetUserId);
    } else {
      // 特定の認証タイプのユーザーに送信
      subscriptions = getUserSubscriptions(targetUserType!);
    }
    
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
      tag: tag || 'agentapi-notification',
      data: {
        sender: actualSenderInfo,
        timestamp: new Date().toISOString(),
        targetUserId,
        targetUserType
      }
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

    console.log(`通知送信結果: 成功=${successful}, 失敗=${failed}`, {
      targetUserId,
      targetUserType,
      senderUserId: actualSenderInfo.userId,
      senderUserType: actualSenderInfo.userType
    });

    return NextResponse.json({
      success: true,
      message: `${successful}件の通知を送信しました`,
      sent: successful,
      failed: failed,
      total: subscriptions.length,
      target: {
        userId: targetUserId,
        userType: targetUserType
      },
      sender: actualSenderInfo
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
    status: VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY ? 'ready' : 'not_configured'
  });
}