/**
 * Web Crypto APIを使用した安全な暗号化ストレージ
 * AES-GCM 256bit + PBKDF2キー導出による暗号化
 */

const CRYPTO_CONFIG = {
  keyDerivation: {
    name: 'PBKDF2',
    iterations: 100000,
    hash: 'SHA-256',
  },
  encryption: {
    name: 'AES-GCM',
    length: 256,
    ivLength: 12,
  },
  saltLength: 16,
} as const;

interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
}

export class CryptoStorage {
  private static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'crypto' in window && 
           'subtle' in window.crypto;
  }

  static async isEncryptionEnabled(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }
    
    try {
      const enabled = localStorage.getItem('agentapi-encryption-enabled');
      return enabled === 'true';
    } catch {
      return false;
    }
  }

  static async enableEncryption(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API is not supported in this browser');
    }
    
    localStorage.setItem('agentapi-encryption-enabled', 'true');
  }

  static async disableEncryption(): Promise<void> {
    localStorage.removeItem('agentapi-encryption-enabled');
  }

  /**
   * マスターパスワードから暗号化キーを導出
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: CRYPTO_CONFIG.keyDerivation.name },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: CRYPTO_CONFIG.keyDerivation.name,
        salt,
        iterations: CRYPTO_CONFIG.keyDerivation.iterations,
        hash: CRYPTO_CONFIG.keyDerivation.hash,
      },
      keyMaterial,
      {
        name: CRYPTO_CONFIG.encryption.name,
        length: CRYPTO_CONFIG.encryption.length,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * データを暗号化
   */
  static async encrypt(data: string, password: string): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API is not supported');
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // ランダムなソルトとIVを生成
    const salt = window.crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.saltLength));
    const iv = window.crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.encryption.ivLength));

    // キーを導出
    const key = await this.deriveKey(password, salt);

    // データを暗号化
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: CRYPTO_CONFIG.encryption.name,
        iv,
      },
      key,
      dataBuffer
    );

    // Base64エンコードして保存用フォーマットに変換
    const encryptedData: EncryptedData = {
      data: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt)),
    };

    return JSON.stringify(encryptedData);
  }

  /**
   * データを復号化
   */
  static async decrypt(encryptedDataStr: string, password: string): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API is not supported');
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(encryptedDataStr);

      // Base64デコード
      const dataBuffer = new Uint8Array(
        atob(encryptedData.data).split('').map(c => c.charCodeAt(0))
      );
      const iv = new Uint8Array(
        atob(encryptedData.iv).split('').map(c => c.charCodeAt(0))
      );
      const salt = new Uint8Array(
        atob(encryptedData.salt).split('').map(c => c.charCodeAt(0))
      );

      // キーを導出
      const key = await this.deriveKey(password, salt);

      // データを復号化
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: CRYPTO_CONFIG.encryption.name,
          iv,
        },
        key,
        dataBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Decryption failed: ${error.message}`);
      }
      throw new Error('Decryption failed: Unknown error');
    }
  }

  /**
   * パスワードの強度をチェック
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 暗号化されたデータかどうかを判定
   */
  static isEncryptedData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === 'object' && 
             'data' in parsed && 
             'iv' in parsed && 
             'salt' in parsed;
    } catch {
      return false;
    }
  }
}