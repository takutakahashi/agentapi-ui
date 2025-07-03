/**
 * 型安全なProfileManagerの実装
 */

import { 
  Profile, 
  ProfileListItem, 
  CreateProfileRequest, 
  UpdateProfileRequest 
} from '../types/profile';
import { getDefaultSettings, getDefaultProxySettings } from '../types/settings';
import { v4 as uuidv4 } from 'uuid';
import { 
  ProfileError, 
  StorageError, 
  ErrorType, 
  convertToAppError 
} from '../types/errors';
import { errorLogger } from './errorLogger';
import { SafeStorage } from './safeStorage';
import {
  ProfileId,
  LocalStorageKey,
  SafePromise,
  AsyncState,
  createProfileId,
  createProfileName,
  createISODateString,
  createLocalStorageKey,
  isValidProfileId
} from '../types/typeUtils';
import {
  isProfile,
  isProfileListItem,
  validateCreateProfileRequest,
  validateUpdateProfileRequest
} from './profileValidation';

// 型安全な定数定義
const PROFILES_LIST_KEY = createLocalStorageKey('agentapi-profiles-list');
const PROFILE_KEY_PREFIX = 'agentapi-profile-';
const DEFAULT_PROFILE_KEY = createLocalStorageKey('agentapi-default-profile-id');

/**
 * プロファイル操作の結果型
 */
export type ProfileOperationResult<T> = SafePromise<T, ProfileError | StorageError>;

/**
 * プロファイル一覧の取得結果
 */
export type ProfileListResult = ProfileOperationResult<ProfileListItem[]>;

/**
 * プロファイル取得の結果
 */
export type ProfileResult = ProfileOperationResult<Profile | null>;

/**
 * プロファイル作成の結果
 */
export type ProfileCreateResult = ProfileOperationResult<Profile>;

/**
 * プロファイル更新の結果
 */
export type ProfileUpdateResult = ProfileOperationResult<Profile | null>;

/**
 * プロファイル削除の結果
 */
export type ProfileDeleteResult = ProfileOperationResult<boolean>;

/**
 * デフォルトプロファイル設定の結果
 */
export type SetDefaultProfileResult = ProfileOperationResult<void>;

/**
 * プロファイルの状態管理
 */
export type ProfileState<T> = AsyncState<T, ProfileError | StorageError>;

/**
 * 型安全なProfileManager
 */
