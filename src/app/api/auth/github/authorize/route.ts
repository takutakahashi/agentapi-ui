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
    const proxyEndpoint = process.env.AGENTAPI_PROXY_ENDPOINT || 'http://localhost:8080'
    const response = await fetch(`${proxyEndpoint}/oauth/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        redirect_uri,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OAuth authorize error:', errorData)
      return NextResponse.json(
        { error: 'Failed to start OAuth flow' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // stateを一時的にセッションストレージに保存するためのCookieを設定
    const headers = new Headers()
    headers.append('Set-Cookie', `oauth_state=${data.state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`)

    return NextResponse.json({
      authorization_url: data.authorization_url,
      state: data.state
    }, { headers })
  } catch (error) {
    console.error('OAuth authorize error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}