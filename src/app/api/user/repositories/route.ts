import { NextRequest, NextResponse } from 'next/server'
import { decryptCookie } from '@/lib/cookie-encryption'

export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('agentapi_token')?.value

    if (!authToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    try {
      const decryptedData = decryptCookie(authToken)
      const sessionData = JSON.parse(decryptedData)

      // GitHub OAuth認証の場合のみリポジトリを取得
      if (sessionData.sessionId && sessionData.accessToken) {
        const searchParams = request.nextUrl.searchParams
        const perPage = searchParams.get('per_page') || '100'
        const sort = searchParams.get('sort') || 'updated'
        const affiliation = searchParams.get('affiliation') || 'owner,collaborator,organization_member'

        // GitHub APIからリポジトリ一覧を取得
        const response = await fetch(
          `https://api.github.com/user/repos?per_page=${perPage}&sort=${sort}&affiliation=${affiliation}`,
          {
            headers: {
              'Authorization': `token ${sessionData.accessToken}`,
              'User-Agent': 'agentapi-ui',
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        )

        if (response.ok) {
          const repos = await response.json()
          // owner/name 形式のリポジトリ名リストに変換
          const repositoryList = repos.map((repo: { full_name: string }) => repo.full_name)
          return NextResponse.json({ repositories: repositoryList })
        }

        return NextResponse.json(
          { error: 'Failed to fetch repositories from GitHub' },
          { status: response.status }
        )
      }
    } catch (err) {
      console.error('Failed to decrypt session data or fetch repositories:', err)
    }

    // APIキー認証の場合はリポジトリ一覧を返せない
    return NextResponse.json(
      { error: 'Repository list is only available for GitHub OAuth users' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Repository list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
