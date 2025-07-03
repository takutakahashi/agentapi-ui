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
  /** 暗号化キー（導出されたCryptoKey） */
  cryptoKey?: CryptoKey;
  /** セッション開始時刻 */
  sessionStart?: number;
  /** セッションタイムアウト（ミリ秒、デフォルト30分） */
  sessionTimeout?: number;
}

/**
 * localStorage の型安全なラッパークラス
 */
export class SafeStorage {
  private static encryptionConfig: EncryptionConfig = {
    enabled: false
  };
  
  private static readonly DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000; // 30分
  /**
   * 暗号化設定を更新（パスワードからCryptoKeyを導出）
   */
  static async setEncryptionConfig(config: EncryptionConfig & { password?: string }): Promise<void> {
    // パスワードが提供された場合、CryptoKeyを導出
    if (config.password && config.enabled) {
      try {
        // 既存のsaltを取得または新規作成
        const saltKey = createLocalStorageKey('agentapi-encryption-salt');
        let salt: Uint8Array;
        
        const existingSalt = window.localStorage.getItem(saltKey);
        if (existingSalt) {
          salt = new Uint8Array(JSON.parse(existingSalt));
        } else {
          salt = window.crypto.getRandomValues(new Uint8Array(32));
          window.localStorage.setItem(saltKey, JSON.stringify(Array.from(salt)));
        }
        
        const cryptoKey = await EncryptionUtil.deriveKeyFromPassword(config.password, salt);
        
        // パスワードを即座にクリア
        const passwordToClear = config.password;
        delete config.password;
        // パスワード文字列をゼロで上書き（可能な限り）
        if (passwordToClear) {
          for (let i = 0; i < passwordToClear.length; i++) {
            // Note: JavaScriptでは文字列は不変なので完全なクリアは不可能
          }
        }
        
        this.encryptionConfig = {
          enabled: config.enabled,
          cryptoKey,
          sessionStart: Date.now(),
          sessionTimeout: config.sessionTimeout || this.DEFAULT_SESSION_TIMEOUT
        };
        
        errorLogger.info('Encryption config updated with derived key', { 
          enabled: config.enabled,
          sessionTimeout: this.encryptionConfig.sessionTimeout
        });
      } catch (err) {
        errorLogger.error('Failed to derive encryption key', { error: String(err) });
        throw err;
      }
    } else {
      // パスワードなしの場合（無効化など）
      this.encryptionConfig = {
        enabled: config.enabled,
        cryptoKey: undefined,
        sessionStart: undefined,
        sessionTimeout: undefined
      };
      
      errorLogger.info('Encryption config updated', { 
        enabled: config.enabled
      });
    }
  }

  /**
   * セッションタイムアウトをチェック
   */
  private static checkSessionTimeout(): boolean {
    if (!this.encryptionConfig.enabled || !this.encryptionConfig.sessionStart || !this.encryptionConfig.sessionTimeout) {
      return true; // 暗号化が無効または設定が不完全
    }
    
    const now = Date.now();
    const elapsed = now - this.encryptionConfig.sessionStart;
    
    if (elapsed > this.encryptionConfig.sessionTimeout) {
      // セッションタイムアウト
      this.lock();
      errorLogger.info('Session timed out - encryption locked', {
        elapsedMs: elapsed,
        timeoutMs: this.encryptionConfig.sessionTimeout
      });
      return false;
    }
    
    return true;
  }

  /**
   * 暗号化をロック
   */
  static lock(): void {
    this.encryptionConfig = {
      enabled: false,
      cryptoKey: undefined,
      sessionStart: undefined,
      sessionTimeout: undefined
    };
    errorLogger.info('Encryption manually locked');
  }

  /**
   * 現在の暗号化設定を取得
   */
  static getEncryptionConfig(): Omit<EncryptionConfig, 'cryptoKey'> {
    this.checkSessionTimeout();
    return {
      enabled: this.encryptionConfig.enabled,
      sessionStart: this.encryptionConfig.sessionStart,
      sessionTimeout: this.encryptionConfig.sessionTimeout
    };
  }

