/**
 * 暗号化対応プロファイルマネージャー
 * プロファイルデータの暗号化・復号化を管理
 */

import { SafeProfileManager } from './safeProfileManager';
import { SafeStorage } from './safeStorage';
import { EncryptionUtil } from './encryption';
import { 
  ProfileError, 
  StorageError, 
  ErrorType 
} from '../types/errors';
import { errorLogger } from './errorLogger';
import { 
  createLocalStorageKey,
  JSONSerializable
} from '../types/typeUtils';

/**
 * 暗号化設定キー
 */
const ENCRYPTION_SETTINGS_KEY = createLocalStorageKey('agentapi-encryption-settings');

/**
 * 暗号化設定データ
 */
export interface EncryptionSettings {
  /** 暗号化が有効かどうか */
  readonly enabled: boolean;
  /** 暗号化対象のデータタイプ */
  readonly encryptedDataTypes: ReadonlyArray<'profiles' | 'settings' | 'templates' | 'history'>;
  /** パスワードヒント（オプション） */
  readonly passwordHint?: string;
  /** 最後にパスワードが設定された日時 */
  readonly lastPasswordUpdate?: string;
  /** インデックスシグネチャ */
  readonly [key: string]: unknown;
}

/**
 * パスワード変更結果
 */
export interface PasswordChangeResult {
  success: boolean;
  error?: StorageError | ProfileError;
  migrated?: number;
  failed?: number;
}

/**
 * 暗号化対応プロファイルマネージャー
 */
export class EncryptedProfileManager extends SafeProfileManager {
  
  /**
   * 暗号化設定を取得
   */
  static async getEncryptionSettings(): Promise<EncryptionSettings> {
    const defaultSettings: EncryptionSettings = {
      enabled: false,
      encryptedDataTypes: []
    };

    if (typeof window === 'undefined') {
      return defaultSettings;
    }

    try {
      const result = await SafeStorage.get(ENCRYPTION_SETTINGS_KEY);
      if (result.success && result.data) {
        return { ...defaultSettings, ...(result.data as EncryptionSettings) };
      }
    } catch (err) {
      errorLogger.warn('Failed to load encryption settings', { error: String(err) });
    }

    return defaultSettings;
  }

  /**
   * 暗号化設定を保存
   */
  static async saveEncryptionSettings(settings: EncryptionSettings): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const result = await SafeStorage.set(ENCRYPTION_SETTINGS_KEY, settings as unknown as JSONSerializable);
    if (!result.success) {
      throw result.error;
    }

