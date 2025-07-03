/**
 * 型安全な localStorage 操作ラッパー
 */

import { 
  LocalStorageKey, 
  StorageResult,
  JSONSerializable,
  safeJsonParse,
  safeJsonStringify,
  createLocalStorageKey
} from '../types/typeUtils';
import { 
  StorageError, 
  ErrorType, 
  convertToAppError 
} from '../types/errors';
import { errorLogger } from './errorLogger';
import { 
  EncryptionUtil, 
  EncryptedData
} from './encryption';

/**
 * 暗号化設定
 */
export interface EncryptionConfig {
  /** 暗号化を有効にするか */
  enabled: boolean;
  /** 暗号化パスワード */
  password?: string;
}

/**
 * localStorage の型安全なラッパークラス
 */
export class SafeStorage {
  private static encryptionConfig: EncryptionConfig = {
    enabled: false
  };
  /**
   * 暗号化設定を更新
   */
  static setEncryptionConfig(config: EncryptionConfig): void {
    this.encryptionConfig = { ...config };
    errorLogger.info('Encryption config updated', { 
      enabled: config.enabled,
      hasPassword: !!config.password 
    });
  }

  /**
   * 現在の暗号化設定を取得
   */
  static getEncryptionConfig(): Omit<EncryptionConfig, 'password'> {
    return {
      enabled: this.encryptionConfig.enabled
    };
  }

