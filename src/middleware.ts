import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Construct the public-facing base URL from the request.
 * Prefers X-Forwarded-* headers set by the ingress/proxy over the raw
 * request URL, which may contain an internal port (e.g. 3001).
 */
function getPublicOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedProto && forwardedHost) {
    // x-forwarded-proto can be a comma-separated list; take the first value
    const proto = forwardedProto.split(',')[0].trim()
    return `${proto}://${forwardedHost}`
  }
  // Fall back to the request's own origin (works in local dev)
  return request.nextUrl.origin
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip auth if DISABLE_AUTH is set
  if (process.env.DISABLE_AUTH === 'true') {
    return NextResponse.next()
  }

  // Allow access to login page, API routes and static assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next()
  }

  // Check if user has auth token
  const authToken = request.cookies.get('agentapi_token')

  if (!authToken) {
    // Redirect to login using the public-facing origin (not the internal port)
    const loginUrl = new URL('/login', getPublicOrigin(request))
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest - legacy)
     * - manifest.webmanifest (PWA manifest - dynamic)
     * - icons/ (icon files)
     *
     * Note: /s/* (shared session pages) requires authentication
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|icons/).*)',
  ],
}