    errorLogger.info('Encryption settings saved', { 
      enabled: settings.enabled,
      dataTypes: settings.encryptedDataTypes 
    });
  }

  /**
   * 暗号化を有効化
   */
  static async enableEncryption(password: string, settings: Partial<EncryptionSettings> = {}): Promise<void> {
    const context = { method: 'EncryptedProfileManager.enableEncryption' };

    // パスワード強度の検証
    const passwordValidation = EncryptionUtil.validatePassword(password);
    if (!passwordValidation.valid) {
      throw new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        `Password validation failed: ${passwordValidation.errors.join(', ')}`,
        passwordValidation.errors.join('\n'),
        context
      );
    }

    if (passwordValidation.strength === 'weak') {
      errorLogger.warn('Weak password detected for encryption', context);
    }

    try {
      // 暗号化設定を更新
      const encryptionSettings: EncryptionSettings = {
        enabled: true,
        encryptedDataTypes: settings.encryptedDataTypes || ['profiles'],
        passwordHint: settings.passwordHint,
        lastPasswordUpdate: new Date().toISOString()
      };

      await this.saveEncryptionSettings(encryptionSettings);

      // SafeStorageに暗号化設定を適用
      await SafeStorage.setEncryptionConfig({
        enabled: true,
        password
      });

      errorLogger.info('Encryption enabled successfully', {
        ...context,
        dataTypes: encryptionSettings.encryptedDataTypes
      });
    } catch (err) {
      errorLogger.error('Failed to enable encryption', { ...context, error: String(err) });
      throw err;
    }
  }

  /**
   * 暗号化を無効化
   */
  static async disableEncryption(): Promise<void> {
    const context = { method: 'EncryptedProfileManager.disableEncryption' };

    try {
      // 暗号化設定を更新
      const encryptionSettings: EncryptionSettings = {
        enabled: false,
        encryptedDataTypes: []
      };

      await this.saveEncryptionSettings(encryptionSettings);

      // SafeStorageの暗号化設定を無効化
      await SafeStorage.setEncryptionConfig({
        enabled: false
      });

      errorLogger.info('Encryption disabled successfully', context);
    } catch (err) {
      errorLogger.error('Failed to disable encryption', { ...context, error: String(err) });
      throw err;
    }
  }

  /**
   * パスワードを変更
   */
  static async changePassword(
    currentPassword: string, 
    newPassword: string
  ): Promise<PasswordChangeResult> {
    const context = { method: 'EncryptedProfileManager.changePassword' };

    // 新パスワードの検証
    const passwordValidation = EncryptionUtil.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: new ProfileError(
          ErrorType.PROFILE_VALIDATION_FAILED,
          `New password validation failed: ${passwordValidation.errors.join(', ')}`,
          passwordValidation.errors.join('\n'),
          context
        )
      };
    }

    try {
      // 現在の暗号化設定を確認
      const currentSettings = await this.getEncryptionSettings();
      if (!currentSettings.enabled) {
        return {
          success: false,
          error: new ProfileError(
            ErrorType.PROFILE_VALIDATION_FAILED,
            'Encryption is not enabled',
            '暗号化が有効ではありません。',
            context
          )
        };
      }

      let migrated = 0;
      let failed = 0;

      // 既存の暗号化されたデータを新しいパスワードで再暗号化
      if (currentSettings.encryptedDataTypes.includes('profiles')) {
        // 一時的に現在のパスワードで復号化
        await SafeStorage.setEncryptionConfig({
          enabled: true,
          password: currentPassword
        });

        // 全プロファイルを取得
        const profilesResult = await this.getProfiles();
        if (profilesResult.success) {
          // 新しいパスワードで暗号化設定を更新
          await SafeStorage.setEncryptionConfig({
            enabled: true,
            password: newPassword
          });

          // 各プロファイルを再保存（新しいパスワードで暗号化される）
          for (const profileItem of profilesResult.data) {
            try {
              const profileResult = await this.getProfile(profileItem.id);
              if (profileResult.success && profileResult.data) {
                const saveResult = await this.updateProfile(profileItem.id, {});
                if (saveResult.success) {
                  migrated++;
                } else {
                  failed++;
                  errorLogger.warn('Failed to migrate profile with new password', {
                    ...context,
                    profileId: profileItem.id,
                    error: saveResult.error
                  });
                }
              }
            } catch (err) {
              failed++;
              errorLogger.warn('Failed to migrate profile', {
                ...context,
                profileId: profileItem.id,
                error: String(err)
              });
            }
          }
        }
      }

      // 暗号化設定を更新
      const updatedSettings: EncryptionSettings = {
        ...currentSettings,
        lastPasswordUpdate: new Date().toISOString()
      };
      await this.saveEncryptionSettings(updatedSettings);

      errorLogger.info('Password changed successfully', {
        ...context,
        migrated,
        failed
      });

      return {
        success: true,
        migrated,
        failed
      };
    } catch (err) {
      const error = err instanceof Error 
        ? new StorageError(
            ErrorType.STORAGE_ACCESS_DENIED,
            err.message,
            'パスワード変更に失敗しました。現在のパスワードが正しいか確認してください。',
            context,
            err
          )
        : new StorageError(
            ErrorType.STORAGE_ACCESS_DENIED,
            'Unknown error during password change',
            'パスワード変更に失敗しました。',
            context
          );

      errorLogger.error('Password change failed', { ...context, error: String(err) });
      return { success: false, error };
    }
  }

  /**
   * パスワードでアンロック
   */
  static async unlock(password: string): Promise<boolean> {
    const context = { method: 'EncryptedProfileManager.unlock' };

    try {
      const settings = await this.getEncryptionSettings();
      if (!settings.enabled) {
        return true; // 暗号化が無効な場合は常にアンロック状態
      }

      // パスワードが正しいかテスト
      await SafeStorage.setEncryptionConfig({
        enabled: true,
        password
      });

      // 簡単なテストデータで検証
      const testKey = createLocalStorageKey('__encryption_test__');
      const testData = 'test';
      
      const setResult = await SafeStorage.set(testKey, testData);
      if (!setResult.success) {
        return false;
      }

      const getResult = await SafeStorage.get<string>(testKey);
      const isValid = getResult.success && getResult.data === testData;

      // テストデータを削除
      SafeStorage.remove(testKey);

      if (isValid) {
        errorLogger.info('Successfully unlocked encryption', context);
      } else {
        errorLogger.warn('Failed to unlock encryption - invalid password', context);
        await SafeStorage.setEncryptionConfig({ enabled: false });
      }

      return isValid;
    } catch (err) {
      errorLogger.error('Unlock failed', { ...context, error: String(err) });
      await SafeStorage.setEncryptionConfig({ enabled: false });
      return false;
    }
  }

  /**
   * ロック
   */
  static async lock(): Promise<void> {
    await SafeStorage.setEncryptionConfig({ enabled: false });
    errorLogger.info('Encryption locked');
  }

  /**
   * 暗号化状態を確認
   */
  static isUnlocked(): boolean {
    return SafeStorage.getEncryptionConfig().enabled;
  }

  /**
   * 既存データの暗号化移行
   */
  static async migrateToEncryption(password: string): Promise<PasswordChangeResult> {
    const context = { method: 'EncryptedProfileManager.migrateToEncryption' };

    // パスワード検証
    const passwordValidation = EncryptionUtil.validatePassword(password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: new ProfileError(
          ErrorType.PROFILE_VALIDATION_FAILED,
          `Password validation failed: ${passwordValidation.errors.join(', ')}`,
          passwordValidation.errors.join('\n'),
          context
        )
      };
    }

    try {
      let migrated = 0;
      let failed = 0;

      // まず暗号化なしで既存データを読み込み
      await SafeStorage.setEncryptionConfig({ enabled: false });

      // 全プロファイルを取得
      const profilesResult = await this.getProfiles();
      if (profilesResult.success) {
        // 暗号化を有効化
        await SafeStorage.setEncryptionConfig({
          enabled: true,
          password
        });

        // 各プロファイルを暗号化して再保存
        for (const profileItem of profilesResult.data) {
          try {
            // 暗号化なしでプロファイルを取得
            await SafeStorage.setEncryptionConfig({ enabled: false });
            const profileResult = await this.getProfile(profileItem.id);
            
            if (profileResult.success && profileResult.data) {
              // 暗号化して保存
              await SafeStorage.setEncryptionConfig({
                enabled: true,
                password
              });
              
              const saveResult = await this.updateProfile(profileItem.id, {});
              if (saveResult.success) {
                migrated++;
              } else {
                failed++;
              }
            }
          } catch (err) {
            failed++;
            errorLogger.warn('Failed to migrate profile to encryption', {
              ...context,
              profileId: profileItem.id,
              error: String(err)
            });
          }
        }
      }

      // 暗号化設定を保存
      const encryptionSettings: EncryptionSettings = {
        enabled: true,
        encryptedDataTypes: ['profiles'],
        lastPasswordUpdate: new Date().toISOString()
      };
      await this.saveEncryptionSettings(encryptionSettings);

      errorLogger.info('Migration to encryption completed', {
        ...context,
        migrated,
        failed
      });

      return {
        success: true,
        migrated,
        failed
      };
    } catch (err) {
      const error = new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        'Migration to encryption failed',
        '暗号化への移行に失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );

      errorLogger.error('Migration to encryption failed', { ...context, error: String(err) });
      return { success: false, error };
    }
  }
}

// デフォルトエクスポート
export const encryptedProfileManager = EncryptedProfileManager;