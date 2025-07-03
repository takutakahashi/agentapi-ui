import { Profile, ProfileListItem, CreateProfileRequest, UpdateProfileRequest } from '../types/profile';
import { loadGlobalSettings, getDefaultSettings, getDefaultProxySettings } from '../types/settings';
import { v4 as uuidv4 } from 'uuid';
import { CryptoUtils } from './crypto';
import { IndexedDBWrapper } from './indexedDB';

/**
 * セキュアなプロファイル管理クラス
 * 暗号化 + IndexedDB でXSS攻撃から保護
 */
export class SecureProfileManager {
  private static password: string | null = null;
  private static isInitialized = false;

  /**
   * パスワードを設定してマネージャーを初期化
   */
  static async initialize(password: string): Promise<void> {
    // パスワード強度チェック
    const validation = CryptoUtils.validatePassword(password);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    this.password = password;
    await IndexedDBWrapper.initialize();
    this.isInitialized = true;
  }

  /**
   * 初期化状態をチェック
   */
  private static checkInitialized(): void {
    if (!this.isInitialized || !this.password) {
      throw new Error('SecureProfileManagerが初期化されていません。initialize()を呼び出してください。');
    }
  }

  /**
   * パスワードを変更
   */
  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    this.checkInitialized();
    
    if (oldPassword !== this.password) {
      throw new Error('現在のパスワードが正しくありません');
    }

    const validation = CryptoUtils.validatePassword(newPassword);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // 全てのプロファイルを再暗号化
    const profiles = await this.getProfiles();
    
    for (const profileItem of profiles) {
      const profile = await this.getProfile(profileItem.id);
      if (profile) {
        const encryptedData = await CryptoUtils.encrypt(profile, newPassword);
        await IndexedDBWrapper.saveProfile(profile.id, encryptedData, this.createMetadata(profile));
      }
    }

