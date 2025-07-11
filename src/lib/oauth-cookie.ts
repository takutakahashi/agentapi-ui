import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const OAUTH_COOKIE_NAME = 'agentapi_oauth_session';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

interface OAuthSession {
  sessionId: string;
  accessToken: string;
  profileId: string;
  expiresAt: string;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.COOKIE_ENCRYPTION_SECRET;
  if (!secret) {
    console.error('COOKIE_ENCRYPTION_SECRET environment variable is not set. OAuth cookie authentication will not work.');
    throw new Error('COOKIE_ENCRYPTION_SECRET environment variable is required');
  }
  if (secret.length !== 64) {
    console.error(`COOKIE_ENCRYPTION_SECRET length is ${secret.length}, but must be exactly 64 hex characters (32 bytes).`);
    throw new Error('COOKIE_ENCRYPTION_SECRET must be exactly 32 bytes (64 hex characters)');
  }
  return Buffer.from(secret, 'hex');
}

export function encryptOAuthSession(session: OAuthSession): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const sessionJson = JSON.stringify(session);
  let encrypted = cipher.update(sessionJson, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Combine iv + tag + encrypted data
  const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
  return combined.toString('base64');
}

export function decryptOAuthSession(encryptedData: string): OAuthSession {
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
  
  return JSON.parse(decrypted);
}

export async function setOAuthSessionCookie(session: OAuthSession): Promise<void> {
  const encryptedSession = encryptOAuthSession(session);
  const cookieStore = await cookies();
  
  // Calculate maxAge from expiresAt
  const expiresAt = new Date(session.expiresAt);
  const now = new Date();
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  
  cookieStore.set(OAUTH_COOKIE_NAME, encryptedSession, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: maxAge || 24 * 60 * 60, // Default to 24 hours if calculation fails
    path: '/',
  });
}

export async function getOAuthSessionFromCookie(): Promise<OAuthSession | null> {
  try {
    const cookieStore = await cookies();
    const encryptedSession = cookieStore.get(OAUTH_COOKIE_NAME)?.value;
    
    if (!encryptedSession) {
      return null;
    }
    
    const session = decryptOAuthSession(encryptedSession);
    
    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await deleteOAuthSessionCookie();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Failed to decrypt OAuth session from cookie:', error);
    
    // If there's an error with the encryption key setup, provide more context
    if (error instanceof Error && error.message.includes('COOKIE_ENCRYPTION_SECRET')) {
      console.error('OAuth cookie authentication is not properly configured. Please set COOKIE_ENCRYPTION_SECRET environment variable.');
    }
    
    return null;
  }
}

export async function deleteOAuthSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  // Set the cookie with maxAge=0 to ensure it's deleted
  cookieStore.set(OAUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

// Helper function to get OAuth session for a specific profile
export async function getOAuthSessionForProfile(profileId: string): Promise<OAuthSession | null> {
  const session = await getOAuthSessionFromCookie();
  
  if (!session || session.profileId !== profileId) {
    return null;
  }
  
  return session;
}