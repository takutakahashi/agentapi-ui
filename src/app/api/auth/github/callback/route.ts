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
    // サーバーサイドからは AGENTAPI_PROXY_URL (in-cluster URL) で直接呼ぶ
    const proxyUrl = process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080'
    const response = await fetch(`${proxyUrl}/oauth/callback?code=${code}&state=${state}`, {
      method: 'GET',
    })

    if (!response.ok) {
      console.error('OAuth callback error:', response.status, 'Response details omitted for security')
      return NextResponse.redirect(
        new URL('/login/github?error=auth_failed', request.url)
      )
    }

    const data = await response.json()
    
    // APIキーを暗号化してCookieに保存
    const encryptedApiKey = encryptApiKey(data.access_token)
    
    const headers = new Headers()
    headers.append(
      'Set-Cookie',
      `agentapi_token=${encryptedApiKey}; HttpOnly; Secure; SameSite=strict; Path=/; Max-Age=2592000`
    )
    
    // oauth_state Cookieを削除
    headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0')

    // ホームページにリダイレクト - X-Forwarded-* を優先して外部公開URLを使用
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const forwardedHost = request.headers.get('x-forwarded-host')
    const publicOrigin = (forwardedProto && forwardedHost)
      ? `${forwardedProto.split(',')[0].trim()}://${forwardedHost}`
      : request.nextUrl.origin
    const redirectResponse = NextResponse.redirect(new URL('/chats', publicOrigin))
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