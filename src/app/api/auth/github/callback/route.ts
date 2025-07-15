import { NextRequest, NextResponse } from 'next/server'
import { encryptApiKey } from '@/lib/cookie-auth'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/login/github?error=missing_params', request.url)
      )
    }

    // stateの検証（CSRF対策）
    const cookies = request.cookies
    const savedState = cookies.get('oauth_state')?.value

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(
        new URL('/login/github?error=invalid_state', request.url)
      )
    }

    // agentapi-proxyのOAuthコールバックエンドポイントを使用
    // デフォルトでローカルの /api/proxy を使用（サーバーサイドでは絶対URLが必要）
    const baseUrl = process.env.AGENTAPI_PROXY_ENDPOINT || 
      (process.env.NODE_ENV === 'production' 
        ? `https://${request.headers.get('host')}` 
        : 'http://localhost:3000')
    const proxyEndpoint = baseUrl.endsWith('/api/proxy') ? baseUrl : `${baseUrl}/api/proxy`
    const response = await fetch(`${proxyEndpoint}/oauth/callback?code=${code}&state=${state}`, {
      method: 'GET',
    })

    if (!response.ok) {
      console.error('OAuth callback error:', response.status, 'Response details omitted for security')
      return NextResponse.redirect(
        new URL('/login/github?error=auth_failed', request.url)
      )
    }

    const responseText = await response.text()
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('OAuth callback error: [SyntaxError: Failed to parse JSON]', { responseText, parseError })
      return NextResponse.redirect(
        new URL('/login/github?error=invalid_response', request.url)
      )
    }
    
    // APIキーを暗号化してCookieに保存
    const encryptedApiKey = encryptApiKey(data.access_token)
    
    const headers = new Headers()
    headers.append(
      'Set-Cookie',
      `agentapi_token=${encryptedApiKey}; HttpOnly; Secure; SameSite=strict; Path=/; Max-Age=86400`
    )
    
    // oauth_state Cookieを削除
    headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0')

    // ホームページにリダイレクト - 適切なホスト名を使用
    const redirectUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.NODE_ENV === 'production' 
        ? `https://${request.headers.get('host')}` 
        : 'http://localhost:3000')
    const redirectResponse = NextResponse.redirect(new URL('/chats', redirectUrl))
    headers.forEach((value, key) => {
      redirectResponse.headers.append(key, value)
    })

    return redirectResponse
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/login/github?error=server_error', request.url)
    )
  }
}