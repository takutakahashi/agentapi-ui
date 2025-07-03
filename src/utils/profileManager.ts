import { Profile, ProfileListItem, CreateProfileRequest, UpdateProfileRequest } from '../types/profile';
import { loadGlobalSettings, getDefaultSettings, getDefaultProxySettings } from '../types/settings';
import { v4 as uuidv4 } from 'uuid';
import { 
  ProfileError, 
  StorageError, 
  ErrorType, 
  convertToAppError 
} from '../types/errors';
import { errorLogger } from './errorLogger';

const PROFILES_LIST_KEY = 'agentapi-profiles-list';
const PROFILE_KEY_PREFIX = 'agentapi-profile-';
const DEFAULT_PROFILE_KEY = 'agentapi-default-profile-id';

export class ProfileManager {
  static async getProfiles(): Promise<ProfileListItem[]> {
    const context = { method: 'getProfiles', key: PROFILES_LIST_KEY };
    
    if (typeof window === 'undefined') {
      errorLogger.debug('getProfiles: Server-side rendering, returning empty array', context);
      return [];
    }

    try {
      const stored = localStorage.getItem(PROFILES_LIST_KEY);
      if (!stored) {
        errorLogger.debug('getProfiles: No profiles found in storage', context);
        return [];
      }
      
      const profiles = JSON.parse(stored);
      if (!Array.isArray(profiles)) {
        throw new StorageError(
          ErrorType.STORAGE_INVALID_DATA,
          'Profiles list is not an array',
          'プロファイル一覧のデータが破損しています。',
          { ...context, dataType: typeof profiles }
        );
      }

      errorLogger.debug(`getProfiles: Successfully loaded ${profiles.length} profiles`, context);
      return profiles;
    } catch (err) {
      const appError = convertToAppError(err, context);
      
      if (appError instanceof StorageError) {
        errorLogger.logError(appError);
        throw appError;
      }

      // JSON parse errorの場合
      if (err instanceof SyntaxError) {
        const parseError = new StorageError(
          ErrorType.STORAGE_INVALID_DATA,
          `Failed to parse profiles list: ${err.message}`,
          'プロファイル一覧のデータが破損しています。設定をリセットすることをお勧めします。',
          context,
          err
        );
        errorLogger.logError(parseError);
        throw parseError;
      }

      // その他のエラー
      const storageError = new StorageError(
        ErrorType.STORAGE_OPERATION_FAILED,
        `Failed to load profiles list: ${err}`,
        'プロファイル一覧の読み込みに失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(storageError);
      throw storageError;
    }
  }

  static async getProfile(profileId: string): Promise<Profile | null> {
    const context = { method: 'getProfile', profileId, key: `${PROFILE_KEY_PREFIX}${profileId}` };
    
    if (!profileId) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Profile ID is required',
        'プロファイルIDが指定されていません。',
        context
      );
      errorLogger.logError(error);
      throw error;
    }

    if (typeof window === 'undefined') {
      errorLogger.debug('getProfile: Server-side rendering, returning null', context);
      return null;
    }

