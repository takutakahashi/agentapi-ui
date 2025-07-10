import { NextRequest, NextResponse } from 'next/server';
import { 
  generateOAuthState, 
  getGitHubAuthorizationUrl, 
  setOAuthStateCookie 
} from '@/lib/github-oauth';

export async function GET(request: NextRequest) {
  try {
    // Check if single profile mode is enabled
    const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true' || 
                              process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true';
    
    if (!singleProfileMode) {
      return NextResponse.json(
        { error: 'Single profile mode is not enabled' },
        { status: 403 }
      );
    }

    // Generate a random state for CSRF protection
    const state = generateOAuthState();
    
    // Store state in cookie for verification during callback
    await setOAuthStateCookie(state);

    // Get the GitHub authorization URL
    const authUrl = getGitHubAuthorizationUrl(state);

    // Redirect to GitHub OAuth authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('GitHub OAuth initialization error:', error);
    
    // Redirect to login page with error
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'oauth_init_failed');
    
    return NextResponse.redirect(loginUrl);
  }
}