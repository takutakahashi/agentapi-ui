import { NextRequest, NextResponse } from 'next/server'
import { encryptCookie, getSecureCookieOptions } from '@/lib/cookie-encryption'

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
    // デフォルトで /api/proxy を使用（相対URLで同じオリジンを参照）
    const proxyEndpoint = process.env.AGENTAPI_PROXY_ENDPOINT || '/api/proxy'
    const response = await fetch(`${proxyEndpoint}/oauth/callback?code=${code}&state=${state}`, {
      method: 'GET',
    })

    if (!response.ok) {
      console.error('OAuth callback error:', response.status, await response.text())
      return NextResponse.redirect(
        new URL('/login/github?error=auth_failed', request.url)
      )
    }

    const data = await response.json()
    
    // セッションIDとアクセストークンを暗号化してCookieに保存
    const sessionData = JSON.stringify({
      sessionId: data.session_id,
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24時間後
    })
    
    const encryptedSession = encryptCookie(sessionData)
    const cookieOptions = getSecureCookieOptions(86400) // 24時間
    
    const headers = new Headers()
    headers.append(
      'Set-Cookie',
      `agentapi_token=${encryptedSession}; ${Object.entries(cookieOptions)
        .map(([key, value]) => {
          if (key === 'maxAge') return `Max-Age=${value}`
          if (key === 'httpOnly' && value) return 'HttpOnly'
          if (key === 'secure' && value) return 'Secure'
          if (key === 'sameSite') return `SameSite=${value}`
          if (key === 'path') return `Path=${value}`
          return ''
        })
        .filter(Boolean)
        .join('; ')}`
    )
    
    // oauth_state Cookieを削除
    headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0')

    // ホームページにリダイレクト
    const redirectResponse = NextResponse.redirect(new URL('/', request.url))
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