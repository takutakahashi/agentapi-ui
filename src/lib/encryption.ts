import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
// const SALT_LENGTH = 32; // Currently unused

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  timestamp: number;
  apiTokenHash: string;
}

export class EncryptionService {
  private encryptionKey: Buffer;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    
    this.encryptionKey = Buffer.from(key, 'base64');
    if (this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits)');
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: unknown, apiTokenHash: string): EncryptedData {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    
    const jsonData = JSON.stringify(data);
    const encrypted = Buffer.concat([
      cipher.update(jsonData, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, tag]);
    
    return {
      encryptedData: combined.toString('base64'),
      iv: iv.toString('base64'),
      timestamp: Date.now(),
      apiTokenHash
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData: EncryptedData, currentApiTokenHash: string): unknown {
    // Verify API token hash
    if (encryptedData.apiTokenHash !== currentApiTokenHash) {
      throw new Error('API token hash mismatch');
    }
    
    // Check timestamp (optional timeout)
    const timeout = process.env.ENCRYPTION_TIMEOUT ? parseInt(process.env.ENCRYPTION_TIMEOUT) * 1000 : null;
    if (timeout && Date.now() - encryptedData.timestamp > timeout) {
      throw new Error('Encrypted data has expired');
    }
    
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const combined = Buffer.from(encryptedData.encryptedData, 'base64');
    
    if (combined.length < TAG_LENGTH) {
      throw new Error('Invalid encrypted data');
    }
    
    const encrypted = combined.slice(0, -TAG_LENGTH);
    const tag = combined.slice(-TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Generate SHA256 hash of API token
   */
  hashApiToken(apiToken: string): string {
    return crypto.createHash('sha256').update(apiToken).digest('hex');
  }
}

// Singleton instance
let encryptionService: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionService) {
    encryptionService = new EncryptionService();
  }
  return encryptionService;
}