import { Profile, ProfileListItem, CreateProfileRequest, UpdateProfileRequest } from '../types/profile';
import { loadGlobalSettings, getDefaultSettings, getDefaultProxySettings } from '../types/settings';
import { v4 as uuidv4 } from 'uuid';

const PROFILES_LIST_KEY = 'agentapi-profiles-list';
const PROFILE_KEY_PREFIX = 'agentapi-profile-';
const DEFAULT_PROFILE_KEY = 'agentapi-default-profile-id';

export class ProfileManager {
  static getProfiles(): Promise<ProfileListItem[]> {
    if (typeof window === 'undefined') {
      return Promise.resolve([]);
    }

    try {
      const stored = localStorage.getItem(PROFILES_LIST_KEY);
      if (!stored) {
        return Promise.resolve([]);
      }
      return Promise.resolve(JSON.parse(stored));
    } catch (err) {
      console.error('Failed to load profiles list:', err);
      return Promise.resolve([]);
    }
  }

  static async getProfile(profileId: string): Promise<Profile | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem(`${PROFILE_KEY_PREFIX}${profileId}`);
      if (!stored) {
        return null;
      }
      const profile = JSON.parse(stored);
      
      // repositoryHistoryのlastUsedを文字列からDateオブジェクトに変換
      if (profile.repositoryHistory) {
        profile.repositoryHistory = profile.repositoryHistory.map((item: { repository: string; lastUsed: string | Date }) => ({
          ...item,
          lastUsed: new Date(item.lastUsed)
        }));
      }
      
      let needsSave = false;
      
      // fixedRepository/fixedRepositories から fixedOrganizations への移行処理
      if (profile.fixedRepository && !profile.fixedOrganizations) {
        // 単一のfixedRepositoryからorgを抽出
        const org = profile.fixedRepository.split('/')[0];
        profile.fixedOrganizations = org ? [org] : [];
        delete profile.fixedRepository;
        needsSave = true;
      } else if (profile.fixedRepositories && !profile.fixedOrganizations) {
        // fixedRepositoriesからorgリストを抽出
        const orgs = [...new Set(profile.fixedRepositories
          .map((repo: string) => repo.split('/')[0])
          .filter((org: string) => org))];
        profile.fixedOrganizations = orgs;
        delete profile.fixedRepositories;
        needsSave = true;
      } else if (!profile.fixedOrganizations) {
        profile.fixedOrganizations = [];
      }
      
      // 移行が必要な場合のみ保存
      if (needsSave) {
        // 非同期で保存し、結果を待たない（パフォーマンス向上）
        this.saveProfile(profile).catch(err => 
          console.error('Failed to save migrated profile:', err)
        );
      }
      
