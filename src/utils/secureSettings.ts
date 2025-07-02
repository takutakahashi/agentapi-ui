import { SettingsFormData } from '../types/settings';
import { encryptSensitiveFields, decryptSensitiveFields } from './crypto';

const SECURE_GLOBAL_SETTINGS_KEY = 'agentapi-secure-global-settings';
const SECURE_REPO_SETTINGS_PREFIX = 'agentapi-secure-settings-';
const SETTINGS_MIGRATION_KEY = 'agentapi-settings-migrated';

/**
 * セキュアなグローバル設定管理
 * 機密情報を暗号化して保存する
 */
export class SecureSettings {
  /**
   * グローバル設定を暗号化して保存
   */
  static async saveGlobalSettings(settings: SettingsFormData): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('Cannot save settings: localStorage not available (server-side)');
      return;
    }

    try {
      // 機密フィールドを暗号化
      const encryptedSettings = await encryptSensitiveFields({
        ...settings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      
      localStorage.setItem(SECURE_GLOBAL_SETTINGS_KEY, JSON.stringify(encryptedSettings));
    } catch (err) {
      console.error('Failed to save secure global settings:', err);
      throw err;
    }
  }

  /**
   * 暗号化されたグローバル設定を取得
   */
  static async loadGlobalSettings(): Promise<SettingsFormData> {
    if (typeof window === 'undefined') {
      return { environmentVariables: [], mcpServers: [] };
    }

    try {
      // まず暗号化された設定を探す
      const secureStored = localStorage.getItem(SECURE_GLOBAL_SETTINGS_KEY);
      if (secureStored) {
        const encryptedSettings = JSON.parse(secureStored);
        const decryptedSettings = await decryptSensitiveFields(encryptedSettings) as SettingsFormData & { environmentVariables: unknown[]; mcpServers: unknown[] };
        return {
          environmentVariables: decryptedSettings.environmentVariables || [],
          mcpServers: decryptedSettings.mcpServers || [],
        };
      }

      // 暗号化されていない旧設定を探す（マイグレーション用）
      const legacyStored = localStorage.getItem('agentapi-global-settings');
      if (legacyStored) {
        const legacySettings = JSON.parse(legacyStored);
        // 暗号化して保存
        await this.saveGlobalSettings(legacySettings);
        // 旧設定を削除
        localStorage.removeItem('agentapi-global-settings');
        return legacySettings;
      }

      return { environmentVariables: [], mcpServers: [] };
    } catch (err) {
      console.error('Failed to load secure global settings:', err);
      return { environmentVariables: [], mcpServers: [] };
    }
  }

  /**
   * リポジトリ設定を暗号化して保存
   */
  static async saveRepositorySettings(repoFullname: string, settings: SettingsFormData): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('Cannot save repository settings: localStorage not available (server-side)');
      return;
    }

    try {
      const key = `${SECURE_REPO_SETTINGS_PREFIX}${repoFullname}`;
      
      // 機密フィールドを暗号化
      const encryptedSettings = await encryptSensitiveFields({
        ...settings,
        repoFullname,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      
      localStorage.setItem(key, JSON.stringify(encryptedSettings));
    } catch (err) {
      console.error('Failed to save secure repository settings:', err);
      throw err;
    }
  }

  /**
   * 暗号化されたリポジトリ設定を取得
   */
  static async loadRepositorySettings(repoFullname: string): Promise<SettingsFormData> {
    const globalSettings = await this.loadGlobalSettings();
    
    if (typeof window === 'undefined') {
      return globalSettings;
    }

    try {
      const key = `${SECURE_REPO_SETTINGS_PREFIX}${repoFullname}`;
      
      // まず暗号化された設定を探す
      const secureStored = localStorage.getItem(key);
      if (secureStored) {
        const encryptedSettings = JSON.parse(secureStored);
        const decryptedSettings = await decryptSensitiveFields(encryptedSettings) as SettingsFormData & { environmentVariables: unknown[]; mcpServers: unknown[] };
        const repoSettings = {
          environmentVariables: decryptedSettings.environmentVariables || [],
          mcpServers: decryptedSettings.mcpServers || [],
        };
        
        // グローバル設定とマージ
        return this.mergeSettings(globalSettings, repoSettings);
      }

      // 暗号化されていない旧設定を探す（マイグレーション用）
      const legacyKey = `agentapi-settings-${repoFullname}`;
      const legacyStored = localStorage.getItem(legacyKey);
      if (legacyStored) {
        const legacySettings = JSON.parse(legacyStored);
        // 暗号化して保存
        await this.saveRepositorySettings(repoFullname, legacySettings);
        // 旧設定を削除
        localStorage.removeItem(legacyKey);
        return this.mergeSettings(globalSettings, legacySettings);
      }

      // リポジトリ固有の設定がない場合はグローバル設定を返す
      return globalSettings;
    } catch (err) {
      console.error('Failed to load secure repository settings:', err);
      return globalSettings;
    }
  }

  /**
   * 実効設定を取得（グローバルとリポジトリ設定をマージ）
   */
  static async getEffectiveSettings(repoFullname: string): Promise<SettingsFormData> {
    return await this.loadRepositorySettings(repoFullname);
  }

  /**
   * 既存設定のマイグレーション
   */
  static async migrateExistingSettings(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    // すでにマイグレーション済みか確認
    const migrationStatus = localStorage.getItem(SETTINGS_MIGRATION_KEY);
    if (migrationStatus === 'completed') {
      return;
    }

    try {
      console.log('Starting settings migration to encrypted storage...');

      // グローバル設定のマイグレーション
      const legacyGlobalSettings = localStorage.getItem('agentapi-global-settings');
      if (legacyGlobalSettings) {
        console.log('Migrating global settings...');
        const settings = JSON.parse(legacyGlobalSettings);
        await this.saveGlobalSettings(settings);
        localStorage.removeItem('agentapi-global-settings');
      }

      // リポジトリ設定のマイグレーション
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('agentapi-settings-') && !key.startsWith(SECURE_REPO_SETTINGS_PREFIX)) {
          const repoFullname = key.replace('agentapi-settings-', '');
          console.log(`Migrating repository settings: ${repoFullname}`);
          
          const legacySettings = localStorage.getItem(key);
          if (legacySettings) {
            const settings = JSON.parse(legacySettings);
            await this.saveRepositorySettings(repoFullname, settings);
            localStorage.removeItem(key);
          }
        }
      }

      // マイグレーション完了を記録
      localStorage.setItem(SETTINGS_MIGRATION_KEY, 'completed');
      console.log('Settings migration completed successfully');
    } catch (err) {
      console.error('Failed to migrate settings:', err);
    }
  }

  /**
   * 設定をマージ（グローバル設定をベースに、リポジトリ設定で上書き）
   */
  private static mergeSettings(globalSettings: SettingsFormData, repoSettings: SettingsFormData): SettingsFormData {
    return {
      environmentVariables: [
        ...(globalSettings.environmentVariables || []),
        ...(repoSettings.environmentVariables || []).filter(repoVar => 
          !(globalSettings.environmentVariables || []).some(globalVar => globalVar.key === repoVar.key)
        )
      ],
      mcpServers: [
        ...(globalSettings.mcpServers || []),
        ...(repoSettings.mcpServers || []).filter(repoServer => 
          !(globalSettings.mcpServers || []).some(globalServer => globalServer.id === repoServer.id)
        )
      ]
    };
  }

  /**
   * すべての暗号化された設定をクリア（デバッグ用）
   */
  static async clearAllSecureSettings(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(SECURE_REPO_SETTINGS_PREFIX) || key === SECURE_GLOBAL_SETTINGS_KEY) {
        localStorage.removeItem(key);
      }
    }
    
    // マイグレーションステータスもリセット
    localStorage.removeItem(SETTINGS_MIGRATION_KEY);
  }
}

export const secureSettings = SecureSettings;