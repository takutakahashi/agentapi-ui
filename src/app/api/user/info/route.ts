import { NextRequest, NextResponse } from 'next/server'
import { decryptCookie } from '@/lib/cookie-encryption'
import { getApiKeyFromCookie } from '@/lib/cookie-auth'
import { AgentAPIProxyClient } from '@/lib/agentapi-proxy-client'
import { UserInfo, ProxyUserInfo } from '@/types/user'
import { Repository } from '@/types/repository'

/**
 * GitHub APIからリポジトリリストを取得
 */
async function fetchGitHubRepositories(accessToken: string): Promise<Repository[]> {
  const repositories: Repository[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      {
        headers: {
          'Authorization': `token ${accessToken}`,
          'User-Agent': 'agentapi-ui',
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const repos = await response.json()

    if (!Array.isArray(repos) || repos.length === 0) {
      break
    }

    repositories.push(...repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url
      },
      description: repo.description,
      private: repo.private,
      html_url: repo.html_url,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      default_branch: repo.default_branch
    })))

    if (repos.length < perPage) {
      break
    }

    page++

    // 無限ループ防止（最大10ページ = 1000リポジトリ）
    if (page > 10) {
      console.warn('Reached maximum page limit (10 pages)')
      break
    }
  }

  return repositories
}

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
      // Get API key from cookie for authentication
      const apiKey = await getApiKeyFromCookie()
      if (apiKey) {
        const client = new AgentAPIProxyClient({
          baseURL: process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080',
          apiKey: apiKey,
          debug: true,
        })
        proxyUserInfo = await client.getUserInfo()
      }
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
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${sessionData.accessToken}`,
            'User-Agent': 'agentapi-ui'
          }
        })

        if (userResponse.ok) {
          const githubUser = await userResponse.json()

          // リポジトリ情報を取得
          let repositories: Repository[] | undefined
          try {
            repositories = await fetchGitHubRepositories(sessionData.accessToken)
          } catch (repoErr) {
            console.error('Failed to fetch repositories:', repoErr)
            // リポジトリ取得に失敗してもユーザー情報は返す
          }

          const userInfo: UserInfo = {
            type: 'github',
            user: {
              id: githubUser.id,
              login: githubUser.login,
              name: githubUser.name,
              email: githubUser.email,
              avatar_url: githubUser.avatar_url
            },
            proxy: proxyUserInfo,
            repositories
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
