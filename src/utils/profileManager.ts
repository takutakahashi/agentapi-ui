import { Profile, ProfileListItem, CreateProfileRequest, UpdateProfileRequest } from '../types/profile';
import { loadGlobalSettings, getDefaultSettings } from '../types/settings';
import { v4 as uuidv4 } from 'uuid';

const PROFILES_LIST_KEY = 'agentapi-profiles-list';
const PROFILE_KEY_PREFIX = 'agentapi-profile-';
const DEFAULT_PROFILE_KEY = 'agentapi-default-profile-id';

export class ProfileManager {
  static getProfiles(): ProfileListItem[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(PROFILES_LIST_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch (err) {
      console.error('Failed to load profiles list:', err);
      return [];
    }
  }

  static getProfile(profileId: string): Profile | null {
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
      
      return profile;
    } catch (err) {
      console.error('Failed to load profile:', err);
      return null;
    }
  }

  static createProfile(profileData: CreateProfileRequest): Profile {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const profile: Profile = {
      id,
      name: profileData.name,
      description: profileData.description,
      icon: profileData.icon,
      systemPrompt: profileData.systemPrompt,
      agentApiProxy: profileData.agentApiProxy,
      repositoryHistory: [],
      environmentVariables: profileData.environmentVariables,
      messageTemplates: [],
      isDefault: profileData.isDefault || false,
      created_at: now,
      updated_at: now,
    };

    this.saveProfile(profile);
    this.updateProfilesList();

    if (profile.isDefault) {
      this.setDefaultProfile(profile.id);
    }

    return profile;
  }

  static updateProfile(profileId: string, updates: UpdateProfileRequest): Profile | null {
    const existingProfile = this.getProfile(profileId);
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

    this.saveProfile(updatedProfile);
    this.updateProfilesList();

    if (updates.isDefault) {
      this.setDefaultProfile(profileId);
    }

    return updatedProfile;
  }

  static deleteProfile(profileId: string): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const profile = this.getProfile(profileId);
      if (!profile) {
        return false;
      }

      localStorage.removeItem(`${PROFILE_KEY_PREFIX}${profileId}`);
      
      if (profile.isDefault) {
        localStorage.removeItem(DEFAULT_PROFILE_KEY);
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

  static setDefaultProfile(profileId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const profiles = this.getProfiles();
    profiles.forEach(profile => {
      const fullProfile = this.getProfile(profile.id);
      if (fullProfile) {
        fullProfile.isDefault = profile.id === profileId;
        this.saveProfile(fullProfile);
      }
    });

    try {
      localStorage.setItem(DEFAULT_PROFILE_KEY, profileId);
    } catch (err) {
      console.error('Failed to set default profile:', err);
    }

    this.updateProfilesList();
  }

  static getDefaultProfile(): Profile | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      // Check for profile in URL parameters first
      const urlParams = new URLSearchParams(window.location.search);
      const profileIdFromUrl = urlParams.get('profile');
      if (profileIdFromUrl) {
        const profile = this.getProfile(profileIdFromUrl);
        if (profile) {
          return profile;
        }
      }

      const defaultProfileId = localStorage.getItem(DEFAULT_PROFILE_KEY);
      if (defaultProfileId) {
        const profile = this.getProfile(defaultProfileId);
        if (profile) {
          return profile;
        }
      }

      const profiles = this.getProfiles();
      const defaultProfile = profiles.find(p => p.isDefault);
      if (defaultProfile) {
        return this.getProfile(defaultProfile.id);
      }

      if (profiles.length > 0) {
        return this.getProfile(profiles[0].id);
      }

      return this.createDefaultProfile();
    } catch (err) {
      console.error('Failed to get default profile:', err);
      return this.createDefaultProfile();
    }
  }

  static getCurrentProfileId(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const profileIdFromUrl = urlParams.get('profile');
    if (profileIdFromUrl) {
      const profile = this.getProfile(profileIdFromUrl);
      if (profile) {
        return profileIdFromUrl;
      }
    }

    // Fall back to default profile
    const defaultProfile = this.getDefaultProfile();
    return defaultProfile?.id || null;
  }

  static setProfileInUrl(profileId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('profile', profileId);
    window.history.replaceState({}, '', url.toString());
  }

  static removeProfileFromUrl(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('profile');
    window.history.replaceState({}, '', url.toString());
  }

  static markProfileUsed(profileId: string): void {
    const profiles = this.getProfiles();
    const profileIndex = profiles.findIndex(p => p.id === profileId);
    
    if (profileIndex !== -1) {
      profiles[profileIndex].lastUsed = new Date().toISOString();
      this.saveProfilesList(profiles);
    }
  }

  static migrateExistingSettings(): void {
    const profiles = this.getProfiles();
    if (profiles.length > 0) {
      return;
    }

    const globalSettings = loadGlobalSettings();
    
    this.createProfile({
      name: 'Default',
      description: 'Migrated from existing settings',
      icon: '⚙️',
      agentApiProxy: globalSettings.agentApiProxy,
      environmentVariables: globalSettings.environmentVariables,
      isDefault: true,
    });
  }

  static addRepositoryToProfile(profileId: string, repository: string): void {
    console.log('ProfileManager.addRepositoryToProfile called:', { profileId, repository });
    
    const profile = this.getProfile(profileId);
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
    this.saveProfile(profile);
    this.updateProfilesList();
    
    console.log('Repository added to profile history successfully');
  }

  private static saveProfile(profile: Profile): void {
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

  private static updateProfilesList(): void {
    if (typeof window === 'undefined') {
      return;
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

      this.saveProfilesList(profiles);
    } catch (err) {
      console.error('Failed to update profiles list:', err);
    }
  }

  private static saveProfilesList(profiles: ProfileListItem[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(PROFILES_LIST_KEY, JSON.stringify(profiles));
    } catch (err) {
      console.error('Failed to save profiles list:', err);
    }
  }

  private static createDefaultProfile(): Profile {
    const defaultSettings = getDefaultSettings();
    
    return this.createProfile({
      name: 'Default',
      description: 'Default profile',
      icon: '⚙️',
      agentApiProxy: defaultSettings.agentApiProxy,
      environmentVariables: defaultSettings.environmentVariables,
      isDefault: true,
    });
  }
}

export const profileManager = ProfileManager;