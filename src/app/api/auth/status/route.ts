import { NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';

export async function GET() {
  try {
    // Check if single profile mode is enabled
    const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true';
    
    if (!singleProfileMode) {
      return NextResponse.json(
        { 
          singleProfileMode: false,
          authenticated: false,
          message: 'Single profile mode is not enabled'
        },
        { status: 200 }
      );
    }

    // Check if API key exists in cookie
    const apiKey = await getApiKeyFromCookie();
    const authenticated = !!apiKey;

    return NextResponse.json(
      { 
        singleProfileMode: true,
        authenticated,
        message: authenticated ? 'Authenticated' : 'Not authenticated'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { 
        singleProfileMode: false,
        authenticated: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}