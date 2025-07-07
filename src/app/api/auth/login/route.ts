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

    // Optional: Test the API key by making a health check request
    // This can be disabled if the proxy server is not running
    const validateWithProxy = process.env.VALIDATE_API_KEY_WITH_PROXY !== 'false';
    
    if (validateWithProxy) {
      const proxyUrl = process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080';
      try {
        const testResponse = await fetch(`${proxyUrl}/health`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(5000),
        });

        if (!testResponse.ok && testResponse.status === 401) {
          return NextResponse.json(
            { error: 'Invalid API key' },
            { status: 401 }
          );
        }
      } catch (error) {
        // Log the error but don't fail the login if proxy is unavailable
        console.warn('API key validation with proxy failed:', error);
        // Continue with login anyway - the actual API calls will fail if the key is invalid
      }
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