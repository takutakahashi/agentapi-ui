import { NextResponse } from 'next/server'
import { type AuthMode, DEFAULT_CONFIG } from '@/types/config'

/**
 * 認証モードを環境変数から取得
 * 後方互換性のため NEXT_PUBLIC_OAUTH_ONLY_MODE もサポート
 */
function getAuthMode(): AuthMode {
  // 新しい AUTH_MODE 環境変数を優先
  const authMode = process.env.AUTH_MODE;
  if (authMode === 'oauth_only' || authMode === 'api_key' || authMode === 'both') {
    return authMode;
  }

  // 後方互換性: NEXT_PUBLIC_OAUTH_ONLY_MODE をサポート
  if (process.env.NEXT_PUBLIC_OAUTH_ONLY_MODE === 'true') {
    return 'oauth_only';
  }

  return DEFAULT_CONFIG.authMode;
}

export async function GET() {
  // VAPIDパブリックキーを取得（プライベートキーは絶対に公開しない）
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Base64URL形式の検証
  if (vapidPublicKey && !/^[A-Za-z0-9_-]+$/.test(vapidPublicKey)) {
    console.error('Invalid VAPID_PUBLIC_KEY format detected');
  }

  // 認証関連の設定を取得
  const authMode = getAuthMode();
  const loginTitle = process.env.LOGIN_TITLE
    || process.env.NEXT_PUBLIC_LOGIN_TITLE
    || DEFAULT_CONFIG.loginTitle;
  const loginDescription = process.env.LOGIN_DESCRIPTION
    || process.env.NEXT_PUBLIC_LOGIN_DESCRIPTION
    || DEFAULT_CONFIG.loginDescription;
  const loginSubDescription = process.env.LOGIN_SUB_DESCRIPTION
    || process.env.NEXT_PUBLIC_LOGIN_SUB_DESCRIPTION
    || DEFAULT_CONFIG.loginSubDescription;

  return NextResponse.json({
    // 認証設定
    authMode,
    loginTitle,
    loginDescription,
    loginSubDescription,
    oauthProviders: DEFAULT_CONFIG.oauthProviders,
    // Push通知設定
    vapidPublicKey: (vapidPublicKey && /^[A-Za-z0-9_-]+$/.test(vapidPublicKey)) ? vapidPublicKey : null
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  })
}
