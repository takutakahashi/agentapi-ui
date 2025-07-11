import { NextRequest, NextResponse } from 'next/server';
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client';
import { ProfileManager } from '@/utils/profileManager';
import { setOAuthSessionCookie } from '@/lib/oauth-cookie';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const profileId = searchParams.get('profileId');

    if (!code || !state) {
      return new NextResponse(createErrorHTML('Missing required parameters'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Profile ID is passed as a query parameter from the redirect URI
    if (!profileId) {
      return new NextResponse(createErrorHTML('Profile ID not found'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const client = createAgentAPIProxyClientFromStorage(undefined, profileId);
    
    // Exchange code for session
    const sessionResponse = await client.exchangeOAuthCode(code, state);

    // Store OAuth session in encrypted cookie
    await setOAuthSessionCookie({
      sessionId: sessionResponse.sessionId,
      accessToken: sessionResponse.accessToken,
      profileId: profileId,
      expiresAt: sessionResponse.expiresAt.toISOString()
    });

    // Update profile with OAuth session information
    ProfileManager.updateProfile(profileId, {
      githubAuth: {
        enabled: true,
        sessionId: sessionResponse.sessionId,
        user: sessionResponse.user,
        scopes: [],
        organizations: [],
        repositories: [],
        expiresAt: sessionResponse.expiresAt.toISOString()
      }
    });

    return new NextResponse(createSuccessHTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'OAuth callback failed';
    
    return new NextResponse(createErrorHTML(errorMessage), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}


function createSuccessHTML(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>GitHub Authentication Success</title>
        <style>
          body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
          .container { text-align: center; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .success { color: #10b981; font-size: 3rem; margin-bottom: 1rem; }
          h1 { color: #1f2937; margin: 0 0 0.5rem 0; }
          p { color: #6b7280; margin: 0; }
        </style>
        <script>
          // Notify parent window
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth-success' }, '*');
            setTimeout(() => window.close(), 1500);
          } else {
            // Redirect to profiles page
            setTimeout(() => window.location.href = '/profiles', 1500);
          }
        </script>
      </head>
      <body>
        <div class="container">
          <div class="success">✓</div>
          <h1>Authentication Successful!</h1>
          <p>This window will close automatically.</p>
        </div>
      </body>
    </html>
  `;
}

function createErrorHTML(error: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>GitHub Authentication Error</title>
        <style>
          body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
          .container { text-align: center; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; }
          .error { color: #ef4444; font-size: 3rem; margin-bottom: 1rem; }
          h1 { color: #1f2937; margin: 0 0 0.5rem 0; }
          p { color: #6b7280; margin: 0 0 1rem 0; }
          button { background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
          button:hover { background: #dc2626; }
        </style>
        <script>
          // Notify parent window
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth-error', error: '${error.replace(/'/g, "\\'")}' }, '*');
          }
        </script>
      </head>
      <body>
        <div class="container">
          <div class="error">✗</div>
          <h1>Authentication Failed</h1>
          <p>${error}</p>
          <button onclick="window.close()">Close</button>
        </div>
      </body>
    </html>
  `;
}