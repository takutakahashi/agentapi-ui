import { NextResponse } from 'next/server';
import { 
  cleanupInvalidSubscriptions, 
  removeDuplicateSubscriptions,
  getSubscriptions 
} from '@/lib/subscriptions';

export async function POST() {
  try {
    const beforeCount = getSubscriptions().length;
    
    // 重複subscriptionを削除
    const duplicatesRemoved = removeDuplicateSubscriptions();
    
    // 無効なsubscriptionを削除
    const invalidRemoved = cleanupInvalidSubscriptions();
    
    const afterCount = getSubscriptions().length;
    const totalRemoved = duplicatesRemoved + invalidRemoved;
    
    return NextResponse.json({
      success: true,
      cleanup: {
        beforeCount,
        afterCount,
        duplicatesRemoved,
        invalidRemoved,
        totalRemoved
      }
    });
  } catch (error) {
    console.error('Subscription cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'クリーンアップに失敗しました' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const subscriptions = getSubscriptions();
    return NextResponse.json({
      count: subscriptions.length,
      subscriptions: subscriptions.map(sub => ({
        endpoint: sub.endpoint.substring(0, 50) + '...',
        userId: sub.userId,
        userType: sub.userType,
        createdAt: sub.createdAt,
        lastValidated: sub.lastValidated,
        failureCount: sub.failureCount || 0
      }))
    });
  } catch (error) {
    console.error('Subscription get error:', error);
    return NextResponse.json(
      { success: false, error: 'subscription情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}