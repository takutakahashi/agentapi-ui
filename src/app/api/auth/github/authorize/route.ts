import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { redirect_uri } = body

    if (!redirect_uri) {
      return NextResponse.json(
        { error: 'redirect_uri is required' },
        { status: 400 }
      )
    }

    // agentapi-proxyのOAuth認証エンドポイントを使用
    // デフォルトでローカルの /api/proxy を使用（サーバーサイドでは絶対URLが必要）
    const baseUrl = process.env.AGENTAPI_PROXY_ENDPOINT || 
      (process.env.NODE_ENV === 'production' 
        ? `https://${request.headers.get('host')}` 
        : 'http://localhost:3000')
    const proxyEndpoint = baseUrl.endsWith('/api/proxy') ? baseUrl : `${baseUrl}/api/proxy`
    console.log('OAuth authorize request to:', `${proxyEndpoint}/oauth/authorize`)
    const response = await fetch(`${proxyEndpoint}/oauth/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        redirect_uri,
      }),
    })

    console.log('OAuth authorize response status:', response.status)
    console.log('OAuth authorize response headers:', Object.fromEntries(response.headers.entries()))

    // Check if response is a redirect
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location) {
        console.log('OAuth authorize returned redirect to:', location)
        // Extract state from the redirect URL if present
        const urlParams = new URLSearchParams(new URL(location).search)
        const state = urlParams.get('state') || crypto.randomUUID()
        
        const headers = new Headers()
        headers.append('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`)
        
        return NextResponse.json({
          auth_url: location,
          state: state
        }, { headers })
      }
    }

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OAuth authorize error:', errorData)
      return NextResponse.json(
        { error: 'Failed to start OAuth flow' },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const textData = await response.text()
      console.error('OAuth authorize returned non-JSON response:', textData)
      return NextResponse.json(
        { error: 'Invalid response format from OAuth provider' },
        { status: 500 }
      )
    }

    const data = await response.json()
    
    // デバッグ: レスポンスの内容をログ出力
    console.log('OAuth authorize response from agentapi-proxy:', JSON.stringify(data, null, 2))
    
    // レスポンスフィールドの互換性を確保
    // agentapi-proxyは異なるフィールド名を使用する可能性がある
    // ネストされた構造も考慮
    const authUrl = data.authorization_url || 
                    data.auth_url || 
                    data.authUrl || 
                    data.url || 
                    data.authorize_url ||
                    data.data?.authorization_url ||
                    data.data?.auth_url ||
                    data.data?.url
    
    const state = data.state || data.data?.state
    
    if (!authUrl) {
      console.error('No authorization URL found in response. Available fields:', Object.keys(data))
      return NextResponse.json(
        { error: 'Invalid response from OAuth provider - no authorization URL' },
        { status: 500 }
      )
    }
    
    if (!state) {
      console.error('No state found in response. Available fields:', Object.keys(data))
      return NextResponse.json(
        { error: 'Invalid response from OAuth provider - no state' },
        { status: 500 }
      )
    }
    
    // stateを一時的にセッションストレージに保存するためのCookieを設定
    const headers = new Headers()
    headers.append('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`)

    return NextResponse.json({
      auth_url: authUrl,
      state: state
    }, { headers })
  } catch (error) {
    console.error('OAuth authorize error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}