    try {
      const stored = localStorage.getItem(`${PROFILE_KEY_PREFIX}${profileId}`);
      if (!stored) {
        errorLogger.debug('getProfile: Profile not found in storage', context);
        return null;
      }
      
      const profile = JSON.parse(stored);
      
      // プロファイルの基本構造を検証
      if (!profile || typeof profile !== 'object' || !profile.id || !profile.name) {
        throw new ProfileError(
          ErrorType.PROFILE_INVALID_DATA,
          `Profile data is invalid: missing required fields`,
          'プロファイルデータが不正です。',
          { ...context, profile: profile }
        );
      }

      // repositoryHistoryのlastUsedを文字列からDateオブジェクトに変換
      if (profile.repositoryHistory) {
        try {
          profile.repositoryHistory = profile.repositoryHistory.map((item: { repository: string; lastUsed: string | Date }) => ({
            ...item,
            lastUsed: new Date(item.lastUsed)
          }));
        } catch (dateError) {
          errorLogger.warn('Failed to parse repository history dates', { ...context, dateError });
          profile.repositoryHistory = [];
        }
      }
      
      let needsSave = false;
      
      // fixedRepository/fixedRepositories から fixedOrganizations への移行処理
      try {
        if (profile.fixedRepository && !profile.fixedOrganizations) {
          // 単一のfixedRepositoryからorgを抽出
          const org = profile.fixedRepository.split('/')[0];
          profile.fixedOrganizations = org ? [org] : [];
          delete profile.fixedRepository;
          needsSave = true;
          errorLogger.info('Migrated fixedRepository to fixedOrganizations', { ...context, org });
        } else if (profile.fixedRepositories && !profile.fixedOrganizations) {
          // fixedRepositoriesからorgリストを抽出
          const orgs = [...new Set(profile.fixedRepositories
            .map((repo: string) => repo.split('/')[0])
            .filter((org: string) => org))];
          profile.fixedOrganizations = orgs;
          delete profile.fixedRepositories;
          needsSave = true;
          errorLogger.info('Migrated fixedRepositories to fixedOrganizations', { ...context, orgs });
        } else if (!profile.fixedOrganizations) {
          profile.fixedOrganizations = [];
        }
      } catch (migrationError) {
        const error = new ProfileError(
          ErrorType.PROFILE_MIGRATION_FAILED,
          `Profile migration failed: ${migrationError}`,
          'プロファイルの移行処理に失敗しました。',
          context,
          migrationError instanceof Error ? migrationError : undefined
        );
        errorLogger.logError(error);
        // 移行失敗でもプロファイルは返す（部分的に動作する可能性があるため）
        profile.fixedOrganizations = profile.fixedOrganizations || [];
      }
      
      // 移行が必要な場合のみ保存
      if (needsSave) {
        // 非同期で保存し、結果を待たない（パフォーマンス向上）
        this.saveProfile(profile).catch(err => {
          const saveError = convertToAppError(err, { ...context, operation: 'migration_save' });
          errorLogger.logError(saveError);
        });
      }
      
      errorLogger.debug('getProfile: Successfully loaded profile', { ...context, profileName: profile.name });
      return profile;
    } catch (err) {
      if (err instanceof ProfileError) {
        throw err;
      }

      if (err instanceof SyntaxError) {
        const parseError = new ProfileError(
          ErrorType.PROFILE_INVALID_DATA,
          `Failed to parse profile: ${err.message}`,
          'プロファイルデータが破損しています。',
          context,
          err
        );
        errorLogger.logError(parseError);
        throw parseError;
      }

      const storageError = new StorageError(
        ErrorType.STORAGE_OPERATION_FAILED,
        `Failed to load profile: ${err}`,
        'プロファイルの読み込みに失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(storageError);
      throw storageError;
    }
  }

