import { NextRequest, NextResponse } from 'next/server';
import { getEncryptionService } from '@/lib/encryption';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';
import { decryptFromAPI } from '@/lib/encryption-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json(
        { error: 'Invalid data format', code: 'INVALID_DATA' },
        { status: 400 }
      );
    }

    // Validate base64 format
    try {
      Buffer.from(data, 'base64');
    } catch {
      return NextResponse.json(
        { error: 'Data must be base64 encoded', code: 'INVALID_DATA' },
        { status: 400 }
      );
    }

    // Get API token from cookie
    const apiToken = await getApiKeyFromCookie();
    
    if (!apiToken) {
      return NextResponse.json(
        { error: 'Invalid or missing token', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Calculate current API token hash
    const encryptionService = getEncryptionService();
    const currentTokenHash = encryptionService.hashApiToken(apiToken);

    // Decrypt the data using the API helper
    const decrypted = decryptFromAPI(data, currentTokenHash);

    // Return decrypted data as base64
    const decryptedBase64 = Buffer.from(decrypted, 'utf8').toString('base64');
    return NextResponse.json({ decrypted: decryptedBase64 });
  } catch (error) {
    console.error('Decryption error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'API token hash mismatch') {
        return NextResponse.json(
          { error: 'Invalid or missing token', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      if (error.message === 'Encrypted data has expired') {
        return NextResponse.json(
          { error: 'Token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Decryption failed', code: 'DECRYPTION_FAILED' },
      { status: 500 }
    );
  }
}