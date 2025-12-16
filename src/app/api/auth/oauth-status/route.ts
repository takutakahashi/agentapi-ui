import { NextResponse } from 'next/server'

// agentapi-proxy の URL を取得
const PROXY_URL = process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080'

export async function GET() {
  try {
    // agentapi-proxyのOAuth認証エンドポイントを直接確認
    // 注意: /api/proxy 経由ではなく、直接 agentapi-proxy に接続
    const response = await fetch(`${PROXY_URL}/oauth/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        redirect_uri: 'https://example.com/callback'
      }),
      signal: AbortSignal.timeout(5000), // 5秒タイムアウト
    })

    // レスポンスのステータスコードで判定
    // 200: OAuth有効、auth_urlが返される
    // 404, 501: OAuthが設定されていない
    // 500: サーバーエラー（OAuthが設定されていない可能性が高い）
    if (response.ok) {
      const data = await response.json()
      // auth_urlが返されれば OAuth が有効
      if (data.auth_url) {
        return NextResponse.json({ enabled: true })
      }
    }

    // OAuthが有効でない
    return NextResponse.json({ enabled: false })
  } catch (error) {
    console.error('OAuth status check error:', error)
    // エラーの場合は OAuth が有効でないとみなす
    return NextResponse.json({ enabled: false })
  }
}
