import { NextResponse } from 'next/server'

export async function GET() {
  // VAPIDパブリックキーを取得（プライベートキーは絶対に公開しない）
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  
  // Base64URL形式の検証
  if (vapidPublicKey && !/^[A-Za-z0-9_-]+$/.test(vapidPublicKey)) {
    console.error('Invalid VAPID_PUBLIC_KEY format detected');
    return NextResponse.json({
      singleProfileMode: process.env.SINGLE_PROFILE_MODE === 'true' || process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true',
      vapidPublicKey: null
    })
  }
  
  return NextResponse.json({
    singleProfileMode: process.env.SINGLE_PROFILE_MODE === 'true' || process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true',
    vapidPublicKey: vapidPublicKey || null
  })
}