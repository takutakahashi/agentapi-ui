import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_SCIA_INTERNAL_URL = 'http://scia-oauth.agentapi-ui-dev.svc.cluster.local:8081'
const DEFAULT_COMPLETE_PATH = '/integrations?notion_oauth=connected'

export async function GET(request: NextRequest) {
  const sciaBaseUrl = (process.env.SCIA_OAUTH_INTERNAL_URL || DEFAULT_SCIA_INTERNAL_URL).replace(/\/$/, '')
  const completePath = process.env.NEXT_PUBLIC_NOTION_OAUTH_COMPLETE_PATH || DEFAULT_COMPLETE_PATH
  const publicBaseUrl = getPublicBaseUrl(request)
  const callbackUrl = `${sciaBaseUrl}/oauth/notion/callback${request.nextUrl.search}`

  const response = await fetch(callbackUrl, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    return new NextResponse(text || 'Notion OAuth callback failed', {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'text/plain; charset=utf-8',
      },
    })
  }

  return NextResponse.redirect(new URL(completePath, publicBaseUrl))
}

function getPublicBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')
  if (host && !host.startsWith('0.0.0.0')) {
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    return `${proto}://${host}`
  }

  return 'https://cc-dev.takutakahashi.dev'
}
