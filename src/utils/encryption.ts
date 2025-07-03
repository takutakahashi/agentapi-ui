/**
 * データ暗号化ユーティリティ
 * Web Crypto APIを使用した安全な暗号化機能を提供
 */

import { 
  StorageError, 
  ErrorType, 
  convertToAppError 
} from '../types/errors';
import { errorLogger } from './errorLogger';

/**
 * 暗号化設定
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  tagLength: 128,
  keyDerivation: {
    algorithm: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 100000,
    saltLength: 16
  }
} as const;

/**
 * 暗号化されたデータの形式
 */
export interface EncryptedData {
  /** 暗号化されたデータ（Base64エンコード） */
  data: string;
  /** 初期化ベクター（Base64エンコード） */
  iv: string;
  /** ソルト（Base64エンコード） */
  salt: string;
  /** 暗号化アルゴリズム */
  algorithm: string;
  /** キー導出反復回数 */
  iterations: number;
}

/**
 * 暗号化結果
 */
export type EncryptionResult = {
  success: true;
  data: EncryptedData;
} | {
  success: false;
  error: StorageError;
};

/**
 * 復号化結果
 */
export type DecryptionResult = {
  success: true;
  data: string;
} | {
  success: false;
  error: StorageError;
};

/**
 * 暗号化ユーティリティクラス
 */
export class EncryptionUtil {
  
  /**
   * Web Crypto APIの利用可能性を確認
   */
  private static isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           'crypto' in window && 
           'subtle' in window.crypto;
  }

  /**
   * パスワードから暗号化キーを生成
   */
  private static async deriveKey(
    password: string, 
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: ENCRYPTION_CONFIG.keyDerivation.algorithm,
        salt,
        iterations: ENCRYPTION_CONFIG.keyDerivation.iterations,
        hash: ENCRYPTION_CONFIG.keyDerivation.hash
      },
      keyMaterial,
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * ランダムなバイト配列を生成
   */
  private static generateRandomBytes(length: number): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Uint8ArrayをBase64エンコード
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64文字列をUint8Arrayにデコード
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * データを暗号化
   */
  static async encrypt(data: string, password: string): Promise<EncryptionResult> {
    const context = { method: 'EncryptionUtil.encrypt' };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'Web Crypto API is not available',
        'ブラウザが暗号化機能をサポートしていません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    if (!password || password.trim().length === 0) {
      const error = new StorageError(
        ErrorType.STORAGE_INVALID_DATA,
        'Password is required for encryption',
        '暗号化にはパスワードが必要です。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      // ソルトとIVを生成
      const salt = this.generateRandomBytes(ENCRYPTION_CONFIG.keyDerivation.saltLength);
      const iv = this.generateRandomBytes(ENCRYPTION_CONFIG.ivLength);

      // パスワードから暗号化キーを導出
      const key = await this.deriveKey(password, salt);

      // データを暗号化
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);
      
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: ENCRYPTION_CONFIG.algorithm,
          iv,
          tagLength: ENCRYPTION_CONFIG.tagLength
        },
        key,
        encodedData
      );

      const encryptedData: EncryptedData = {
        data: this.arrayBufferToBase64(encryptedBuffer),
        iv: this.arrayBufferToBase64(iv),
        salt: this.arrayBufferToBase64(salt),
        algorithm: ENCRYPTION_CONFIG.algorithm,
        iterations: ENCRYPTION_CONFIG.keyDerivation.iterations
      };

      errorLogger.debug('Data encrypted successfully', {
        ...context,
        dataLength: data.length,
        encryptedLength: encryptedData.data.length
      });

      return { success: true, data: encryptedData };
    } catch (err) {
      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * データを復号化
   */
  static async decrypt(encryptedData: EncryptedData, password: string): Promise<DecryptionResult> {
    const context = { method: 'EncryptionUtil.decrypt' };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'Web Crypto API is not available',
        'ブラウザが暗号化機能をサポートしていません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    if (!password || password.trim().length === 0) {
      const error = new StorageError(
        ErrorType.STORAGE_INVALID_DATA,
        'Password is required for decryption',
        '復号化にはパスワードが必要です。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      // Base64デコード
      const salt = new Uint8Array(this.base64ToArrayBuffer(encryptedData.salt));
      const iv = new Uint8Array(this.base64ToArrayBuffer(encryptedData.iv));
      const data = this.base64ToArrayBuffer(encryptedData.data);

      // パスワードから暗号化キーを導出
      const key = await this.deriveKey(password, salt);

      // データを復号化
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: encryptedData.algorithm,
          iv,
          tagLength: ENCRYPTION_CONFIG.tagLength
        },
        key,
        data
      );

      const decoder = new TextDecoder();
      const decryptedData = decoder.decode(decryptedBuffer);

      errorLogger.debug('Data decrypted successfully', {
        ...context,
        decryptedLength: decryptedData.length
      });

      return { success: true, data: decryptedData };
    } catch (err) {
      // 復号化エラーは多くの場合パスワード間違い
      if (err instanceof Error && err.name === 'OperationError') {
        const error = new StorageError(
          ErrorType.STORAGE_INVALID_DATA,
          'Decryption failed - invalid password or corrupted data',
          'パスワードが間違っているか、データが破損しています。',
          context,
          err
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * 暗号化データの形式を検証
   */
  static isEncryptedData(value: unknown): value is EncryptedData {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      'iv' in value &&
      'salt' in value &&
      'algorithm' in value &&
      'iterations' in value &&
      typeof (value as Record<string, unknown>).data === 'string' &&
      typeof (value as Record<string, unknown>).iv === 'string' &&
      typeof (value as Record<string, unknown>).salt === 'string' &&
      typeof (value as Record<string, unknown>).algorithm === 'string' &&
      typeof (value as Record<string, unknown>).iterations === 'number'
    );
  }

  /**
   * パスワード強度の検証
   */
  static validatePassword(password: string): {
    valid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
  } {
    const errors: string[] = [];
    let score = 0;

    if (password.length < 8) {
      errors.push('パスワードは8文字以上で入力してください。');
    } else {
      score += 1;
    }

    if (password.length >= 12) {
      score += 1;
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      errors.push('小文字を含めてください。');
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      errors.push('大文字を含めてください。');
    }

    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      errors.push('数字を含めてください。');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score += 1;
    } else {
      errors.push('記号を含めてください。');
    }

    let strength: 'weak' | 'medium' | 'strong';
    if (score < 3) {
      strength = 'weak';
    } else if (score < 5) {
      strength = 'medium';
    } else {
      strength = 'strong';
    }

    return {
      valid: errors.length === 0,
      errors,
      strength
    };
  }

  /**
   * セキュアなパスワード生成
   */
  static generateSecurePassword(length: number = 16): string {
    if (!this.isAvailable()) {
      // フォールバック: Math.randomを使用（セキュリティは低下）
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    }

    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    // 各カテゴリから最低1文字を確保
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // 残りの文字を埋める
    const remainingLength = length - 4;
    const randomBytes = this.generateRandomBytes(remainingLength);
    
    for (let i = 0; i < remainingLength; i++) {
      password += allChars[randomBytes[i] % allChars.length];
    }

    // パスワードをシャッフル
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

// デフォルトエクスポート
export const encryptionUtil = EncryptionUtil;