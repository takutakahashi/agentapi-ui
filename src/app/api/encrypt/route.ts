import { NextRequest, NextResponse } from 'next/server';
import { getEncryptionService } from '@/lib/encryption';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';
import { encryptForAPI } from '@/lib/encryption-api';

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

    // Calculate API token hash
    const encryptionService = getEncryptionService();
    const apiTokenHash = encryptionService.hashApiToken(apiToken);

    // Decrypt the base64 input data to get the original string
    const decodedData = Buffer.from(data, 'base64').toString('utf8');
    
    // Encrypt the data using the API helper
    const encrypted = encryptForAPI(decodedData, apiTokenHash);

    return NextResponse.json({ encrypted });
  } catch (error) {
    console.error('Encryption error:', error);
    return NextResponse.json(
      { error: 'Encryption failed', code: 'ENCRYPTION_FAILED' },
      { status: 500 }
    );
  }
}