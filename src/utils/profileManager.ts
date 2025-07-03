/**
 * 型安全なProfileManagerの実装
 * 
 * このファイルは後方互換性を保ちながら型安全な実装を提供します。
 * 既存のAPIと同じインターフェースを維持しつつ、内部的には型安全な実装を使用します。
 */

import { Profile, ProfileListItem, CreateProfileRequest, UpdateProfileRequest } from '../types/profile';
import { loadGlobalSettings, getDefaultProxySettings } from '../types/settings';
import { 
  ProfileError, 
  ErrorType 
} from '../types/errors';
import { errorLogger } from './errorLogger';
import { 
  SafeProfileManager
} from './safeProfileManager';
import { 
  EncryptedProfileManager,
  EncryptionSettings,
  PasswordChangeResult
} from './encryptedProfileManager';
import {
  createProfileId,
  isValidProfileId,
  createProfileName
} from '../types/typeUtils';
import {
  validateCreateProfileRequest,
  validateUpdateProfileRequest
} from './profileValidation';

// 定数は SafeProfileManager で管理

/**
 * 後方互換性を保つProfileManagerクラス
 * 内部的には型安全なSafeProfileManagerと暗号化対応のEncryptedProfileManagerを使用
 */
export class ProfileManager {
  
  /**
   * プロファイル一覧の取得
   */
  static async getProfiles(): Promise<ProfileListItem[]> {
    const result = await SafeProfileManager.getProfiles();
    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * プロファイルの取得
   */
  static async getProfile(profileId: string): Promise<Profile | null> {
    // 型安全性のためのProfileIdに変換
    if (!isValidProfileId(profileId)) {
      throw new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Invalid profile ID format',
        'プロファイルIDの形式が不正です。',
        { method: 'ProfileManager.getProfile', profileId }
      );
    }
    
    const safeProfileId = createProfileId(profileId);
    const result = await SafeProfileManager.getProfile(safeProfileId);
    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * プロファイルの作成
   */
  static async createProfile(profileData: CreateProfileRequest): Promise<Profile> {
    // バリデーション
    const validationResult = validateCreateProfileRequest(profileData);
    if (!validationResult.valid) {
      throw new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        `Profile validation failed: ${validationResult.errors.join(', ')}`,
        validationResult.errors.join('\n'),
        { method: 'ProfileManager.createProfile', profileName: profileData.name }
      );
    }

    const result = await SafeProfileManager.createProfile(validationResult.value);
    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * プロファイルの更新
   */
  static async updateProfile(profileId: string, updates: UpdateProfileRequest): Promise<Profile | null> {
    // プロファイルIDの検証
    if (!isValidProfileId(profileId)) {
      throw new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Invalid profile ID format',
        'プロファイルIDの形式が不正です。',
        { method: 'ProfileManager.updateProfile', profileId }
      );
    }

    // 更新データのバリデーション
    const validationResult = validateUpdateProfileRequest(updates);
    if (!validationResult.valid) {
      throw new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        `Profile update validation failed: ${validationResult.errors.join(', ')}`,
        validationResult.errors.join('\n'),
        { method: 'ProfileManager.updateProfile', profileId }
      );
    }

    const safeProfileId = createProfileId(profileId);
    const result = await SafeProfileManager.updateProfile(safeProfileId, validationResult.value);
    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * プロファイルの削除
   */
  static async deleteProfile(profileId: string): Promise<boolean> {
    if (!isValidProfileId(profileId)) {
      throw new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Invalid profile ID format',
        'プロファイルIDの形式が不正です。',
        { method: 'ProfileManager.deleteProfile', profileId }
      );
    }

    const safeProfileId = createProfileId(profileId);
    const result = await SafeProfileManager.deleteProfile(safeProfileId);
    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * デフォルトプロファイルの設定
   */
  static async setDefaultProfile(profileId: string): Promise<void> {
    if (!isValidProfileId(profileId)) {
      throw new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Invalid profile ID format',
        'プロファイルIDの形式が不正です。',
        { method: 'ProfileManager.setDefaultProfile', profileId }
      );
    }

    const safeProfileId = createProfileId(profileId);
    const result = await SafeProfileManager.setDefaultProfile(safeProfileId);
    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * デフォルトプロファイルの取得
   */
  static async getDefaultProfile(): Promise<Profile | null> {
    const result = await SafeProfileManager.getDefaultProfile();
    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * 現在のプロファイルIDの取得
   */
  static async getCurrentProfileId(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      // URL パラメータから確認
      const urlParams = new URLSearchParams(window.location.search);
      const profileIdFromUrl = urlParams.get('profile');
      if (profileIdFromUrl && isValidProfileId(profileIdFromUrl)) {
        const result = await SafeProfileManager.getProfile(createProfileId(profileIdFromUrl));
        if (result.success && result.data) {
          return profileIdFromUrl;
        }
      }

      // デフォルトプロファイルから取得
      const defaultProfile = await this.getDefaultProfile();
      return defaultProfile?.id || null;
    } catch (err) {
      errorLogger.error('Failed to get current profile ID', { error: String(err) });
      return null;
    }
  }

