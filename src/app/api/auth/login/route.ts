import { NextRequest, NextResponse } from 'next/server';
import { setApiKeyCookie } from '@/lib/cookie-auth';

export async function POST(request: NextRequest) {
  try {
    // Check if single profile mode is enabled
    const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true';
    
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
    if (apiKey.length < 10) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      );
    }

    // Test the API key by making a health check request
    const proxyUrl = process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080';
    try {
      const testResponse = await fetch(`${proxyUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!testResponse.ok) {
        return NextResponse.json(
          { error: 'Invalid API key or server unavailable' },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error('API key validation failed:', error);
      return NextResponse.json(
        { error: 'Unable to validate API key - server unavailable' },
        { status: 503 }
      );
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