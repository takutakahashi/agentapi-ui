import { NextRequest, NextResponse } from 'next/server'
import { decryptCookie } from '@/lib/cookie-encryption'
import { Repository } from '@/types/repository'

// キャッシュの型定義
interface CacheEntry {
  data: Repository[]
  timestamp: number
}

// メモリ内キャッシュ（3分）
const cache = new Map<string, CacheEntry>()
const CACHE_DURATION = 3 * 60 * 1000 // 3分（ミリ秒）

/**
 * キャッシュをクリアする関数（古いエントリを削除）
 */
function cleanupCache() {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      cache.delete(key)
    }
  }
}

/**
 * GitHub APIからリポジトリリストを取得
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('agentapi_token')?.value

    if (!authToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // セッションデータをデクリプト
    let accessToken: string | null = null
    try {
      const decryptedData = decryptCookie(authToken)
      const sessionData = JSON.parse(decryptedData)
      accessToken = sessionData.accessToken
    } catch (err) {
      console.error('Failed to decrypt session data:', err)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GitHub access token not found' },
        { status: 401 }
      )
    }

    // キャッシュキーを生成（アクセストークンのハッシュを使用）
    const cacheKey = `repos:${accessToken.substring(0, 10)}`

    // キャッシュをチェック
    const now = Date.now()
    const cachedEntry = cache.get(cacheKey)
    if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION) {
      console.log('Returning cached repository list')
      return NextResponse.json({
        repositories: cachedEntry.data,
        cached: true,
        cachedAt: new Date(cachedEntry.timestamp).toISOString()
      })
    }

    // GitHub APIからリポジトリリストを取得
    console.log('Fetching repositories from GitHub API')
    const repositories = await fetchAllRepositories(accessToken)

    // キャッシュに保存
    cache.set(cacheKey, {
      data: repositories,
      timestamp: now
    })

    // 古いキャッシュエントリをクリーンアップ
    cleanupCache()

    return NextResponse.json({
      repositories,
      cached: false,
      cachedAt: new Date(now).toISOString()
    })
  } catch (error) {
    console.error('Repository fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}

/**
 * すべてのリポジトリを取得（ページネーション対応）
 */
async function fetchAllRepositories(accessToken: string): Promise<Repository[]> {
  const repositories: Repository[] = []
  let page = 1
  const perPage = 100 // GitHub APIの最大値

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

    repositories.push(...repos)

    // 次のページがあるかチェック
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

  return repositories.map(repo => ({
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
  }))
}
