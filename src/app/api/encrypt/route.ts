import { NextRequest, NextResponse } from 'next/server';
import { getEncryptionService } from '@/lib/encryption';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, apiTokenHash } = body;

    if (!data || !apiTokenHash) {
      return NextResponse.json(
        { error: 'Missing required fields: data and apiTokenHash' },
        { status: 400 }
      );
    }

    // Get API token from cookie for verification
    const apiToken = await getApiKeyFromCookie();
    
    if (!apiToken) {
      return NextResponse.json(
        { error: 'API token not found in cookies' },
        { status: 401 }
      );
    }

    // Verify API token hash
    const encryptionService = getEncryptionService();
    const currentTokenHash = encryptionService.hashApiToken(apiToken);
    
    if (currentTokenHash !== apiTokenHash) {
      return NextResponse.json(
        { error: 'API token hash mismatch' },
        { status: 401 }
      );
    }

    // Encrypt the data
    const encrypted = encryptionService.encrypt(data, apiTokenHash);

    return NextResponse.json(encrypted);
  } catch (error) {
    console.error('Encryption error:', error);
    return NextResponse.json(
      { error: 'Failed to encrypt data' },
      { status: 500 }
    );
  }
}