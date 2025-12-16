import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // agentapi-proxyのOAuth認証エンドポイントを確認
    const baseUrl = process.env.AGENTAPI_PROXY_ENDPOINT ||
      (process.env.NODE_ENV === 'production'
        ? `https://${request.headers.get('host')}`
        : 'http://localhost:3000')
    const proxyEndpoint = baseUrl.endsWith('/api/proxy') ? baseUrl : `${baseUrl}/api/proxy`

    // OAuthエンドポイントにPOSTリクエストを送信して、有効かどうかを確認
    // ダミーのredirect_uriを使用（実際の認証は行わない）
    const response = await fetch(`${proxyEndpoint}/oauth/authorize`, {
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
