import { NextResponse, NextRequest } from 'next/server';
import { deleteApiKeyCookie } from '@/lib/cookie-auth';
import { decryptCookie } from '@/lib/cookie-encryption';

export async function POST(request: NextRequest) {
  try {
    // Check if this is a GitHub OAuth session
    const authToken = request.cookies.get('agentapi_token')?.value;
    if (authToken) {
      try {
        const decryptedData = decryptCookie(authToken);
        const sessionData = JSON.parse(decryptedData);
        
        // If it's a GitHub OAuth session, revoke it on the proxy
        if (sessionData.sessionId) {
          // デフォルトでローカルの /api/proxy を使用（サーバーサイドでは絶対URLが必要）
          const baseUrl = process.env.AGENTAPI_PROXY_ENDPOINT || 
            (process.env.NODE_ENV === 'production' 
              ? `https://${request.headers.get('host')}` 
              : 'http://localhost:3000')
          const proxyEndpoint = baseUrl.endsWith('/api/proxy') ? baseUrl : `${baseUrl}/api/proxy`;
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