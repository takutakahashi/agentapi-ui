import { NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';

export async function GET() {
  try {
    // Check if API key exists in cookie
    const apiKey = await getApiKeyFromCookie();
    const authenticated = !!apiKey;

    return NextResponse.json(
      {
        authenticated,
        message: authenticated ? 'Authenticated' : 'Not authenticated'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      {
        authenticated: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
