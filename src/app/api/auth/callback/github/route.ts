import { NextRequest, NextResponse } from 'next/server';
import { 
  getOAuthStateFromCookie, 
  deleteOAuthStateCookie,
  exchangeCodeForToken,
  getGitHubUser,
  setGitHubTokenCookie
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

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('GitHub OAuth error:', error);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', `oauth_error_${error}`);
      return NextResponse.redirect(loginUrl);
    }

    // Check required parameters
    if (!code || !state) {
      console.error('Missing code or state parameter');
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'invalid_callback');
      return NextResponse.redirect(loginUrl);
    }

    // Verify state parameter (CSRF protection)
    const storedState = await getOAuthStateFromCookie();
    if (!storedState || storedState !== state) {
      console.error('Invalid state parameter');
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'invalid_state');
      return NextResponse.redirect(loginUrl);
    }

    // Clean up state cookie
    await deleteOAuthStateCookie();

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code);

    // Get user information
    const userData = await getGitHubUser(tokenData.access_token);

    // Store the GitHub token in an encrypted cookie
    await setGitHubTokenCookie(tokenData.access_token);

    console.log(`[GitHub OAuth] Successfully authenticated user: ${userData.login}`);

    // Redirect to dashboard or intended page
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth', 'success');
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    
    // Redirect to login page with error
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'oauth_callback_failed');
    
    return NextResponse.redirect(loginUrl);
  }
}