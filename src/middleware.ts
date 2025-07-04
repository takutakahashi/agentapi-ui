import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Check if single profile mode is enabled
  const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true'
  
  if (singleProfileMode) {
    const pathname = request.nextUrl.pathname
    
    // Allow access to API routes and static assets
    if (
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/static/')
    ) {
      return NextResponse.next()
    }
    
    // Check if user has auth token
    const authToken = request.cookies.get('agentapi-auth')
    
    if (!authToken) {
      // If no auth token, redirect to home page with a query param
      // The frontend will handle showing login UI
      const url = new URL(request.url)
      url.searchParams.set('login', 'required')
      return NextResponse.redirect(url)
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