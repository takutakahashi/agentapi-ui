import { Profile, ProfileListItem, CreateProfileRequest, UpdateProfileRequest } from '../types/profile';
import { ProfileManager } from './profileManager';
import { encryptSensitiveFields, decryptSensitiveFields } from './crypto';
import { v4 as uuidv4 } from 'uuid';

const SECURE_PROFILE_KEY_PREFIX = 'agentapi-secure-profile-';
const MIGRATION_STATUS_KEY = 'agentapi-profiles-migrated';

/**
 * セキュアなプロファイルマネージャー
 * 機密情報を暗号化して保存する
 */
export class SecureProfileManager {
  /**
   * 暗号化されたプロファイルを取得
   */
  static async getProfile(profileId: string): Promise<Profile | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      // まず暗号化されたプロファイルを探す
      const secureStored = localStorage.getItem(`${SECURE_PROFILE_KEY_PREFIX}${profileId}`);
      if (secureStored) {
        const encryptedProfile = JSON.parse(secureStored);
        const decryptedProfile = await decryptSensitiveFields(encryptedProfile) as Profile;
        
        // repositoryHistoryのlastUsedを文字列からDateオブジェクトに変換
        if (decryptedProfile.repositoryHistory) {
          decryptedProfile.repositoryHistory = decryptedProfile.repositoryHistory.map((item: { repository: string; lastUsed: string | Date }) => ({
            ...item,
            lastUsed: new Date(item.lastUsed)
          }));
        }
        
        return decryptedProfile;
      }

      // 暗号化されていない旧プロファイルを探す（マイグレーション用）
      const legacyProfile = ProfileManager.getProfile(profileId);
      if (legacyProfile) {
        // 暗号化して保存
        await this.saveProfile(legacyProfile);
        // 旧プロファイルを削除
        localStorage.removeItem(`agentapi-profile-${profileId}`);
        return legacyProfile;
      }

