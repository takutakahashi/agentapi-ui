import { NextRequest, NextResponse } from 'next/server'
import { decryptCookie } from '@/lib/cookie-encryption'
import { createDefaultAgentAPIProxyClient } from '@/lib/agentapi-proxy-client'
import { UserInfo, ProxyUserInfo } from '@/types/user'

export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('agentapi_token')?.value

    if (!authToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // agentapi-proxy から /user/info を取得
    let proxyUserInfo: ProxyUserInfo | undefined
    try {
      const client = createDefaultAgentAPIProxyClient()
      proxyUserInfo = await client.getUserInfo()
    } catch (err) {
      console.error('Failed to get user info from agentapi-proxy:', err)
      // agentapi-proxy が /user/info をサポートしていない場合はフォールバック
    }

    try {
      const decryptedData = decryptCookie(authToken)
      const sessionData = JSON.parse(decryptedData)

      // GitHub OAuth認証の場合のみユーザー情報を取得
      if (sessionData.sessionId && sessionData.accessToken) {
        // GitHub APIからユーザー情報を取得
        const response = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${sessionData.accessToken}`,
            'User-Agent': 'agentapi-ui'
          }
        })

        if (response.ok) {
          const githubUser = await response.json()
          const userInfo: UserInfo = {
            type: 'github',
            user: {
              id: githubUser.id,
              login: githubUser.login,
              name: githubUser.name,
              email: githubUser.email,
              avatar_url: githubUser.avatar_url
            },
            proxy: proxyUserInfo
          }
          return NextResponse.json(userInfo)
        }
      }
    } catch (err) {
      // デクリプションに失敗した場合はAPIキー認証とみなす
      console.error('Failed to decrypt session data:', err)
    }

    // APIキー認証の場合
    const userInfo: UserInfo = {
      type: proxyUserInfo ? 'proxy' : 'api_key',
      user: {
        authenticated: true
      },
      proxy: proxyUserInfo
    }
    return NextResponse.json(userInfo)
  } catch (error) {
    console.error('User info error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
