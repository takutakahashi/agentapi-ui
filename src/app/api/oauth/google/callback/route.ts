import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_SCIA_INTERNAL_URL = 'http://scia-oauth.agentapi-ui-dev.svc.cluster.local:8081'
const DEFAULT_COMPLETE_PATH = '/settings/personal?google_oauth=connected'

export async function GET(request: NextRequest) {
  const sciaBaseUrl = (process.env.SCIA_OAUTH_INTERNAL_URL || DEFAULT_SCIA_INTERNAL_URL).replace(/\/$/, '')
  const completePath = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_COMPLETE_PATH || DEFAULT_COMPLETE_PATH
  const callbackUrl = `${sciaBaseUrl}/oauth/google/callback${request.nextUrl.search}`

  const response = await fetch(callbackUrl, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    return new NextResponse(text || 'Google OAuth callback failed', {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'text/plain; charset=utf-8',
      },
    })
  }

  return NextResponse.redirect(new URL(completePath, request.url))
}
