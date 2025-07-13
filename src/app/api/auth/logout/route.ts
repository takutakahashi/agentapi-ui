import { NextResponse, NextRequest } from 'next/server';
import { deleteApiKeyCookie } from '@/lib/cookie-auth';
import { decryptCookie } from '@/lib/cookie-encryption';

export async function POST(request: NextRequest) {
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

    // Check if this is a GitHub OAuth session
    const authToken = request.cookies.get('agentapi_token')?.value;
    if (authToken) {
      try {
        const decryptedData = decryptCookie(authToken);
        const sessionData = JSON.parse(decryptedData);
        
        // If it's a GitHub OAuth session, revoke it on the proxy
        if (sessionData.sessionId) {
          const proxyEndpoint = process.env.AGENTAPI_PROXY_ENDPOINT || 'http://localhost:8080';
          await fetch(`${proxyEndpoint}/oauth/logout`, {
            method: 'POST',
            headers: {
              'X-Session-ID': sessionData.sessionId,
            },
          });
        }
      } catch (err) {
        // If decryption fails, it might be an old API key cookie
        console.error('Failed to decrypt session data:', err);
      }
    }

    // Delete the API key cookie
    await deleteApiKeyCookie();

    return NextResponse.json(
      { message: 'Successfully logged out' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}