import { NextRequest, NextResponse } from 'next/server';
import { setApiKeyCookie } from '@/lib/cookie-auth';

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

    const { apiKey } = await request.json();
    
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Validate API key format (basic validation)
    // Most API keys are at least 20 characters, but we'll be lenient
    if (apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key cannot be empty' },
        { status: 400 }
      );
    }

    // Validate API key with proxy server
    // In single profile mode, this should be enabled by default for security
    const validateWithProxy = process.env.VALIDATE_API_KEY_WITH_PROXY !== 'false';
    
    if (validateWithProxy) {
      // デフォルトでローカルの /api/proxy を使用（サーバーサイドでは絶対URLが必要）
      const baseUrl = process.env.AGENTAPI_PROXY_URL || 
        (process.env.NODE_ENV === 'production' 
          ? `https://${request.headers.get('host')}` 
          : 'http://localhost:3000')
      const proxyUrl = baseUrl.endsWith('/api/proxy') ? baseUrl : `${baseUrl}/api/proxy`;
      try {
        console.log(`[Auth] Validating API key with proxy: ${proxyUrl}`);
        
        const testResponse = await fetch(`${proxyUrl}/health`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(10000), // Increased timeout for better reliability
        });

        if (!testResponse.ok) {
          if (testResponse.status === 401 || testResponse.status === 403) {
            console.log(`[Auth] API key validation failed: ${testResponse.status}`);
            return NextResponse.json(
              { error: 'Invalid or unauthorized API key' },
              { status: 401 }
            );
          }
          
          // Log non-auth errors but don't fail the login
          console.warn(`[Auth] Proxy health check returned ${testResponse.status}, continuing with login`);
        } else {
          console.log('[Auth] API key validation successful');
        }
      } catch (error) {
        // In single profile mode, we should be more strict about validation
        console.error('[Auth] API key validation with proxy failed:', error);
        
        // Check if this is a timeout or network error
        if (error instanceof Error && 
            (error.name === 'TimeoutError' || error.message.includes('timeout'))) {
          return NextResponse.json(
            { error: 'Proxy server timeout during authentication. Please try again.' },
            { status: 503 }
          );
        }
        
        // For other errors, log but continue - the actual API calls will fail if key is invalid
        console.warn('[Auth] Continuing with login despite validation error');
      }
    } else {
      console.log('[Auth] API key validation with proxy is disabled');
    }

    // Set the encrypted API key in a secure cookie
    await setApiKeyCookie(apiKey);

    return NextResponse.json(
      { message: 'Successfully logged in' },
      { status: 200 }
    );
  } catch (loginError) {
    console.error('Login error:', loginError);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}