export class SafeProfileManager {
  /**
   * サーバーサイドレンダリングの確認
   */
  private static get isServerSide(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * プロファイルキーの生成
   */
  private static createProfileKey(profileId: ProfileId): LocalStorageKey {
    return createLocalStorageKey(`${PROFILE_KEY_PREFIX}${profileId}`);
  }

  /**
   * プロファイル一覧の取得（型安全）
   */
  static async getProfiles(): Promise<ProfileListResult> {
    const context = { method: 'SafeProfileManager.getProfiles', key: PROFILES_LIST_KEY };
    
    if (this.isServerSide) {
      errorLogger.debug('getProfiles: Server-side rendering, returning empty array', context);
      return { success: true, data: [] };
    }

    try {
      const result = await SafeStorage.get(PROFILES_LIST_KEY);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (result.data === null) {
        errorLogger.debug('getProfiles: No profiles found in storage', context);
        return { success: true, data: [] };
      }

      // 型ガードによる検証
      if (!Array.isArray(result.data)) {
        const error = new StorageError(
          ErrorType.STORAGE_INVALID_DATA,
          'Profiles list is not an array',
          'プロファイル一覧のデータが破損しています。',
          { ...context, dataType: typeof result.data }
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      // 各項目の型安全性を確認
      const validProfiles: ProfileListItem[] = [];
      const invalidCount = result.data.length;

      for (const item of result.data) {
        if (isProfileListItem(item)) {
          validProfiles.push(item);
        } else {
          errorLogger.warn('Invalid profile list item found', { ...context, item });
        }
      }

      if (validProfiles.length !== invalidCount) {
        errorLogger.warn(`Found ${invalidCount - validProfiles.length} invalid profile items`, context);
      }

      errorLogger.debug(`getProfiles: Successfully loaded ${validProfiles.length} profiles`, context);
      return { success: true, data: validProfiles };
    } catch (err) {
      const appError = convertToAppError(err, context) as ProfileError | StorageError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * プロファイルの取得（型安全）
   */
  static async getProfile(profileId: ProfileId): Promise<ProfileResult> {
    const context = { 
      method: 'SafeProfileManager.getProfile', 
      profileId, 
      key: this.createProfileKey(profileId) 
    };
    
    // プロファイルIDの検証
    if (!isValidProfileId(profileId)) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Profile ID is invalid',
        'プロファイルIDが不正です。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    if (this.isServerSide) {
      errorLogger.debug('getProfile: Server-side rendering, returning null', context);
      return { success: true, data: null };
    }

    try {
      const profileKey = this.createProfileKey(profileId);
      const result = await SafeStorage.get(profileKey);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (result.data === null) {
        errorLogger.debug('getProfile: Profile not found in storage', context);
        return { success: true, data: null };
      }

      // 型ガードによる検証
      if (!isProfile(result.data)) {
        const error = new ProfileError(
          ErrorType.PROFILE_INVALID_DATA,
          'Profile data is invalid: failed type guard validation',
          'プロファイルデータが不正です。',
          { ...context, profile: result.data }
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      // プロファイルのマイグレーション処理（必要に応じて）
      const migratedProfile = await this.migrateProfileIfNeeded(result.data);
      
      errorLogger.debug('getProfile: Successfully loaded profile', { ...context, profileName: migratedProfile.name });
      return { success: true, data: migratedProfile };
    } catch (err) {
      const appError = convertToAppError(err, context) as ProfileError | StorageError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * プロファイルの作成（型安全）
   */
  static async createProfile(profileData: CreateProfileRequest): Promise<ProfileCreateResult> {
    const context = { method: 'SafeProfileManager.createProfile', profileName: profileData.name };
    
    try {
      // リクエストデータの検証
      const validationResult = validateCreateProfileRequest(profileData);
      if (!validationResult.valid) {
        const error = new ProfileError(
          ErrorType.PROFILE_VALIDATION_FAILED,
          `Profile validation failed: ${validationResult.errors.join(', ')}`,
          validationResult.errors.join('\n'),
          context
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      const validatedData = validationResult.value;
      const profileId = createProfileId(uuidv4());
      const now = createISODateString(new Date());
      
      const profile: Profile = {
        id: profileId,
        name: validatedData.name,
        description: validatedData.description,
        icon: validatedData.icon,
        mainColor: validatedData.mainColor,
        systemPrompt: validatedData.systemPrompt,
        fixedOrganizations: validatedData.fixedOrganizations,
        agentApiProxy: validatedData.agentApiProxy,
        repositoryHistory: [],
        environmentVariables: validatedData.environmentVariables,
        messageTemplates: [],
        isDefault: validatedData.isDefault || false,
        created_at: now,
        updated_at: now,
      };

      errorLogger.info('Creating new profile', { ...context, profileId });

      // プロファイルの保存
      const saveResult = await this.saveProfile(profile);
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }

      // プロファイル一覧の更新
      const updateListResult = await this.updateProfilesList();
      if (!updateListResult.success) {
        errorLogger.warn('Failed to update profiles list after creation', { 
          ...context, 
          error: updateListResult.error 
        });
        // プロファイルは作成されたが、一覧の更新に失敗
      }

      // デフォルトプロファイルの設定
      if (profile.isDefault) {
        const setDefaultResult = await this.setDefaultProfile(profile.id);
        if (!setDefaultResult.success) {
          errorLogger.warn('Failed to set as default profile after creation', { 
            ...context, 
            error: setDefaultResult.error 
          });
        }
      }

      errorLogger.info('Profile created successfully', { ...context, profileId });
      return { success: true, data: profile };
    } catch (err) {
      const appError = convertToAppError(err, context) as ProfileError | StorageError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * プロファイルの更新（型安全）
   */
  static async updateProfile(
    profileId: ProfileId, 
    updates: UpdateProfileRequest
  ): Promise<ProfileUpdateResult> {
    const context = { 
      method: 'SafeProfileManager.updateProfile', 
      profileId, 
      updates: Object.keys(updates) 
    };
    
    // プロファイルIDの検証
    if (!isValidProfileId(profileId)) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Profile ID is invalid',
        'プロファイルIDが不正です。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      // 更新データの検証
      const validationResult = validateUpdateProfileRequest(updates);
      if (!validationResult.valid) {
        const error = new ProfileError(
          ErrorType.PROFILE_VALIDATION_FAILED,
          `Profile update validation failed: ${validationResult.errors.join(', ')}`,
          validationResult.errors.join('\n'),
          context
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      const validatedUpdates = validationResult.value;

      // 既存プロファイルの取得
      const existingResult = await this.getProfile(profileId);
      if (!existingResult.success) {
        return { success: false, error: existingResult.error };
      }

      if (existingResult.data === null) {
        const error = new ProfileError(
          ErrorType.PROFILE_NOT_FOUND,
          `Profile not found: ${profileId}`,
          'プロファイルが見つかりません。',
          context
        );
        errorLogger.logError(error);
        return { success: false, error };
      }

      const existingProfile = existingResult.data;

      // プロファイルの更新
      const updatedProfile: Profile = {
        ...existingProfile,
        ...validatedUpdates,
        // agentApiProxyの適切なマージ
        agentApiProxy: validatedUpdates.agentApiProxy 
          ? { ...existingProfile.agentApiProxy, ...validatedUpdates.agentApiProxy }
          : existingProfile.agentApiProxy,
        updated_at: createISODateString(new Date()),
      };

      errorLogger.info('Updating profile', { ...context, profileName: updatedProfile.name });

      // プロファイルの保存
      const saveResult = await this.saveProfile(updatedProfile);
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }

      // プロファイル一覧の更新
      const updateListResult = await this.updateProfilesList();
      if (!updateListResult.success) {
        errorLogger.warn('Failed to update profiles list after update', { 
          ...context, 
          error: updateListResult.error 
        });
      }

      // デフォルト設定の更新
      if (validatedUpdates.isDefault) {
        const setDefaultResult = await this.setDefaultProfile(profileId);
        if (!setDefaultResult.success) {
          errorLogger.warn('Failed to set as default profile after update', { 
            ...context, 
            error: setDefaultResult.error 
          });
        }
      }

      errorLogger.info('Profile updated successfully', { ...context, profileName: updatedProfile.name });
      return { success: true, data: updatedProfile };
    } catch (err) {
      const appError = convertToAppError(err, context) as ProfileError | StorageError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * プロファイルの削除（型安全）
   */
  static async deleteProfile(profileId: ProfileId): Promise<ProfileDeleteResult> {
    const context = { method: 'SafeProfileManager.deleteProfile', profileId };
    
    // プロファイルIDの検証
    if (!isValidProfileId(profileId)) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Profile ID is invalid',
        'プロファイルIDが不正です。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    if (this.isServerSide) {
      errorLogger.debug('deleteProfile: Server-side rendering, returning false', context);
      return { success: true, data: false };
    }

    try {
      // 既存プロファイルの確認
      const existingResult = await this.getProfile(profileId);
      if (!existingResult.success) {
        return { success: false, error: existingResult.error };
      }

      if (existingResult.data === null) {
        errorLogger.info('deleteProfile: Profile not found, returning false', context);
        return { success: true, data: false };
      }

      const profile = existingResult.data;

      errorLogger.info('Deleting profile', { 
        ...context, 
        profileName: profile.name, 
        isDefault: profile.isDefault 
      });

      // プロファイルデータの削除
      const profileKey = this.createProfileKey(profileId);
      const removeResult = SafeStorage.remove(profileKey);
      if (!removeResult.success) {
        return { success: false, error: removeResult.error };
      }
      
      // デフォルトプロファイルの場合は、他のプロファイルをデフォルトに設定
      if (profile.isDefault) {
        const defaultRemoveResult = SafeStorage.remove(DEFAULT_PROFILE_KEY);
        if (!defaultRemoveResult.success) {
          errorLogger.warn('Failed to remove default profile key', { 
            ...context, 
            error: defaultRemoveResult.error 
          });
        }

        const remainingResult = await this.getProfiles();
        if (remainingResult.success && remainingResult.data.length > 0) {
          const remainingProfiles = remainingResult.data.filter(p => p.id !== profileId);
          if (remainingProfiles.length > 0) {
            const setDefaultResult = await this.setDefaultProfile(remainingProfiles[0].id);
            if (setDefaultResult.success) {
              errorLogger.info('Set new default profile after deletion', { 
                ...context, 
                newDefaultId: remainingProfiles[0].id,
                newDefaultName: remainingProfiles[0].name 
              });
            } else {
              errorLogger.warn('Failed to set new default profile after deletion', { 
                ...context, 
                error: setDefaultResult.error 
              });
            }
          } else {
            errorLogger.info('No remaining profiles after deletion', context);
          }
        }
      }

      // プロファイル一覧の更新
      const updateListResult = await this.updateProfilesList();
      if (!updateListResult.success) {
        errorLogger.warn('Failed to update profiles list after deletion', { 
          ...context, 
          error: updateListResult.error 
        });
      }
      
      errorLogger.info('Profile deleted successfully', { ...context, profileName: profile.name });
      return { success: true, data: true };
    } catch (err) {
      const appError = convertToAppError(err, context) as ProfileError | StorageError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * デフォルトプロファイルの設定（型安全）
   */
  static async setDefaultProfile(profileId: ProfileId): Promise<SetDefaultProfileResult> {
    const context = { method: 'SafeProfileManager.setDefaultProfile', profileId };

    if (this.isServerSide) {
      return { success: true, data: undefined };
    }

    // プロファイルIDの検証
    if (!isValidProfileId(profileId)) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Profile ID is invalid',
        'プロファイルIDが不正です。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      // 全プロファイルの取得
      const profilesResult = await this.getProfiles();
      if (!profilesResult.success) {
        return { success: false, error: profilesResult.error };
      }

      const profiles = profilesResult.data;
      
      // 並列でプロファイルを取得・更新
      const updatePromises = profiles.map(async (profileItem) => {
        const fullProfileResult = await this.getProfile(profileItem.id);
        if (fullProfileResult.success && fullProfileResult.data) {
          const fullProfile = fullProfileResult.data;
          const updatedProfile: Profile = {
            ...fullProfile,
            isDefault: profileItem.id === profileId,
            updated_at: createISODateString(new Date())
          };
          return this.saveProfile(updatedProfile);
        }
        return { success: true, data: undefined };
      });

      // localStorage の設定
      const storageSetResult = await SafeStorage.set(DEFAULT_PROFILE_KEY, profileId);
      
      // すべての更新を並列で実行
      const results = await Promise.all([
        ...updatePromises,
        Promise.resolve(storageSetResult),
        this.updateProfilesList()
      ]);

      // エラーチェック
      for (const result of results) {
        if (result && 'success' in result && !result.success) {
          errorLogger.warn('Failed to complete setDefaultProfile operation', {
            ...context,
            error: (result as { error: ProfileError | StorageError }).error
          });
          return { success: false, error: (result as { error: ProfileError | StorageError }).error };
        }
      }

      errorLogger.info('Default profile set successfully', context);
      return { success: true, data: undefined };
    } catch (err) {
      const appError = convertToAppError(err, context) as ProfileError | StorageError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * デフォルトプロファイルの取得（型安全）
   */
  static async getDefaultProfile(): Promise<ProfileResult> {
    const context = { method: 'SafeProfileManager.getDefaultProfile' };

    if (this.isServerSide) {
      return { success: true, data: null };
    }

    try {
      // URL パラメータから確認
      const urlParams = new URLSearchParams(window.location.search);
      const profileIdFromUrl = urlParams.get('profile');
      if (profileIdFromUrl && isValidProfileId(profileIdFromUrl)) {
        const profileResult = await this.getProfile(createProfileId(profileIdFromUrl));
        if (profileResult.success && profileResult.data) {
          return { success: true, data: profileResult.data };
        }
      }

      // localStorage から確認
      const defaultIdResult = await SafeStorage.get<ProfileId>(DEFAULT_PROFILE_KEY);
      if (defaultIdResult.success && defaultIdResult.data) {
        const profileResult = await this.getProfile(defaultIdResult.data);
        if (profileResult.success && profileResult.data) {
          return { success: true, data: profileResult.data };
        }
      }

      // プロファイル一覧からデフォルトを検索
      const profilesResult = await this.getProfiles();
      if (profilesResult.success) {
        const defaultProfile = profilesResult.data.find(p => p.isDefault);
        if (defaultProfile) {
          return await this.getProfile(defaultProfile.id);
        }

        // 最初のプロファイルを返す
        if (profilesResult.data.length > 0) {
          return await this.getProfile(profilesResult.data[0].id);
        }
      }

      // デフォルトプロファイルを作成
      return await this.createDefaultProfile();
    } catch (err) {
      const appError = convertToAppError(err, context) as ProfileError | StorageError;
      errorLogger.logError(appError);
      
      // エラーが発生した場合もデフォルトプロファイルを作成を試行
      try {
        return await this.createDefaultProfile();
      } catch (createErr) {
        const createError = convertToAppError(createErr, context) as ProfileError | StorageError;
        return { success: false, error: createError };
      }
    }
  }

  /**
   * プロファイルの保存（内部メソッド、型安全）
   */
  private static async saveProfile(profile: Profile): Promise<SafePromise<void, StorageError | ProfileError>> {
    const context = { 
      method: 'SafeProfileManager.saveProfile', 
      profileId: profile.id, 
      profileName: profile.name 
    };
    
    if (this.isServerSide) {
      errorLogger.debug('saveProfile: Server-side rendering, skipping save', context);
      return { success: true, data: undefined };
    }

    // プロファイルの型検証
    if (!isProfile(profile)) {
      const error = new ProfileError(
        ErrorType.PROFILE_VALIDATION_FAILED,
        'Invalid profile data: failed type guard validation',
        'プロファイルデータが不正です。',
        context
      );
      errorLogger.logError(error);
      return { success: false, error };
    }

    try {
      const profileKey = this.createProfileKey(profile.id);
      
      // repositoryHistoryのDateオブジェクトをISO文字列に変換
      const profileToSave: Profile = {
        ...profile,
        repositoryHistory: profile.repositoryHistory.map(item => ({
          ...item,
          lastUsed: item.lastUsed instanceof Date 
            ? item.lastUsed 
            : new Date(item.lastUsed)
        }))
      };
      
      const saveResult = await SafeStorage.set(profileKey, JSON.parse(JSON.stringify(profileToSave)));
      
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }
      
      errorLogger.debug('Profile saved successfully', context);
      return { success: true, data: undefined };
    } catch (err) {
      const appError = convertToAppError(err, context) as StorageError | ProfileError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * プロファイル一覧の更新（内部メソッド、型安全）
   */
  private static async updateProfilesList(): Promise<SafePromise<void, StorageError>> {
    const context = { method: 'SafeProfileManager.updateProfilesList' };
    
    if (this.isServerSide) {
      errorLogger.debug('updateProfilesList: Server-side rendering, skipping update', context);
      return { success: true, data: undefined };
    }

    try {
      const profiles: ProfileListItem[] = [];
      
      // 全てのプロファイルキーを取得
      const keysResult = SafeStorage.getKeysByPrefix(PROFILE_KEY_PREFIX);
      if (!keysResult.success) {
        return { success: false, error: keysResult.error };
      }

      let corruptedProfiles = 0;
      
      // 各プロファイルを処理
      for (const key of keysResult.data) {
        try {
          const profileResult = await SafeStorage.get(key);
          if (!profileResult.success) {
            errorLogger.warn('Failed to load profile during list update', { key, error: profileResult.error });
            corruptedProfiles++;
            continue;
          }

          if (profileResult.data === null) {
            continue;
          }
          
          const profile = profileResult.data as unknown as Profile;
          
          // 基本的な検証
          if (!profile.id || !profile.name) {
            errorLogger.warn('Skipping corrupted profile in list update', { key, profile });
            corruptedProfiles++;
            continue;
          }
          
          profiles.push({
            id: createProfileId(profile.id),
            name: createProfileName(profile.name),
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

      const saveResult = await SafeStorage.set(PROFILES_LIST_KEY, JSON.parse(JSON.stringify(profiles)));
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }

      return { success: true, data: undefined };
    } catch (err) {
      const appError = convertToAppError(err, context) as StorageError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * デフォルトプロファイルの作成（内部メソッド）
   */
  private static async createDefaultProfile(): Promise<ProfileCreateResult> {
    const context = { method: 'SafeProfileManager.createDefaultProfile' };
    
    try {
      const defaultSettings = getDefaultSettings();
      const defaultProxySettings = getDefaultProxySettings();
      
      errorLogger.info('Creating default profile', context);
      
      const createRequest: CreateProfileRequest = {
        name: createProfileName('Default'),
        description: 'Default profile',
        icon: '⚙️',
        fixedOrganizations: [],
        agentApiProxy: defaultProxySettings,
        environmentVariables: defaultSettings.environmentVariables,
        isDefault: true,
      };

      return await this.createProfile(createRequest);
    } catch (err) {
      const appError = convertToAppError(err, context) as ProfileError | StorageError;
      errorLogger.logError(appError);
      return { success: false, error: appError };
    }
  }

  /**
   * プロファイルのマイグレーション（必要に応じて）
   */
  private static async migrateProfileIfNeeded(profile: Profile): Promise<Profile> {
    let migratedProfile = { ...profile };
    
    try {
      // repositoryHistoryのlastUsedを文字列からDateオブジェクトに変換
      if (migratedProfile.repositoryHistory) {
        const migratedHistory = migratedProfile.repositoryHistory.map(item => ({
          ...item,
          lastUsed: typeof item.lastUsed === 'string' 
            ? new Date(item.lastUsed) 
            : item.lastUsed
        }));
        
        migratedProfile = {
          ...migratedProfile,
          repositoryHistory: migratedHistory
        };
      }
      
      // 必要に応じてマイグレーション後のプロファイルを保存
      // 現在は自動的な変換のみなので保存は不要
      
      return migratedProfile;
    } catch (migrationError) {
      errorLogger.warn('Profile migration failed', { 
        profileId: profile.id, 
        error: migrationError 
      });
      // 移行失敗でも元のプロファイルを返す
      return profile;
    }
  }
}

// デフォルトエクスポート
export const safeProfileManager = SafeProfileManager;