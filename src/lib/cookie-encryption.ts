import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const algorithm = 'aes-256-gcm';
const saltLength = 32;
const tagLength = 16;
const ivLength = 16;
const keyLength = 32;

// 環境変数から暗号化キーを取得、または自動生成
function getEncryptionKey(): Buffer {
  const secret = process.env.COOKIE_SECRET || process.env.NEXT_PUBLIC_COOKIE_SECRET || 'default-secret-key-for-development-only';
  const salt = Buffer.from('agentapi-ui-cookie-salt', 'utf8');
  return scryptSync(secret, salt, keyLength);
}

export function encryptCookie(value: string): string {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(ivLength);
    const salt = randomBytes(saltLength);
    
    const cipher = createCipheriv(algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // 結合: salt + iv + tag + encrypted
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    return combined.toString('base64url');
  } catch (error) {
    console.error('Cookie encryption error:', error);
    throw new Error('Failed to encrypt cookie');
  }
}

export function decryptCookie(encryptedValue: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedValue, 'base64url');
    
    // 分解: salt + iv + tag + encrypted
    const iv = combined.subarray(saltLength, saltLength + ivLength);
    const tag = combined.subarray(saltLength + ivLength, saltLength + ivLength + tagLength);
    const encrypted = combined.subarray(saltLength + ivLength + tagLength);
    
    const decipher = createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Cookie decryption error:', error);
    throw new Error('Failed to decrypt cookie');
  }
}

// セキュアなCookieオプションを生成
export function getSecureCookieOptions(maxAge: number = 86400): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge // デフォルト: 24時間
  };
}