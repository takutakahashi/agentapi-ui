import { NextRequest, NextResponse } from 'next/server'

/**
 * GitHub リポジトリリストを取得
 * /api/user/info から取得したリポジトリ情報を返す
 */
export async function GET(request: NextRequest) {
  try {
    // /api/user/info からユーザー情報（リポジトリ情報を含む）を取得
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.NODE_ENV === 'production'
        ? `https://${request.headers.get('host')}`
        : 'http://localhost:3000')

    const userInfoResponse = await fetch(`${baseUrl}/api/user/info`, {
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      }
    })

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json().catch(() => ({ error: 'Failed to authenticate' }))
      return NextResponse.json(
        errorData,
        { status: userInfoResponse.status }
      )
    }

    const userInfo = await userInfoResponse.json()

    if (!userInfo.repositories) {
      return NextResponse.json(
        {
          error: 'No repositories available',
          details: 'GitHub OAuth is required to access repositories'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      repositories: userInfo.repositories,
      cached: false,
      cachedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Repository fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}
