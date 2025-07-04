import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Check if single profile mode is enabled
  const singleProfileMode = process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true'
  
  if (singleProfileMode) {
    const pathname = request.nextUrl.pathname
    
    // Allow access to login, API routes, and static assets
    if (
      pathname.startsWith('/login') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/static/')
    ) {
      return NextResponse.next()
    }
    
    // Check authentication status
    const authToken = request.cookies.get('auth-token')
    
    if (!authToken) {
      // Redirect to login if not authenticated
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}