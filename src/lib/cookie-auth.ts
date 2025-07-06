import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'agentapi_token';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.COOKIE_ENCRYPTION_SECRET;
  if (!secret) {
    console.error('COOKIE_ENCRYPTION_SECRET environment variable is not set. Cookie authentication will not work.');
    throw new Error('COOKIE_ENCRYPTION_SECRET environment variable is required');
  }
  if (secret.length !== 64) {
    console.error(`COOKIE_ENCRYPTION_SECRET length is ${secret.length}, but must be exactly 64 hex characters (32 bytes).`);
    throw new Error('COOKIE_ENCRYPTION_SECRET must be exactly 32 bytes (64 hex characters)');
  }
  return Buffer.from(secret, 'hex');
}

export function encryptApiKey(apiKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Combine iv + tag + encrypted data
  const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
  return combined.toString('base64');
}

export function decryptApiKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export async function setApiKeyCookie(apiKey: string): Promise<void> {
  const encryptedApiKey = encryptApiKey(apiKey);
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, encryptedApiKey, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });
}

export async function getApiKeyFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const encryptedApiKey = cookieStore.get(COOKIE_NAME)?.value;
    
    if (!encryptedApiKey) {
      console.warn('No agentapi_token cookie found');
      return null;
    }
    
    return decryptApiKey(encryptedApiKey);
  } catch (error) {
    console.error('Failed to decrypt API key from cookie:', error);
    
    // If there's an error with the encryption key setup, provide more context
    if (error instanceof Error && error.message.includes('COOKIE_ENCRYPTION_SECRET')) {
      console.error('Cookie authentication is not properly configured. Please set COOKIE_ENCRYPTION_SECRET environment variable.');
    }
    
    return null;
  }
}

export async function deleteApiKeyCookie(): Promise<void> {
  const cookieStore = await cookies();
  // Set the cookie with maxAge=0 to ensure it's deleted
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}