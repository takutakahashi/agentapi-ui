import { NextRequest, NextResponse } from 'next/server';
import { decryptCookie } from '@/lib/cookie-encryption';
import {
  hashToken,
  getCachedRepositories,
  setCachedRepositories,
  getCacheExpiresAt,
} from '@/lib/github-cache';
import { GitHubRepository, RepositoryListResponse, RepositoryListError } from '@/types/github';

const GITHUB_API_BASE = 'https://api.github.com';
const PER_PAGE = 100;
const MAX_PAGES = 5; // Max 500 repositories

interface GitHubApiRepository {
  id: number;
  full_name: string;
  name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  private: boolean;
  html_url: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  language: string | null;
}

async function fetchAllRepositories(accessToken: string): Promise<GitHubRepository[]> {
  const allRepos: GitHubRepository[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const response = await fetch(
      `${GITHUB_API_BASE}/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=pushed&per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          Authorization: `token ${accessToken}`,
          'User-Agent': 'agentapi-ui',
          Accept: 'application/vnd.github.v3+json',
        },
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        if (rateLimitRemaining === '0' && rateLimitReset) {
          const resetTime = parseInt(rateLimitReset, 10);
          const retryAfter = Math.max(0, resetTime - Math.floor(Date.now() / 1000));
          throw new Error(`RATE_LIMITED:${retryAfter}`);
        }
      }
      throw new Error(`GITHUB_API_ERROR:${response.status}`);
    }

    const repos: GitHubApiRepository[] = await response.json();

    if (repos.length === 0) {
      break;
    }

    allRepos.push(
      ...repos.map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        name: repo.name,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        stargazers_count: repo.stargazers_count,
        language: repo.language,
      }))
    );

    if (repos.length < PER_PAGE) {
      break;
    }

    page++;
  }

  return allRepos;
}

function filterRepositories(repositories: GitHubRepository[], query: string): GitHubRepository[] {
  if (!query || !query.trim()) {
    return repositories;
  }

  const lowerQuery = query.toLowerCase().trim();
  return repositories.filter((repo) => repo.full_name.toLowerCase().includes(lowerQuery));
}

export async function GET(request: NextRequest): Promise<NextResponse<RepositoryListResponse | RepositoryListError>> {
  try {
    const authToken = request.cookies.get('agentapi_token')?.value;
    console.log('[GitHub Repositories] Cookie exists:', !!authToken);

    if (!authToken) {
      console.log('[GitHub Repositories] No auth token found');
      return NextResponse.json(
        {
          error: 'Not authenticated',
          code: 'NO_GITHUB_TOKEN',
          message: 'ログインしてください',
        },
        { status: 401 }
      );
    }

    // Try to extract GitHub access token from the cookie
    let accessToken: string | null = null;

    try {
      const decryptedData = decryptCookie(authToken);
      console.log('[GitHub Repositories] Cookie decrypted successfully');
      const sessionData = JSON.parse(decryptedData);
      console.log('[GitHub Repositories] Session data keys:', Object.keys(sessionData));

      if (sessionData.sessionId && sessionData.accessToken) {
        accessToken = sessionData.accessToken;
        console.log('[GitHub Repositories] GitHub access token found');
      } else {
        console.log('[GitHub Repositories] No GitHub OAuth session (sessionId or accessToken missing)');
      }
    } catch (decryptError) {
      // Not a GitHub OAuth session, return empty result gracefully
      console.log('[GitHub Repositories] Cookie decryption failed (likely API key auth):', decryptError);
      return NextResponse.json({
        repositories: [],
        cached: false,
      });
    }

    if (!accessToken) {
      // API key auth, no GitHub token available
      console.log('[GitHub Repositories] No access token, returning empty result');
      return NextResponse.json({
        repositories: [],
        cached: false,
      });
    }

    const tokenHash = hashToken(accessToken);
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    console.log('[GitHub Repositories] Query:', query);

    // Check cache first
    let repositories = getCachedRepositories(tokenHash);
    let cached = false;

    if (repositories) {
      cached = true;
      console.log('[GitHub Repositories] Cache hit, repos count:', repositories.length);
    } else {
      // Fetch from GitHub API
      console.log('[GitHub Repositories] Cache miss, fetching from GitHub API...');
      repositories = await fetchAllRepositories(accessToken);
      console.log('[GitHub Repositories] Fetched repos count:', repositories.length);
      setCachedRepositories(tokenHash, repositories);
    }

    // Apply filter
    const filteredRepositories = filterRepositories(repositories, query);

    const cacheExpiresAt = getCacheExpiresAt(tokenHash);

    return NextResponse.json({
      repositories: filteredRepositories,
      cached,
      cache_expires_at: cacheExpiresAt?.toISOString(),
    });
  } catch (error) {
    console.error('GitHub repositories error:', error);

    if (error instanceof Error) {
      if (error.message === 'UNAUTHORIZED') {
        return NextResponse.json(
          {
            error: 'GitHub token is invalid or expired',
            code: 'NO_GITHUB_TOKEN',
            message: 'GitHubトークンが無効です。再ログインしてください。',
          },
          { status: 401 }
        );
      }

      if (error.message.startsWith('RATE_LIMITED:')) {
        const retryAfter = parseInt(error.message.split(':')[1], 10);
        return NextResponse.json(
          {
            error: 'GitHub API rate limit exceeded',
            code: 'RATE_LIMITED',
            message: `GitHub APIのレート制限に達しました。${retryAfter}秒後に再試行してください。`,
            retry_after: retryAfter,
          },
          { status: 429 }
        );
      }

      if (error.message.startsWith('GITHUB_API_ERROR:')) {
        return NextResponse.json(
          {
            error: 'GitHub API error',
            code: 'GITHUB_API_ERROR',
            message: 'GitHubからリポジトリを取得できませんでした。',
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: '予期しないエラーが発生しました。',
      },
      { status: 500 }
    );
  }
}