      return null;
    } catch (err) {
      console.error('Failed to load secure profile:', err);
      return null;
    }
  }

  /**
   * プロファイルを暗号化して保存
   */
  static async saveProfile(profile: Profile): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const key = `${SECURE_PROFILE_KEY_PREFIX}${profile.id}`;
      
      // repositoryHistoryのDateオブジェクトをISO文字列に変換
      const profileToSave = {
        ...profile,
        repositoryHistory: profile.repositoryHistory.map(item => ({
          ...item,
          lastUsed: item.lastUsed instanceof Date ? item.lastUsed.toISOString() : item.lastUsed
        }))
      };
      
      // 機密フィールドを暗号化
      const encryptedProfile = await encryptSensitiveFields(profileToSave);
      
      localStorage.setItem(key, JSON.stringify(encryptedProfile));
    } catch (err) {
      console.error('Failed to save secure profile:', err);
      throw err;
    }
  }

  /**
   * プロファイルを作成（暗号化対応）
   */
  static async createProfile(profileData: CreateProfileRequest): Promise<Profile> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const profile: Profile = {
      id,
      name: profileData.name,
      description: profileData.description,
      icon: profileData.icon,
      mainColor: profileData.mainColor,
      systemPrompt: profileData.systemPrompt,
      fixedOrganizations: profileData.fixedOrganizations || [],
      agentApiProxy: profileData.agentApiProxy,
      repositoryHistory: [],
      environmentVariables: profileData.environmentVariables,
      messageTemplates: [],
      isDefault: profileData.isDefault || false,
      created_at: now,
      updated_at: now,
    };

    await this.saveProfile(profile);
    this.updateProfilesList();

    if (profile.isDefault) {
      this.setDefaultProfile(profile.id);
    }

    return profile;
  }

  /**
   * プロファイルを更新（暗号化対応）
   */
  static async updateProfile(profileId: string, updates: UpdateProfileRequest): Promise<Profile | null> {
    const existingProfile = await this.getProfile(profileId);
    if (!existingProfile) {
      throw new Error('Profile not found');
    }

    const updatedProfile: Profile = {
      ...existingProfile,
      ...updates,
      agentApiProxy: updates.agentApiProxy 
        ? { ...existingProfile.agentApiProxy, ...updates.agentApiProxy }
        : existingProfile.agentApiProxy,
      updated_at: new Date().toISOString(),
    };

    await this.saveProfile(updatedProfile);
    this.updateProfilesList();

    if (updates.isDefault) {
      this.setDefaultProfile(profileId);
    }

    return updatedProfile;
  }

  /**
   * プロファイルを削除
   */
  static async deleteProfile(profileId: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const profile = await this.getProfile(profileId);
      if (!profile) {
        return false;
      }

      // 暗号化されたプロファイルを削除
      localStorage.removeItem(`${SECURE_PROFILE_KEY_PREFIX}${profileId}`);
      // 旧プロファイルも削除（念のため）
      localStorage.removeItem(`agentapi-profile-${profileId}`);
      
      if (profile.isDefault) {
        localStorage.removeItem('agentapi-default-profile-id');
        const remainingProfiles = this.getProfiles().filter(p => p.id !== profileId);
        if (remainingProfiles.length > 0) {
          this.setDefaultProfile(remainingProfiles[0].id);
        }
      }

      this.updateProfilesList();
      return true;
    } catch (err) {
      console.error('Failed to delete profile:', err);
      return false;
    }
  }

  /**
   * デフォルトプロファイルを取得
   */
  static async getDefaultProfile(): Promise<Profile | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      // URL パラメータから profile を確認
      const urlParams = new URLSearchParams(window.location.search);
      const profileIdFromUrl = urlParams.get('profile');
      if (profileIdFromUrl) {
        const profile = await this.getProfile(profileIdFromUrl);
        if (profile) {
          return profile;
        }
      }

      // デフォルトプロファイル ID を取得
      const defaultProfileId = localStorage.getItem('agentapi-default-profile-id');
      if (defaultProfileId) {
        const profile = await this.getProfile(defaultProfileId);
        if (profile) {
          return profile;
        }
      }

      // プロファイルリストから探す
      const profiles = this.getProfiles();
      const defaultProfile = profiles.find(p => p.isDefault);
      if (defaultProfile) {
        return await this.getProfile(defaultProfile.id);
      }

      // 最初のプロファイルを返す
      if (profiles.length > 0) {
        return await this.getProfile(profiles[0].id);
      }

      // プロファイルがない場合は作成
      return await this.createDefaultProfile();
    } catch (err) {
      console.error('Failed to get default profile:', err);
      return await this.createDefaultProfile();
    }
  }

  /**
   * リポジトリを履歴に追加
   */
  static async addRepositoryToProfile(profileId: string, repository: string): Promise<void> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      console.error('Profile not found:', profileId);
      return;
    }

    const existingIndex = profile.repositoryHistory.findIndex(
      item => item.repository === repository
    );

    const now = new Date();
    
    if (existingIndex !== -1) {
      profile.repositoryHistory[existingIndex].lastUsed = now;
    } else {
      profile.repositoryHistory.unshift({
        repository,
        lastUsed: now,
      });
    }

    profile.repositoryHistory.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
    profile.repositoryHistory = profile.repositoryHistory.slice(0, 10);

    await this.saveProfile(profile);
    this.updateProfilesList();
  }

  /**
   * プロファイルをエクスポート（暗号化情報は除外）
   */
  static async exportProfile(profileId: string): Promise<string | null> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    // APIキーや機密情報を除外
    const exportData = {
      ...profile,
      agentApiProxy: {
        ...profile.agentApiProxy,
        apiKey: undefined,
      },
      githubAuth: undefined,
      environmentVariables: profile.environmentVariables?.map(env => ({
        ...env,
        value: undefined, // 環境変数の値は除外
      })),
      mcpServers: profile.mcpServers?.map(server => ({
        ...server,
        env: undefined, // MCP サーバーの環境変数は除外
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 既存プロファイルのマイグレーション
   */
  static async migrateExistingProfiles(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    // すでにマイグレーション済みか確認
    const migrationStatus = localStorage.getItem(MIGRATION_STATUS_KEY);
    if (migrationStatus === 'completed') {
      return;
    }

    try {
      console.log('Starting profile migration to encrypted storage...');
      
      // 既存のプロファイルリストを取得
      const profiles = ProfileManager.getProfiles();
      
      for (const profileItem of profiles) {
        const legacyProfile = ProfileManager.getProfile(profileItem.id);
        if (legacyProfile) {
          console.log(`Migrating profile: ${legacyProfile.name}`);
          
          // 暗号化して保存
          await this.saveProfile(legacyProfile);
          
          // 旧プロファイルを削除
          localStorage.removeItem(`agentapi-profile-${profileItem.id}`);
        }
      }

      // マイグレーション完了を記録
      localStorage.setItem(MIGRATION_STATUS_KEY, 'completed');
      console.log('Profile migration completed successfully');
    } catch (err) {
      console.error('Failed to migrate profiles:', err);
    }
  }

  // 以下は ProfileManager と同じ実装（暗号化対応のため一部変更）
  static getProfiles(): ProfileListItem[] {
    return ProfileManager.getProfiles();
  }

  static setDefaultProfile(profileId: string): void {
    ProfileManager.setDefaultProfile(profileId);
  }

  static getCurrentProfileId(): string | null {
    return ProfileManager.getCurrentProfileId();
  }

  static setProfileInUrl(profileId: string): void {
    ProfileManager.setProfileInUrl(profileId);
  }

  static removeProfileFromUrl(): void {
    ProfileManager.removeProfileFromUrl();
  }

  static markProfileUsed(profileId: string): void {
    ProfileManager.markProfileUsed(profileId);
  }

  private static updateProfilesList(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const profiles: ProfileListItem[] = [];
      const keys = Object.keys(localStorage);
      
      for (const key of keys) {
        // 暗号化されたプロファイルを優先的に探す
        if (key.startsWith(SECURE_PROFILE_KEY_PREFIX)) {
          // const profileId = key.replace(SECURE_PROFILE_KEY_PREFIX, '');
          // 非同期関数内では同期的にプロファイルリストを更新できないため、
          // プロファイルの基本情報のみを取得
          try {
            const encryptedProfile = JSON.parse(localStorage.getItem(key) || '{}');
            if (encryptedProfile.id) {
              profiles.push({
                id: encryptedProfile.id,
                name: encryptedProfile.name,
                description: encryptedProfile.description,
                icon: encryptedProfile.icon,
                isDefault: encryptedProfile.isDefault,
                lastUsed: encryptedProfile.updated_at,
                repositoryCount: encryptedProfile.repositoryHistory?.length || 0,
              });
            }
          } catch (err) {
            console.error('Failed to parse profile:', key, err);
          }
        }
      }

      // 旧プロファイルも含める（マイグレーション前）
      const legacyProfiles = ProfileManager.getProfiles();
      for (const legacyProfile of legacyProfiles) {
        if (!profiles.find(p => p.id === legacyProfile.id)) {
          profiles.push(legacyProfile);
        }
      }

      profiles.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        
        const aLastUsed = new Date(a.lastUsed || 0).getTime();
        const bLastUsed = new Date(b.lastUsed || 0).getTime();
        return bLastUsed - aLastUsed;
      });

      localStorage.setItem('agentapi-profiles-list', JSON.stringify(profiles));
    } catch (err) {
      console.error('Failed to update profiles list:', err);
    }
  }

  private static async createDefaultProfile(): Promise<Profile> {
    const { getDefaultSettings, getDefaultProxySettings } = await import('../types/settings');
    const defaultSettings = getDefaultSettings();
    const defaultProxySettings = getDefaultProxySettings();
    
    return await this.createProfile({
      name: 'Default',
      description: 'Default profile',
      icon: '⚙️',
      fixedOrganizations: [],
      agentApiProxy: defaultProxySettings,
      environmentVariables: defaultSettings.environmentVariables,
      isDefault: true,
    });
  }
}

export const secureProfileManager = SecureProfileManager;