      return profile;
    } catch (err) {
      console.error('Failed to load profile:', err);
      return null;
    }
  }

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
    await this.updateProfilesList();

    if (profile.isDefault) {
      await this.setDefaultProfile(profile.id);
    }

    return profile;
  }

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
    await this.updateProfilesList();

    if (updates.isDefault) {
      this.setDefaultProfile(profileId);
    }

    return updatedProfile;
  }

  static async deleteProfile(profileId: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const profile = await this.getProfile(profileId);
      if (!profile) {
        return false;
      }

      localStorage.removeItem(`${PROFILE_KEY_PREFIX}${profileId}`);
      
      if (profile.isDefault) {
        localStorage.removeItem(DEFAULT_PROFILE_KEY);
        const remainingProfiles = (await this.getProfiles()).filter(p => p.id !== profileId);
        if (remainingProfiles.length > 0) {
          await this.setDefaultProfile(remainingProfiles[0].id);
        }
      }

      await this.updateProfilesList();
      return true;
    } catch (err) {
      console.error('Failed to delete profile:', err);
      return false;
    }
  }

  static async setDefaultProfile(profileId: string): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const profiles = await this.getProfiles();
    
    // 並列でプロファイルを取得・更新
    const updatePromises = profiles.map(async (profile) => {
      const fullProfile = await this.getProfile(profile.id);
      if (fullProfile) {
        fullProfile.isDefault = profile.id === profileId;
        return this.saveProfile(fullProfile);
      }
      return Promise.resolve();
    });

    // localStorage の設定と並列実行
    const localStoragePromise = Promise.resolve().then(() => {
      try {
        localStorage.setItem(DEFAULT_PROFILE_KEY, profileId);
      } catch (err) {
        console.error('Failed to set default profile:', err);
      }
    });

    // すべての更新を並列で実行
    await Promise.all([
      ...updatePromises,
      localStoragePromise,
      this.updateProfilesList()
    ]);
  }

  static async getDefaultProfile(): Promise<Profile | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      // Check for profile in URL parameters first
      const urlParams = new URLSearchParams(window.location.search);
      const profileIdFromUrl = urlParams.get('profile');
      if (profileIdFromUrl) {
        const profile = await this.getProfile(profileIdFromUrl);
        if (profile) {
          return profile;
        }
      }

      const defaultProfileId = localStorage.getItem(DEFAULT_PROFILE_KEY);
      if (defaultProfileId) {
        const profile = await this.getProfile(defaultProfileId);
        if (profile) {
          return profile;
        }
      }

      const profiles = await this.getProfiles();
      const defaultProfile = profiles.find(p => p.isDefault);
      if (defaultProfile) {
        return await this.getProfile(defaultProfile.id);
      }

      if (profiles.length > 0) {
        return await this.getProfile(profiles[0].id);
      }

      return await this.createDefaultProfile();
    } catch (err) {
      console.error('Failed to get default profile:', err);
      return await this.createDefaultProfile();
    }
  }

  static async getCurrentProfileId(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const profileIdFromUrl = urlParams.get('profile');
    if (profileIdFromUrl) {
      const profile = await this.getProfile(profileIdFromUrl);
      if (profile) {
        return profileIdFromUrl;
      }
    }

    // Fall back to default profile
    const defaultProfile = await this.getDefaultProfile();
    return defaultProfile?.id || null;
  }

  static async setProfileInUrl(profileId: string): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('profile', profileId);
    window.history.replaceState({}, '', url.toString());
  }

  static async removeProfileFromUrl(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('profile');
    window.history.replaceState({}, '', url.toString());
  }

  static markProfileUsed(profileId: string): Promise<void> {
    return this.getProfiles().then(profiles => {
      const profileIndex = profiles.findIndex(p => p.id === profileId);
    
      if (profileIndex !== -1) {
        profiles[profileIndex].lastUsed = new Date().toISOString();
        return this.saveProfilesList(profiles);
      }
      return Promise.resolve();
    });
  }

  static async migrateExistingSettings(): Promise<void> {
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

  static async addRepositoryToProfile(profileId: string, repository: string): Promise<void> {
    console.log('ProfileManager.addRepositoryToProfile called:', { profileId, repository });
    
    const profile = await this.getProfile(profileId);
    if (!profile) {
      console.error('Profile not found:', profileId);
      return;
    }

    console.log('Current profile repository history:', profile.repositoryHistory);

    const existingIndex = profile.repositoryHistory.findIndex(
      item => item.repository === repository
    );

    const now = new Date();
    
    if (existingIndex !== -1) {
      console.log('Updating existing repository in history');
      // 保存時は ISO 文字列として保存
      profile.repositoryHistory[existingIndex].lastUsed = now;
    } else {
      console.log('Adding new repository to history');
      profile.repositoryHistory.unshift({
        repository,
        lastUsed: now,
      });
    }

    profile.repositoryHistory.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
    profile.repositoryHistory = profile.repositoryHistory.slice(0, 10);

    console.log('Updated profile repository history:', profile.repositoryHistory);

    // ProfileManagerの内部保存処理を呼び出すのではなく、直接localStorageに保存して整合性を保つ
    await this.saveProfile(profile);
    await this.updateProfilesList();
    
    console.log('Repository added to profile history successfully');
  }

  private static async saveProfile(profile: Profile): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('saveProfile: window is undefined, skipping save');
      return;
    }

    try {
      const key = `${PROFILE_KEY_PREFIX}${profile.id}`;
      
      // repositoryHistoryのDateオブジェクトをISO文字列に変換してから保存
      const profileToSave = {
        ...profile,
        repositoryHistory: profile.repositoryHistory.map(item => ({
          ...item,
          lastUsed: item.lastUsed instanceof Date ? item.lastUsed.toISOString() : item.lastUsed
        }))
      };
      
      const serializedProfile = JSON.stringify(profileToSave);
      console.log('Saving profile to localStorage:', { key, profile: profileToSave });
      localStorage.setItem(key, serializedProfile);
      console.log('Profile saved successfully to localStorage');
    } catch (err) {
      console.error('Failed to save profile:', err);
      throw err;
    }
  }

  private static updateProfilesList(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    try {
      const profiles: ProfileListItem[] = [];
      const keys = Object.keys(localStorage);
      
      keys.forEach(key => {
        if (key.startsWith(PROFILE_KEY_PREFIX)) {
          try {
            const profile: Profile = JSON.parse(localStorage.getItem(key) || '{}');
            profiles.push({
              id: profile.id,
              name: profile.name,
              description: profile.description,
              icon: profile.icon,
              isDefault: profile.isDefault,
              lastUsed: profile.updated_at,
              repositoryCount: profile.repositoryHistory.length,
            });
          } catch (err) {
            console.error('Failed to parse profile:', key, err);
          }
        }
      });

      profiles.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        
        const aLastUsed = new Date(a.lastUsed || 0).getTime();
        const bLastUsed = new Date(b.lastUsed || 0).getTime();
        return bLastUsed - aLastUsed;
      });

      return this.saveProfilesList(profiles);
    } catch (err) {
      console.error('Failed to update profiles list:', err);
      return Promise.resolve();
    }
  }

  private static saveProfilesList(profiles: ProfileListItem[]): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    try {
      localStorage.setItem(PROFILES_LIST_KEY, JSON.stringify(profiles));
      return Promise.resolve();
    } catch (err) {
      console.error('Failed to save profiles list:', err);
      return Promise.resolve();
    }
  }

  static async exportProfile(profileId: string): Promise<string | null> {
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

  static async importProfile(jsonData: string): Promise<Profile | null> {
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
      console.error('Failed to import profile:', err);
      return null;
    }
  }

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
}

export const profileManager = ProfileManager;