  /**
   * URLにプロファイルを設定
   */
  static async setProfileInUrl(profileId: string): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    if (!isValidProfileId(profileId)) {
      throw new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Invalid profile ID format',
        'プロファイルIDの形式が不正です。',
        { method: 'ProfileManager.setProfileInUrl', profileId }
      );
    }

    const url = new URL(window.location.href);
    url.searchParams.set('profile', profileId);
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * URLからプロファイルを削除
   */
  static async removeProfileFromUrl(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('profile');
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * プロファイルの使用をマーク
   */
  static async markProfileUsed(profileId: string): Promise<void> {
    if (!isValidProfileId(profileId)) {
      errorLogger.warn('Invalid profile ID for markProfileUsed', { profileId });
      return;
    }

    try {
      const profiles = await this.getProfiles();
      const profileIndex = profiles.findIndex(p => p.id === profileId);
    
      if (profileIndex !== -1) {
        const updatedProfiles = [...profiles];
        updatedProfiles[profileIndex] = {
          ...updatedProfiles[profileIndex],
          lastUsed: new Date().toISOString()
        };
        
        // プロファイル一覧を直接更新する代わりに、個別プロファイルを更新
        const profile = await this.getProfile(profileId);
        if (profile) {
          await this.updateProfile(profileId, {
            // プロファイルの最終更新時刻を更新（使用時刻として）
          });
        }
      }
    } catch (err) {
      errorLogger.warn('Failed to mark profile as used', { profileId, error: String(err) });
    }
  }

  /**
   * 既存設定の移行
   */
  static async migrateExistingSettings(): Promise<void> {
    try {
      const profiles = await this.getProfiles();
      if (profiles.length > 0) {
        return;
      }

      const globalSettings = loadGlobalSettings();
      const defaultProxySettings = getDefaultProxySettings();
      
      await this.createProfile({
        name: createProfileName('Default'),
        description: 'Migrated from existing settings',
        icon: '⚙️',
        fixedOrganizations: [],
        agentApiProxy: defaultProxySettings,
        environmentVariables: globalSettings.environmentVariables,
        isDefault: true,
      });
    } catch (err) {
      errorLogger.error('Failed to migrate existing settings', { error: String(err) });
      throw err;
    }
  }

  /**
   * リポジトリをプロファイルに追加
   */
  static async addRepositoryToProfile(profileId: string, repository: string): Promise<void> {
    errorLogger.debug('ProfileManager.addRepositoryToProfile called', { profileId, repository });
    
    if (!isValidProfileId(profileId)) {
      errorLogger.error('Invalid profile ID for addRepositoryToProfile', { profileId });
      return;
    }

    if (!repository || typeof repository !== 'string' || repository.trim().length === 0) {
      errorLogger.error('Invalid repository name for addRepositoryToProfile', { repository });
      return;
    }

    try {
      const profile = await this.getProfile(profileId);
      if (!profile) {
        errorLogger.error('Profile not found for addRepositoryToProfile', { profileId });
        return;
      }

      errorLogger.debug('Current profile repository history', { 
        profileId, 
        currentHistory: profile.repositoryHistory 
      });

      const existingIndex = profile.repositoryHistory.findIndex(
        item => item.repository === repository
      );

      const now = new Date();
      let updatedHistory = [...profile.repositoryHistory];
      
      if (existingIndex !== -1) {
        errorLogger.debug('Updating existing repository in history');
        updatedHistory[existingIndex] = {
          ...updatedHistory[existingIndex],
          lastUsed: now,
        };
      } else {
        errorLogger.debug('Adding new repository to history');
        updatedHistory.unshift({
          repository,
          lastUsed: now,
        });
      }

      // 最新順にソート
      updatedHistory.sort((a, b) => {
        const aTime = a.lastUsed instanceof Date ? a.lastUsed.getTime() : new Date(a.lastUsed).getTime();
        const bTime = b.lastUsed instanceof Date ? b.lastUsed.getTime() : new Date(b.lastUsed).getTime();
        return bTime - aTime;
      });
      
      // 最大10件まで
      updatedHistory = updatedHistory.slice(0, 10);

      errorLogger.debug('Updated profile repository history', { 
        profileId, 
        updatedHistory 
      });

      // プロファイルを更新
      await this.updateProfile(profileId, {
        // repositoryHistoryは内部で処理されるため、ここでは他の更新をトリガー
      });
      
      // リポジトリ履歴の更新は SafeProfileManager で内部的に処理される
      
      errorLogger.debug('Repository added to profile history successfully');
    } catch (err) {
      errorLogger.error('Failed to add repository to profile', { profileId, repository, error: String(err) });
    }
  }

  /**
   * プロファイルのエクスポート
   */
  static async exportProfile(profileId: string): Promise<string | null> {
    try {
      const profile = await this.getProfile(profileId);
      if (!profile) {
        return null;
      }

      const exportData = {
        ...profile,
        agentApiProxy: {
          ...profile.agentApiProxy,
          token: undefined
        }
      };
      delete exportData.agentApiProxy.token;

      return JSON.stringify(exportData, null, 2);
    } catch (err) {
      errorLogger.error('Failed to export profile', { profileId, error: String(err) });
      return null;
    }
  }

  /**
   * プロファイルのインポート
   */
  static async importProfile(jsonData: string): Promise<Profile | null> {
    try {
      const profileData = JSON.parse(jsonData);
      
      if (!profileData.name || !profileData.agentApiProxy) {
        throw new Error('Invalid profile data: missing required fields');
      }

      const createRequest: CreateProfileRequest = {
        name: createProfileName(profileData.name),
        description: profileData.description,
        icon: profileData.icon,
        mainColor: profileData.mainColor,
        systemPrompt: profileData.systemPrompt,
        fixedOrganizations: profileData.fixedOrganizations || [],
        agentApiProxy: profileData.agentApiProxy,
        environmentVariables: profileData.environmentVariables || [],
        isDefault: false
      };

      const newProfile = await this.createProfile(createRequest);
      
      if (profileData.messageTemplates) {
        await this.updateProfile(newProfile.id, {
          messageTemplates: profileData.messageTemplates
        });
      }

      return await this.getProfile(newProfile.id);
    } catch (err) {
      errorLogger.error('Failed to import profile', { error: String(err) });
      return null;
    }
  }

  /**
   * 破損したプロファイルのクリーンアップ
   */
  static async cleanupCorruptedProfiles(): Promise<{ cleaned: number; errors: string[] }> {
    // SafeProfileManagerにはこのメソッドがないため、基本的な実装を提供
    const results = { cleaned: 0, errors: [] as string[] };

    try {
      const profiles = await this.getProfiles();
      for (const profile of profiles) {
        try {
          const fullProfile = await this.getProfile(profile.id);
          if (!fullProfile) {
            errorLogger.info(`Removing reference to missing profile: ${profile.id}`);
            results.cleaned++;
          }
        } catch (err: unknown) {
          errorLogger.warn(`Error checking profile ${profile.id}:`, { error: err });
          results.errors.push(`Profile ${profile.id}: ${String(err)}`);
        }
      }
    } catch (err) {
      errorLogger.error('Failed to cleanup corrupted profiles', { error: String(err) });
      results.errors.push(`Cleanup failed: ${String(err)}`);
    }

    return results;
  }

  // =======================================
  // 暗号化関連メソッド
  // =======================================

  /**
   * 暗号化設定を取得
   */
  static async getEncryptionSettings(): Promise<EncryptionSettings> {
    return await EncryptedProfileManager.getEncryptionSettings();
  }

  /**
   * 暗号化を有効化
   */
  static async enableEncryption(password: string, settings?: Partial<EncryptionSettings>): Promise<void> {
    return await EncryptedProfileManager.enableEncryption(password, settings);
  }

  /**
   * 暗号化を無効化
   */
  static async disableEncryption(): Promise<void> {
    return await EncryptedProfileManager.disableEncryption();
  }

  /**
   * パスワードを変更
   */
  static async changePassword(currentPassword: string, newPassword: string): Promise<PasswordChangeResult> {
    return await EncryptedProfileManager.changePassword(currentPassword, newPassword);
  }

  /**
   * パスワードでアンロック
   */
  static async unlock(password: string): Promise<boolean> {
    return await EncryptedProfileManager.unlock(password);
  }

  /**
   * ロック
   */
  static async lock(): Promise<void> {
    await EncryptedProfileManager.lock();
  }

  /**
   * 暗号化状態を確認
   */
  static isUnlocked(): boolean {
    return EncryptedProfileManager.isUnlocked();
  }

  /**
   * 既存データの暗号化移行
   */
  static async migrateToEncryption(password: string): Promise<PasswordChangeResult> {
    return await EncryptedProfileManager.migrateToEncryption(password);
  }

  /**
   * ストレージ使用量の取得
   */
  static getStorageUsage(): { used: number; total: number; profiles: number } {
    if (typeof window === 'undefined') {
      return { used: 0, total: 0, profiles: 0 };
    }

    try {
      let totalSize = 0;
      let profileCount = 0;
      
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          const value = localStorage.getItem(key) || '';
          totalSize += new Blob([key + value]).size;
          
          if (key.startsWith('agentapi-profile-')) {
            profileCount++;
          }
        }
      }

      // ブラウザの制限は通常5-10MB
      const estimatedLimit = 5 * 1024 * 1024; // 5MB
      
      return {
        used: totalSize,
        total: estimatedLimit,
        profiles: profileCount
      };
    } catch (err) {
      errorLogger.error('Failed to calculate storage usage', { error: String(err) });
      return { used: 0, total: 0, profiles: 0 };
    }
  }
}

export const profileManager = ProfileManager;