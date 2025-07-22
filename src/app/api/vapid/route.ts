import { NextResponse } from 'next/server';

export async function GET() {
  // VAPIDパブリックキーのみを返す（プライベートキーは絶対に公開しない）
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  
  // Base64URL形式の検証
  if (vapidPublicKey && !/^[A-Za-z0-9_-]+$/.test(vapidPublicKey)) {
    console.error('Invalid VAPID_PUBLIC_KEY format detected');
    return NextResponse.json({ 
      error: 'Invalid VAPID key format' 
    }, { 
      status: 500 
    });
  }

  return NextResponse.json({
    vapidPublicKey: vapidPublicKey || null
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  });
}