    this.password = newPassword;
  }

  /**
   * プロファイル一覧を取得
   */
  static async getProfiles(): Promise<ProfileListItem[]> {
    this.checkInitialized();
    
    try {
      const profiles = await IndexedDBWrapper.getProfiles();
      return profiles.map(profile => ({
        id: profile.id as string,
        name: profile.name as string,
        description: profile.description as string,
        icon: profile.icon as string,
        isDefault: profile.isDefault as boolean,
        lastUsed: profile.lastUsed as string,
        repositoryCount: profile.repositoryCount as number,
      }));
    } catch (err) {
      console.error('プロファイル一覧の取得に失敗:', err);
      return [];
    }
  }

  /**
   * プロファイルを取得
   */
  static async getProfile(profileId: string): Promise<Profile | null> {
    this.checkInitialized();
    
    try {
      const result = await IndexedDBWrapper.getProfile(profileId);
      if (!result) {
        return null;
      }

      const profile = await CryptoUtils.decrypt(result.encryptedData, this.password!) as Profile;
      
      // repositoryHistoryのlastUsedを文字列からDateオブジェクトに変換
      if (profile.repositoryHistory) {
        profile.repositoryHistory = profile.repositoryHistory.map((item: { repository: string; lastUsed: string | Date }) => ({
          ...item,
          lastUsed: new Date(item.lastUsed)
        }));
      }

      // 移行処理（既存ProfileManagerと同じ）
      const profileAny = profile as Profile & { fixedRepository?: string; fixedRepositories?: string[] };
      if (profileAny.fixedRepository && !profile.fixedOrganizations) {
        const org = profileAny.fixedRepository.split('/')[0];
        profile.fixedOrganizations = org ? [org] : [];
        delete profileAny.fixedRepository;
        await this.saveProfile(profile);
      } else if (profileAny.fixedRepositories && !profile.fixedOrganizations) {
        const orgs = [...new Set(profileAny.fixedRepositories
          .map((repo: string) => repo.split('/')[0])
          .filter((org: string) => org))] as string[];
        profile.fixedOrganizations = orgs;
        delete profileAny.fixedRepositories;
        await this.saveProfile(profile);
      } else if (!profile.fixedOrganizations) {
        profile.fixedOrganizations = [];
      }
      
      return profile;
    } catch (err) {
      console.error('プロファイルの取得に失敗:', err);
      return null;
    }
  }

  /**
   * プロファイルを作成
   */
  static async createProfile(profileData: CreateProfileRequest): Promise<Profile> {
    this.checkInitialized();
    
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

    if (profile.isDefault) {
      await this.setDefaultProfile(profile.id);
    }

    return profile;
  }

  /**
   * プロファイルを更新
   */
  static async updateProfile(profileId: string, updates: UpdateProfileRequest): Promise<Profile | null> {
    this.checkInitialized();
    
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

    if (updates.isDefault) {
      await this.setDefaultProfile(profileId);
    }

    return updatedProfile;
  }

  /**
   * プロファイルを削除
   */
  static async deleteProfile(profileId: string): Promise<boolean> {
    this.checkInitialized();
    
    try {
      const profile = await this.getProfile(profileId);
      if (!profile) {
        return false;
      }

      await IndexedDBWrapper.deleteProfile(profileId);
      
      if (profile.isDefault) {
        const remainingProfiles = await this.getProfiles();
        const filteredProfiles = remainingProfiles.filter(p => p.id !== profileId);
        if (filteredProfiles.length > 0) {
          await this.setDefaultProfile(filteredProfiles[0].id);
        }
      }

      return true;
    } catch (err) {
      console.error('プロファイルの削除に失敗:', err);
      return false;
    }
  }

  /**
   * デフォルトプロファイルを設定
   */
  static async setDefaultProfile(profileId: string): Promise<void> {
    this.checkInitialized();
    
    const profiles = await this.getProfiles();
    
    // 全てのプロファイルのisDefaultをfalseに
    for (const profileItem of profiles) {
      const profile = await this.getProfile(profileItem.id);
      if (profile) {
        profile.isDefault = profile.id === profileId;
        await this.saveProfile(profile);
      }
    }

    await IndexedDBWrapper.setDefaultProfileId(profileId);
  }

  /**
   * デフォルトプロファイルを取得
   */
  static async getDefaultProfile(): Promise<Profile | null> {
    this.checkInitialized();
    
    try {
      // URL パラメータを最初にチェック
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const profileIdFromUrl = urlParams.get('profile');
        if (profileIdFromUrl) {
          const profile = await this.getProfile(profileIdFromUrl);
          if (profile) {
            return profile;
          }
        }
      }

      // デフォルトプロファイルIDを取得
      const defaultProfileId = await IndexedDBWrapper.getDefaultProfileId();
      if (defaultProfileId) {
        const profile = await this.getProfile(defaultProfileId);
        if (profile) {
          return profile;
        }
      }

      // isDefaultがtrueのプロファイルを検索
      const profiles = await this.getProfiles();
      const defaultProfile = profiles.find(p => p.isDefault);
      if (defaultProfile) {
        return await this.getProfile(defaultProfile.id);
      }

      // 最初のプロファイルを返す
      if (profiles.length > 0) {
        return await this.getProfile(profiles[0].id);
      }

      // デフォルトプロファイルを作成
      return await this.createDefaultProfile();
    } catch (err) {
      console.error('デフォルトプロファイルの取得に失敗:', err);
      return await this.createDefaultProfile();
    }
  }

  /**
   * 現在のプロファイルIDを取得
   */
  static async getCurrentProfileId(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    // URL パラメータを最初にチェック
    const urlParams = new URLSearchParams(window.location.search);
    const profileIdFromUrl = urlParams.get('profile');
    if (profileIdFromUrl) {
      const profile = await this.getProfile(profileIdFromUrl);
      if (profile) {
        return profileIdFromUrl;
      }
    }

    // デフォルトプロファイルにフォールバック
    const defaultProfile = await this.getDefaultProfile();
    return defaultProfile?.id || null;
  }

  /**
   * プロファイルをURLに設定
   */
  static setProfileInUrl(profileId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('profile', profileId);
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * プロファイルをURLから削除
   */
  static removeProfileFromUrl(): void {
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
    this.checkInitialized();
    
    const profile = await this.getProfile(profileId);
    if (profile) {
      profile.updated_at = new Date().toISOString();
      await this.saveProfile(profile);
    }
  }

  /**
   * リポジトリをプロファイルに追加
   */
  static async addRepositoryToProfile(profileId: string, repository: string): Promise<void> {
    this.checkInitialized();
    
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
  }

  /**
   * プロファイルをエクスポート
   */
  static async exportProfile(profileId: string): Promise<string | null> {
    this.checkInitialized();
    
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
  }

  /**
   * プロファイルをインポート
   */
  static async importProfile(jsonData: string): Promise<Profile | null> {
    this.checkInitialized();
    
    try {
      const profileData = JSON.parse(jsonData);
      
      if (!profileData.name || !profileData.agentApiProxy) {
        throw new Error('Invalid profile data');
      }

      const createRequest: CreateProfileRequest = {
        name: profileData.name,
        description: profileData.description,
        icon: profileData.icon,
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
      console.error('プロファイルのインポートに失敗:', err);
      return null;
    }
  }

  /**
   * 既存設定を移行
   */
  static async migrateExistingSettings(): Promise<void> {
    this.checkInitialized();
    
    const profiles = await this.getProfiles();
    if (profiles.length > 0) {
      return;
    }

    const globalSettings = loadGlobalSettings();
    const defaultProxySettings = getDefaultProxySettings();
    
    await this.createProfile({
      name: 'Default',
      description: 'Migrated from existing settings',
      icon: '⚙️',
      fixedOrganizations: [],
      agentApiProxy: defaultProxySettings,
      environmentVariables: globalSettings.environmentVariables,
      isDefault: true,
    });
  }

  /**
   * プロファイルを保存（内部メソッド）
   */
  private static async saveProfile(profile: Profile): Promise<void> {
    this.checkInitialized();
    
    try {
      // repositoryHistoryのDateオブジェクトをISO文字列に変換してから暗号化
      const profileToSave = {
        ...profile,
        repositoryHistory: profile.repositoryHistory.map(item => ({
          ...item,
          lastUsed: item.lastUsed instanceof Date ? item.lastUsed.toISOString() : item.lastUsed
        }))
      };
      
      const encryptedData = await CryptoUtils.encrypt(profileToSave, this.password!);
      const metadata = this.createMetadata(profile);
      
      await IndexedDBWrapper.saveProfile(profile.id, encryptedData, metadata);
    } catch (err) {
      console.error('プロファイルの保存に失敗:', err);
      throw err;
    }
  }

  /**
   * プロファイルのメタデータを作成
   */
  private static createMetadata(profile: Profile): Record<string, unknown> {
    return {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      icon: profile.icon,
      isDefault: profile.isDefault,
      lastUsed: profile.updated_at,
      repositoryCount: profile.repositoryHistory.length,
    };
  }

  /**
   * デフォルトプロファイルを作成
   */
  private static async createDefaultProfile(): Promise<Profile> {
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

  /**
   * ストレージ使用量を取得
   */
  static async getStorageUsage(): Promise<{ used: number; quota: number }> {
    return await IndexedDBWrapper.getStorageUsage();
  }

  /**
   * 全てのデータを削除
   */
  static async clearAllData(): Promise<void> {
    this.checkInitialized();
    await IndexedDBWrapper.clearAllProfiles();
  }

  /**
   * ログアウト（パスワードをクリア）
   */
  static logout(): void {
    this.password = null;
    this.isInitialized = false;
    IndexedDBWrapper.close();
  }
}