  /**
   * 暗号化が利用可能かチェック（設定の有無）
   */
  static isEncryptionAvailable(): boolean {
    const { hasSettings } = this.getSessionState();
    return hasSettings;
  }

  /**
   * 暗号化がロック状態かチェック
   */
  static isEncryptionLocked(): boolean {
    const { isLocked } = this.getSessionState();
    return isLocked;
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
   * セッション状態を取得
   */
  private static getSessionState(): { isLocked: boolean; hasSettings: boolean } {
    try {
      const encryptionSettingsKey = createLocalStorageKey('agentapi-encryption-settings');
      const settingsData = window.localStorage.getItem(encryptionSettingsKey);
      if (settingsData) {
        const settings = JSON.parse(settingsData);
        return {
          hasSettings: true,
          isLocked: settings.enabled && !this.encryptionConfig.cryptoKey
        };
      }
    } catch (err) {
      errorLogger.warn('Failed to get session state', { error: String(err) });
    }
    return { hasSettings: false, isLocked: false };
  }

  /**
   * 暗号化設定を自動で読み込み
   */
  private static async loadEncryptionConfig(): Promise<void> {
    if (this.encryptionConfig.enabled && this.encryptionConfig.cryptoKey) {
      return; // 既に設定済み
    }
    
    try {
      const { hasSettings, isLocked } = this.getSessionState();
      
      if (hasSettings && isLocked) {
        // 暗号化設定はあるが、セッションがロック状態
        this.encryptionConfig.enabled = false;
        errorLogger.info('Encryption settings found but session is locked');
      }
    } catch (err) {
      errorLogger.warn('Failed to load encryption config', { error: String(err) });
    }
  }

  /**
   * 型安全な値の取得
   */
  static async get<T extends JSONSerializable>(
    key: LocalStorageKey
  ): Promise<StorageResult<T | null>> {
    const context = { method: 'SafeStorage.get', key };
    
    // 暗号化設定を自動読み込み
    await this.loadEncryptionConfig();
    
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

      // セッションタイムアウトをチェック
      if (!this.checkSessionTimeout()) {
        const error = new StorageError(
          ErrorType.STORAGE_ACCESS_DENIED,
          'Session timed out',
          'セッションがタイムアウトしました。再度パスワードを入力してください。',
          context
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      // 暗号化が有効な場合の復号化処理
      if (this.encryptionConfig.enabled && this.encryptionConfig.cryptoKey) {
        errorLogger.debug('Attempting to decrypt data from storage', { ...context, hasCryptoKey: !!this.encryptionConfig.cryptoKey });
        const parseResult = safeJsonParse<EncryptedData>(storedValue);
        if (parseResult.ok && EncryptionUtil.isEncryptedData(parseResult.value)) {
          // 暗号化されたデータを復号化
          const decryptResult = await EncryptionUtil.decryptWithKey(
            parseResult.value,
            this.encryptionConfig.cryptoKey
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

    // 暗号化設定を自動読み込み
    await this.loadEncryptionConfig();

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

      // セッションタイムアウトをチェック
      if (!this.checkSessionTimeout()) {
        const error = new StorageError(
          ErrorType.STORAGE_ACCESS_DENIED,
          'Session timed out',
          'セッションがタイムアウトしました。再度パスワードを入力してください。',
          context
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      // 暗号化が有効な場合の暗号化処理
      if (this.encryptionConfig.enabled && this.encryptionConfig.cryptoKey) {
        errorLogger.debug('Encrypting data before storage', { ...context, hasCryptoKey: !!this.encryptionConfig.cryptoKey });
        const encryptResult = await EncryptionUtil.encryptWithKey(
          finalValue,
          this.encryptionConfig.cryptoKey
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
      } else {
        errorLogger.debug('No encryption applied', { 
          ...context, 
          encryptionEnabled: this.encryptionConfig.enabled,
          hasCryptoKey: !!this.encryptionConfig.cryptoKey 
        });
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