import { NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';
import { getEncryptionService } from '@/lib/encryption';

export async function GET() {
  try {
    // Check if API key exists in cookie
    const apiKey = await getApiKeyFromCookie();
    const authenticated = !!apiKey;

    // Calculate token hash if authenticated
    let tokenHash = null;
    if (authenticated && apiKey) {
      try {
        const encryptionService = getEncryptionService();
        tokenHash = encryptionService.hashApiToken(apiKey);
      } catch (err) {
        console.error('Failed to hash API token:', err);
      }
    }

    return NextResponse.json(
      {
        authenticated,
        tokenHash,
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