  static async createProfile(profileData: CreateProfileRequest): Promise<Profile> {
    const context = { method: 'createProfile', profileName: profileData.name };
    
    // 入力データの検証
    if (!profileData.name || !profileData.name.trim()) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Profile name is required',
        'プロファイル名は必須です。',
        context
      );
      errorLogger.logError(error);
      throw error;
    }

    if (!profileData.agentApiProxy || !profileData.agentApiProxy.endpoint) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'AgentAPI proxy endpoint is required',
        'AgentAPIプロキシのエンドポイントは必須です。',
        context
      );
      errorLogger.logError(error);
      throw error;
    }

    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      const profile: Profile = {
        id,
        name: profileData.name.trim(),
        description: profileData.description?.trim(),
        icon: profileData.icon,
        mainColor: profileData.mainColor,
        systemPrompt: profileData.systemPrompt?.trim(),
        fixedOrganizations: profileData.fixedOrganizations || [],
        agentApiProxy: profileData.agentApiProxy,
        repositoryHistory: [],
        environmentVariables: profileData.environmentVariables || [],
        messageTemplates: [],
        isDefault: profileData.isDefault || false,
        created_at: now,
        updated_at: now,
      };

      errorLogger.info('Creating new profile', { ...context, profileId: id });

      await this.saveProfile(profile);
      await this.updateProfilesList();

      if (profile.isDefault) {
        await this.setDefaultProfile(profile.id);
      }

      errorLogger.info('Profile created successfully', { ...context, profileId: id });
      return profile;
    } catch (err) {
      if (err instanceof ProfileError || err instanceof StorageError) {
        throw err;
      }

      const createError = new ProfileError(
        ErrorType.PROFILE_CREATION_FAILED,
        `Failed to create profile: ${err}`,
        'プロファイルの作成に失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(createError);
      throw createError;
    }
  }

  static async updateProfile(profileId: string, updates: UpdateProfileRequest): Promise<Profile | null> {
    const context = { method: 'updateProfile', profileId, updates: Object.keys(updates) };
    
    if (!profileId) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Profile ID is required',
        'プロファイルIDが指定されていません。',
        context
      );
      errorLogger.logError(error);
      throw error;
    }

    try {
      const existingProfile = await this.getProfile(profileId);
      if (!existingProfile) {
        const error = new ProfileError(
          ErrorType.PROFILE_NOT_FOUND,
          `Profile not found: ${profileId}`,
          'プロファイルが見つかりません。',
          context
        );
        errorLogger.logError(error);
        throw error;
      }

      // 更新データの検証
      if (updates.name !== undefined && (!updates.name || !updates.name.trim())) {
        const error = new ProfileError(
          ErrorType.PROFILE_VALIDATION_FAILED,
          'Profile name cannot be empty',
          'プロファイル名を空にすることはできません。',
          context
        );
        errorLogger.logError(error);
        throw error;
      }

      if (updates.agentApiProxy?.endpoint !== undefined && !updates.agentApiProxy.endpoint.trim()) {
        const error = new ProfileError(
          ErrorType.PROFILE_VALIDATION_FAILED,
          'AgentAPI proxy endpoint cannot be empty',
          'AgentAPIプロキシのエンドポイントを空にすることはできません。',
          context
        );
        errorLogger.logError(error);
        throw error;
      }

      const updatedProfile: Profile = {
        ...existingProfile,
        ...updates,
        // 文字列フィールドのトリム処理
        name: updates.name?.trim() || existingProfile.name,
        description: updates.description?.trim() || existingProfile.description,
        systemPrompt: updates.systemPrompt?.trim() || existingProfile.systemPrompt,
        // agentApiProxyの適切なマージ
        agentApiProxy: updates.agentApiProxy 
          ? { ...existingProfile.agentApiProxy, ...updates.agentApiProxy }
          : existingProfile.agentApiProxy,
        updated_at: new Date().toISOString(),
      };

      errorLogger.info('Updating profile', { ...context, profileName: updatedProfile.name });

      await this.saveProfile(updatedProfile);
      await this.updateProfilesList();

      if (updates.isDefault) {
        await this.setDefaultProfile(profileId);
      }

      errorLogger.info('Profile updated successfully', { ...context, profileName: updatedProfile.name });
      return updatedProfile;
    } catch (err) {
      if (err instanceof ProfileError || err instanceof StorageError) {
        throw err;
      }

      const updateError = new ProfileError(
        ErrorType.PROFILE_UPDATE_FAILED,
        `Failed to update profile: ${err}`,
        'プロファイルの更新に失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(updateError);
      throw updateError;
    }
  }

  static async deleteProfile(profileId: string): Promise<boolean> {
    const context = { method: 'deleteProfile', profileId };
    
    if (!profileId) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Profile ID is required',
        'プロファイルIDが指定されていません。',
        context
      );
      errorLogger.logError(error);
      throw error;
    }

    if (typeof window === 'undefined') {
      errorLogger.debug('deleteProfile: Server-side rendering, returning false', context);
      return false;
    }

    try {
      const profile = await this.getProfile(profileId);
      if (!profile) {
        errorLogger.info('deleteProfile: Profile not found, returning false', context);
        return false;
      }

      errorLogger.info('Deleting profile', { ...context, profileName: profile.name, isDefault: profile.isDefault });

      // プロファイルデータを削除
      localStorage.removeItem(`${PROFILE_KEY_PREFIX}${profileId}`);
      
      // デフォルトプロファイルの場合は、他のプロファイルをデフォルトに設定
      if (profile.isDefault) {
        localStorage.removeItem(DEFAULT_PROFILE_KEY);
        const remainingProfiles = (await this.getProfiles()).filter(p => p.id !== profileId);
        if (remainingProfiles.length > 0) {
          await this.setDefaultProfile(remainingProfiles[0].id);
          errorLogger.info('Set new default profile after deletion', { 
            ...context, 
            newDefaultId: remainingProfiles[0].id,
            newDefaultName: remainingProfiles[0].name 
          });
        } else {
          errorLogger.info('No remaining profiles after deletion', context);
        }
      }

      await this.updateProfilesList();
      
      errorLogger.info('Profile deleted successfully', { ...context, profileName: profile.name });
      return true;
    } catch (err) {
      if (err instanceof ProfileError || err instanceof StorageError) {
        // プロファイルが見つからない場合は削除失敗ではない
        if (err instanceof ProfileError && err.type === ErrorType.PROFILE_NOT_FOUND) {
          errorLogger.info('Profile not found for deletion, returning false', context);
          return false;
        }
        throw err;
      }

      const deleteError = new ProfileError(
        ErrorType.PROFILE_DELETE_FAILED,
        `Failed to delete profile: ${err}`,
        'プロファイルの削除に失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(deleteError);
      throw deleteError;
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
    const context = { method: 'saveProfile', profileId: profile.id, profileName: profile.name };
    
    if (typeof window === 'undefined') {
      errorLogger.debug('saveProfile: Server-side rendering, skipping save', context);
      return;
    }

    if (!profile || !profile.id) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Invalid profile data: missing id',
        'プロファイルデータが不正です。',
        context
      );
      errorLogger.logError(error);
      throw error;
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
      
      // ストレージ容量チェック（概算）
      const estimatedSize = new Blob([serializedProfile]).size;
      if (estimatedSize > 5 * 1024 * 1024) { // 5MB制限
        const error = new StorageError(
          ErrorType.STORAGE_QUOTA_EXCEEDED,
          `Profile data too large: ${estimatedSize} bytes`,
          'プロファイルデータが大きすぎます。環境変数やテンプレートを削減してください。',
          { ...context, estimatedSize }
        );
        errorLogger.logError(error);
        throw error;
      }
      
      errorLogger.debug('Saving profile to localStorage', { ...context, key, estimatedSize });
      localStorage.setItem(key, serializedProfile);
      errorLogger.debug('Profile saved successfully to localStorage', context);
    } catch (err) {
      if (err instanceof StorageError || err instanceof ProfileError) {
        throw err;
      }

      // DOMException handling
      if (err instanceof DOMException) {
        if (err.name === 'QuotaExceededError') {
          const quotaError = new StorageError(
            ErrorType.STORAGE_QUOTA_EXCEEDED,
            err.message,
            'ストレージの容量が不足しています。不要なプロファイルやデータを削除してください。',
            context,
            err
          );
          errorLogger.logError(quotaError);
          throw quotaError;
        }

        if (err.name === 'SecurityError') {
          const securityError = new StorageError(
            ErrorType.STORAGE_ACCESS_DENIED,
            err.message,
            'ブラウザの設定によりデータの保存ができません。プライベートモードを無効にするか、設定を確認してください。',
            context,
            err
          );
          errorLogger.logError(securityError);
          throw securityError;
        }
      }

      const saveError = new StorageError(
        ErrorType.STORAGE_OPERATION_FAILED,
        `Failed to save profile: ${err}`,
        'プロファイルの保存に失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(saveError);
      throw saveError;
    }
  }

  private static async updateProfilesList(): Promise<void> {
    const context = { method: 'updateProfilesList' };
    
    if (typeof window === 'undefined') {
      errorLogger.debug('updateProfilesList: Server-side rendering, skipping update', context);
      return;
    }

    try {
      const profiles: ProfileListItem[] = [];
      const keys = Object.keys(localStorage);
      let corruptedProfiles = 0;
      
      keys.forEach(key => {
        if (key.startsWith(PROFILE_KEY_PREFIX)) {
          try {
            const stored = localStorage.getItem(key);
            if (!stored) return;
            
            const profile: Profile = JSON.parse(stored);
            
            // 基本的な検証
            if (!profile.id || !profile.name) {
              errorLogger.warn('Skipping corrupted profile in list update', { key, profile });
              corruptedProfiles++;
              return;
            }
            
            profiles.push({
              id: profile.id,
              name: profile.name,
              description: profile.description,
              icon: profile.icon,
              mainColor: profile.mainColor,
              isDefault: profile.isDefault,
              lastUsed: profile.updated_at,
              repositoryCount: profile.repositoryHistory?.length || 0,
            });
          } catch (parseError) {
            errorLogger.warn('Failed to parse profile during list update', { 
              key, 
              error: parseError instanceof Error ? parseError.message : String(parseError) 
            });
            corruptedProfiles++;
          }
        }
      });

      if (corruptedProfiles > 0) {
        errorLogger.warn(`Found ${corruptedProfiles} corrupted profiles during list update`, context);
      }

      // ソート：デフォルトプロファイルを最初に、その後は最終更新日時順
      profiles.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        
        const aLastUsed = new Date(a.lastUsed || 0).getTime();
        const bLastUsed = new Date(b.lastUsed || 0).getTime();
        return bLastUsed - aLastUsed;
      });

      errorLogger.debug(`Updating profiles list with ${profiles.length} profiles`, { 
        ...context, 
        profileCount: profiles.length,
        corruptedProfiles 
      });

      await this.saveProfilesList(profiles);
    } catch (err) {
      const error = new StorageError(
        ErrorType.STORAGE_OPERATION_FAILED,
        `Failed to update profiles list: ${err}`,
        'プロファイル一覧の更新に失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(error);
      throw error;
    }
  }

  private static async saveProfilesList(profiles: ProfileListItem[]): Promise<void> {
    const context = { method: 'saveProfilesList', profileCount: profiles.length };
    
    if (typeof window === 'undefined') {
      errorLogger.debug('saveProfilesList: Server-side rendering, skipping save', context);
      return;
    }

    try {
      const serializedProfiles = JSON.stringify(profiles);
      
      // ストレージ容量チェック（概算）
      const estimatedSize = new Blob([serializedProfiles]).size;
      if (estimatedSize > 1024 * 1024) { // 1MB制限（リストなので小さめ）
        const error = new StorageError(
          ErrorType.STORAGE_QUOTA_EXCEEDED,
          `Profiles list too large: ${estimatedSize} bytes`,
          'プロファイル一覧のデータが大きすぎます。',
          { ...context, estimatedSize }
        );
        errorLogger.logError(error);
        throw error;
      }
      
      errorLogger.debug('Saving profiles list to localStorage', { ...context, estimatedSize });
      localStorage.setItem(PROFILES_LIST_KEY, serializedProfiles);
      errorLogger.debug('Profiles list saved successfully', context);
    } catch (err) {
      if (err instanceof StorageError) {
        throw err;
      }

      // DOMException handling
      if (err instanceof DOMException) {
        if (err.name === 'QuotaExceededError') {
          const quotaError = new StorageError(
            ErrorType.STORAGE_QUOTA_EXCEEDED,
            err.message,
            'ストレージの容量が不足しています。',
            context,
            err
          );
          errorLogger.logError(quotaError);
          throw quotaError;
        }

        if (err.name === 'SecurityError') {
          const securityError = new StorageError(
            ErrorType.STORAGE_ACCESS_DENIED,
            err.message,
            'ブラウザの設定によりデータの保存ができません。',
            context,
            err
          );
          errorLogger.logError(securityError);
          throw securityError;
        }
      }

      const saveError = new StorageError(
        ErrorType.STORAGE_OPERATION_FAILED,
        `Failed to save profiles list: ${err}`,
        'プロファイル一覧の保存に失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(saveError);
      throw saveError;
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
    const context = { method: 'createDefaultProfile' };
    
    try {
      const defaultSettings = getDefaultSettings();
      const defaultProxySettings = getDefaultProxySettings();
      
      errorLogger.info('Creating default profile', context);
      
      return await this.createProfile({
        name: 'Default',
        description: 'Default profile',
        icon: '⚙️',
        fixedOrganizations: [],
        agentApiProxy: defaultProxySettings,
        environmentVariables: defaultSettings.environmentVariables,
        isDefault: true,
      });
    } catch (err) {
      const createError = new ProfileError(
        ErrorType.PROFILE_CREATION_FAILED,
        `Failed to create default profile: ${err}`,
        'デフォルトプロファイルの作成に失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(createError);
      throw createError;
    }
  }

  /**
   * エラー回復用のメソッド：破損したプロファイルデータをクリーンアップ
   */
  static async cleanupCorruptedProfiles(): Promise<{ cleaned: number; errors: string[] }> {
    const context = { method: 'cleanupCorruptedProfiles' };
    const results = { cleaned: 0, errors: [] as string[] };
    
    if (typeof window === 'undefined') {
      return results;
    }

    try {
      const keys = Object.keys(localStorage);
      const profileKeys = keys.filter(key => key.startsWith(PROFILE_KEY_PREFIX));
      
      for (const key of profileKeys) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const profile = JSON.parse(stored);
            
            // 基本的な検証
            if (!profile.id || !profile.name || !profile.agentApiProxy) {
              localStorage.removeItem(key);
              results.cleaned++;
              errorLogger.info(`Removed corrupted profile: ${key}`, context);
            }
          }
        } catch (parseError) {
          localStorage.removeItem(key);
          results.cleaned++;
          results.errors.push(`Failed to parse ${key}: ${parseError}`);
          errorLogger.warn(`Removed unparseable profile: ${key}`, { ...context, parseError });
        }
      }

      // プロファイル一覧も再構築
      if (results.cleaned > 0) {
        await this.updateProfilesList();
        errorLogger.info(`Cleanup completed: ${results.cleaned} profiles cleaned`, context);
      }

      return results;
    } catch (err) {
      const cleanupError = new StorageError(
        ErrorType.STORAGE_OPERATION_FAILED,
        `Profile cleanup failed: ${err}`,
        'プロファイルのクリーンアップに失敗しました。',
        context,
        err instanceof Error ? err : undefined
      );
      errorLogger.logError(cleanupError);
      throw cleanupError;
    }
  }

  /**
   * ストレージ使用量の確認
   */
  static getStorageUsage(): { used: number; total: number; profiles: number } {
    if (typeof window === 'undefined') {
      return { used: 0, total: 0, profiles: 0 };
    }

    try {
      let totalSize = 0;
      let profileCount = 0;
      
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key) || '';
          totalSize += new Blob([key + value]).size;
          
          if (key.startsWith(PROFILE_KEY_PREFIX)) {
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