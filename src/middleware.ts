import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip auth if DISABLE_AUTH is set
  if (process.env.DISABLE_AUTH === 'true') {
    return NextResponse.next()
  }

  // Allow access to login page, API routes, static assets, and shared session pages
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/s/') ||
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
    // If no auth token, redirect to login page
    const loginUrl = new URL('/login', request.url)
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
     * Note: /s/* (shared session pages) does NOT require authentication
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|icons/).*)',
  ],
}