  private static isAvailable(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 型安全な値の取得
   */
  static async get<T extends JSONSerializable>(
    key: LocalStorageKey
  ): Promise<StorageResult<T | null>> {
    const context = { method: 'SafeStorage.get', key };
    
    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'localStorage is not available',
        'ブラウザの設定によりデータの読み込みができません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      const storedValue = window.localStorage.getItem(key);
      
      if (storedValue === null) {
        return { success: true, data: null };
      }

      let finalValue = storedValue;

      // 暗号化が有効な場合の復号化処理
      if (this.encryptionConfig.enabled && this.encryptionConfig.password) {
        const parseResult = safeJsonParse<EncryptedData>(storedValue);
        if (parseResult.ok && EncryptionUtil.isEncryptedData(parseResult.value)) {
          // 暗号化されたデータを復号化
          const decryptResult = await EncryptionUtil.decrypt(
            parseResult.value,
            this.encryptionConfig.password
          );
          
          if (!decryptResult.success) {
            const error = new StorageError(
              ErrorType.STORAGE_INVALID_DATA,
              'Failed to decrypt stored data',
              'データの復号化に失敗しました。パスワードを確認してください。',
              context,
              decryptResult.error
            );
            errorLogger.logError(error);
            return { success: false, error };
          }
          
          finalValue = decryptResult.data;
        }
      }

      const parseResult = safeJsonParse<T>(finalValue);
      if (!parseResult.ok) {
        const error = new StorageError(
          ErrorType.STORAGE_INVALID_DATA,
          `Failed to parse stored data: ${parseResult.error.message}`,
          '保存されたデータが破損しています。',
          { ...context, parseError: parseResult.error.message },
          parseResult.error
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      return { success: true, data: parseResult.value };
    } catch (err) {
      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * 型安全な値の設定
   */
  static async set<T extends JSONSerializable>(
    key: LocalStorageKey,
    value: T
  ): Promise<StorageResult<void>> {
    const context = { method: 'SafeStorage.set', key };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'localStorage is not available',
        'ブラウザの設定によりデータの保存ができません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      const stringifyResult = safeJsonStringify(value);
      if (!stringifyResult.ok) {
        const error = new StorageError(
          ErrorType.STORAGE_INVALID_DATA,
          `Failed to serialize data: ${stringifyResult.error.message}`,
          'データのシリアライゼーションに失敗しました。',
          { ...context, stringifyError: stringifyResult.error.message },
          stringifyResult.error
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      let finalValue = stringifyResult.value;

      // 暗号化が有効な場合の暗号化処理
      if (this.encryptionConfig.enabled && this.encryptionConfig.password) {
        const encryptResult = await EncryptionUtil.encrypt(
          finalValue,
          this.encryptionConfig.password
        );
        
        if (!encryptResult.success) {
          const error = new StorageError(
            ErrorType.STORAGE_INVALID_DATA,
            'Failed to encrypt data',
            'データの暗号化に失敗しました。',
            context,
            encryptResult.error
          );
          errorLogger.logError(error);
          return { success: false, error };
        }

        const encryptedStringifyResult = safeJsonStringify(encryptResult.data as unknown as JSONSerializable);
        if (!encryptedStringifyResult.ok) {
          const error = new StorageError(
            ErrorType.STORAGE_INVALID_DATA,
            'Failed to serialize encrypted data',
            '暗号化データのシリアライゼーションに失敗しました。',
            context,
            encryptedStringifyResult.error
          );
          errorLogger.logError(error);
          return { success: false, error };
        }

        finalValue = encryptedStringifyResult.value;
      }

      // サイズチェック（概算）
      const estimatedSize = new Blob([finalValue]).size;
      if (estimatedSize > 5 * 1024 * 1024) { // 5MB制限
        const error = new StorageError(
          ErrorType.STORAGE_QUOTA_EXCEEDED,
          `Data too large: ${estimatedSize} bytes`,
          'データが大きすぎます。データサイズを減らしてください。',
          { ...context, estimatedSize }
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      window.localStorage.setItem(key, finalValue);
      
      errorLogger.debug('Data stored successfully', { 
        ...context, 
        estimatedSize 
      });
      
      return { success: true, data: undefined };
    } catch (err) {
      // DOMException のハンドリング
      if (err instanceof DOMException) {
        if (err.name === 'QuotaExceededError') {
          const error = new StorageError(
            ErrorType.STORAGE_QUOTA_EXCEEDED,
            err.message,
            'ストレージの容量が不足しています。不要なデータを削除してください。',
            context,
            err
          );
          errorLogger.logError(error);
          return { success: false, error };
        }

        if (err.name === 'SecurityError') {
          const error = new StorageError(
            ErrorType.STORAGE_ACCESS_DENIED,
            err.message,
            'ブラウザの設定によりデータの保存ができません。',
            context,
            err
          );
          errorLogger.logError(error);
          return { success: false, error };
        }
      }

      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * 型安全な値の削除
   */
  static remove(key: LocalStorageKey): StorageResult<boolean> {
    const context = { method: 'SafeStorage.remove', key };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'localStorage is not available',
        'ブラウザの設定によりデータの削除ができません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      const existed = window.localStorage.getItem(key) !== null;
      window.localStorage.removeItem(key);
      
      errorLogger.debug('Data removed successfully', { ...context, existed });
      
      return { success: true, data: existed };
    } catch (err) {
      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * キーの存在確認
   */
  static has(key: LocalStorageKey): StorageResult<boolean> {
    const context = { method: 'SafeStorage.has', key };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'localStorage is not available',
        'ブラウザの設定によりデータの確認ができません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      const exists = window.localStorage.getItem(key) !== null;
      return { success: true, data: exists };
    } catch (err) {
      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * すべてのキーを取得
   */
  static getAllKeys(): StorageResult<LocalStorageKey[]> {
    const context = { method: 'SafeStorage.getAllKeys' };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'localStorage is not available',
        'ブラウザの設定によりデータの取得ができません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      const keys: LocalStorageKey[] = [];
      
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          keys.push(createLocalStorageKey(key));
        }
      }

      return { success: true, data: keys };
    } catch (err) {
      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * プレフィックスによるキーのフィルタリング
   */
  static getKeysByPrefix(prefix: string): StorageResult<LocalStorageKey[]> {
    const context = { method: 'SafeStorage.getKeysByPrefix', prefix };

    const allKeysResult = this.getAllKeys();
    if (!allKeysResult.success) {
      return allKeysResult;
    }

    try {
      const filteredKeys = allKeysResult.data.filter(key => 
        key.startsWith(prefix)
      );

      return { success: true, data: filteredKeys };
    } catch (err) {
      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * ストレージ使用量の計算
   */
  static getStorageUsage(): StorageResult<{
    used: number;
    total: number;
    items: number;
  }> {
    const context = { method: 'SafeStorage.getStorageUsage' };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'localStorage is not available',
        'ブラウザの設定によりストレージ情報の取得ができません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      let totalSize = 0;
      let itemCount = 0;

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          const value = window.localStorage.getItem(key) || '';
          totalSize += new Blob([key + value]).size;
          itemCount++;
        }
      }

      // ブラウザの制限は通常5-10MB
      const estimatedLimit = 5 * 1024 * 1024; // 5MB

      return {
        success: true,
        data: {
          used: totalSize,
          total: estimatedLimit,
          items: itemCount
        }
      };
    } catch (err) {
      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * ストレージのクリア（危険な操作）
   */
  static clear(): StorageResult<void> {
    const context = { method: 'SafeStorage.clear' };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'localStorage is not available',
        'ブラウザの設定によりデータのクリアができません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      const itemCount = window.localStorage.length;
      window.localStorage.clear();
      
      errorLogger.info('Storage cleared successfully', { 
        ...context, 
        clearedItems: itemCount 
      });
      
      return { success: true, data: undefined };
    } catch (err) {
      const error = convertToAppError(err, context) as StorageError;
      errorLogger.logError(error);
      return { success: false, error };
    }
  }

  /**
   * 複数の値を一括で設定（トランザクション風）
   */
  static async setMultiple<T extends JSONSerializable>(
    entries: Array<{ key: LocalStorageKey; value: T }>
  ): Promise<StorageResult<void>> {
    const context = { 
      method: 'SafeStorage.setMultiple', 
      entryCount: entries.length 
    };

    if (!this.isAvailable()) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'localStorage is not available',
        'ブラウザの設定によりデータの保存ができません。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    // バックアップ用
    const backup: Array<{ key: LocalStorageKey; value: string | null }> = [];
    const successful: LocalStorageKey[] = [];

    try {
      // 既存の値をバックアップ
      for (const { key } of entries) {
        backup.push({
          key,
          value: window.localStorage.getItem(key)
        });
      }

      // 新しい値を設定
      for (const { key, value } of entries) {
        const setResult = await this.set(key, value);
        if (!setResult.success) {
          throw setResult.error;
        }
        successful.push(key);
      }

      errorLogger.debug('Multiple values set successfully', {
        ...context,
        successful: successful.length
      });

      return { success: true, data: undefined };
    } catch (err) {
      // エラーが発生した場合、成功した操作をロールバック
      errorLogger.warn('Rolling back successful operations', {
        ...context,
        rollbackCount: successful.length
      });

      for (const { key, value } of backup) {
        try {
          if (value === null) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, value);
          }
        } catch (rollbackErr) {
          errorLogger.error('Failed to rollback operation', {
            ...context,
            key,
            rollbackError: rollbackErr
          });
        }
      }

      const error = err instanceof StorageError 
        ? err 
        : convertToAppError(err, context) as StorageError;
      
      errorLogger.logError(error);
      return { success: false, error };
    }
  }
}

// デフォルトエクスポート
export const safeStorage = SafeStorage;