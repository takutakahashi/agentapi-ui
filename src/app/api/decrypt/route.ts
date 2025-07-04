import { NextRequest, NextResponse } from 'next/server';
import { getEncryptionService } from '@/lib/encryption';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { encryptedData, iv, timestamp, apiTokenHash } = body;

    if (!encryptedData || !iv || !timestamp || !apiTokenHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get API token from cookie
    const apiToken = await getApiKeyFromCookie();
    
    if (!apiToken) {
      return NextResponse.json(
        { error: 'API token not found in cookies' },
        { status: 401 }
      );
    }

    // Calculate current API token hash
    const encryptionService = getEncryptionService();
    const currentTokenHash = encryptionService.hashApiToken(apiToken);

    // Decrypt the data
    const decrypted = encryptionService.decrypt(
      { encryptedData, iv, timestamp, apiTokenHash },
      currentTokenHash
    );

    return NextResponse.json({ data: decrypted });
  } catch (error) {
    console.error('Decryption error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'API token hash mismatch') {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid API token' },
          { status: 401 }
        );
      }
      if (error.message === 'Encrypted data has expired') {
        return NextResponse.json(
          { error: 'Encrypted data has expired' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to decrypt data' },
      { status: 500 }
    );
  }
}