// Web Crypto API based encryption utilities

interface EncryptionService {
  encryptValue(value: string): Promise<string>;
  decryptValue(): Promise<string>;
  isEncrypted(value: string): boolean;
  getPublicKey(): Promise<string>;
  isEnabled(): Promise<boolean>;
}

class AgentAPIProxyEncryption implements EncryptionService {
  private publicKey: string | null = null;
  private publicKeyCache: { key: string; expiry: number } | null = null;
  private readonly cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(private proxyEndpoint: string) {}

  async isEnabled(): Promise<boolean> {
    try {
      const response = await fetch(`${this.proxyEndpoint}/encryption.pub`, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain'
        }
      });
      return response.ok;
    } catch (error) {
      console.debug('Encryption not available:', error);
      return false;
    }
  }

  async getPublicKey(): Promise<string> {
    const now = Date.now();
    
    // Use cached key if still valid
    if (this.publicKeyCache && now < this.publicKeyCache.expiry) {
      return this.publicKeyCache.key;
    }

    try {
      const response = await fetch(`${this.proxyEndpoint}/encryption.pub`, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch public key: ${response.status}`);
      }

      const publicKeyPEM = await response.text();
      
      // Cache the public key
      this.publicKeyCache = {
        key: publicKeyPEM,
        expiry: now + this.cacheExpiry
      };

      return publicKeyPEM;
    } catch (error) {
      console.error('Failed to fetch public key:', error);
      throw new Error('Encryption service unavailable');
    }
  }

  async encryptValue(value: string): Promise<string> {
    if (!value || value.trim() === '') {
      return value;
    }

    try {
      const publicKeyPEM = await this.getPublicKey();
      
      // Import the public key for encryption
      const publicKey = await this.importPublicKey(publicKeyPEM);
      
      // Encrypt the value using RSA-OAEP (Web Crypto API standard)
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP'
        },
        publicKey,
        data
      );

      // Convert to base64 and add encryption prefix
      const base64Encrypted = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      return `RSA:${base64Encrypted}`;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt value');
    }
  }

  async decryptValue(): Promise<string> {
    // Decryption is handled server-side only
    // This method is here for interface completeness
    throw new Error('Client-side decryption not supported');
  }

  isEncrypted(value: string): boolean {
    return value.startsWith('RSA:');
  }

  private async importPublicKey(publicKeyPEM: string): Promise<CryptoKey> {
    // Remove PEM headers and convert to ArrayBuffer
    const pemContents = publicKeyPEM
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\s/g, '');
    
    const binaryString = atob(pemContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );
  }
}

// Simple base64 encoding for local development (not secure, for testing only)
class LocalStorageEncryption implements EncryptionService {
  async isEnabled(): Promise<boolean> {
    return true;
  }

  async getPublicKey(): Promise<string> {
    return 'LOCAL_ENCRYPTION_KEY';
  }

  async encryptValue(value: string): Promise<string> {
    if (!value || value.trim() === '') {
      return value;
    }

    try {
      // Simple base64 encoding for development/testing
      const encoded = btoa(unescape(encodeURIComponent(value)));
      return `LOCAL:${encoded}`;
    } catch (error) {
      console.error('Local encoding failed:', error);
      throw new Error('Failed to encode value locally');
    }
  }

  async decryptValue(): Promise<string> {
    // Local decryption not implemented for client-side
    throw new Error('Local decryption not supported on client-side');
  }

  isEncrypted(value: string): boolean {
    return value.startsWith('LOCAL:');
  }
}

class EncryptionManager {
  private service: EncryptionService;

  constructor(proxyEndpoint: string, fallbackToLocal: boolean = false) {
    this.service = new AgentAPIProxyEncryption(proxyEndpoint);
    
    // Initialize fallback if needed
    if (fallbackToLocal) {
      this.initializeWithFallback();
    }
  }

  private async initializeWithFallback() {
    try {
      const isEnabled = await this.service.isEnabled();
      if (!isEnabled) {
        console.warn('AgentAPI proxy encryption not available, using local encryption');
        this.service = new LocalStorageEncryption();
      }
    } catch (error) {
      console.warn('Failed to connect to AgentAPI proxy encryption, using local encryption:', error);
      this.service = new LocalStorageEncryption();
    }
  }

  async encryptValue(value: string): Promise<string> {
    return this.service.encryptValue(value);
  }

  async decryptValue(): Promise<string> {
    return this.service.decryptValue();
  }

  isEncrypted(value: string): boolean {
    return this.service.isEncrypted(value);
  }

  async isEnabled(): Promise<boolean> {
    return this.service.isEnabled();
  }

  async getPublicKey(): Promise<string> {
    return this.service.getPublicKey();
  }
}

// Singleton instance
let encryptionManager: EncryptionManager | null = null;

export const getEncryptionManager = (proxyEndpoint: string): EncryptionManager => {
  if (!encryptionManager) {
    encryptionManager = new EncryptionManager(proxyEndpoint, true);
  }
  return encryptionManager;
};

export const resetEncryptionManager = () => {
  encryptionManager = null;
};

export type { EncryptionService };
export { EncryptionManager, AgentAPIProxyEncryption, LocalStorageEncryption };