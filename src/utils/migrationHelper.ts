import { ProfileManager } from './profileManager';
import { SecureProfileManager } from './secureProfileManager';
import { Profile, ProfileListItem } from '../types/profile';

/**
 * LocalStorage から IndexedDB への移行ヘルパー
 */
export class MigrationHelper {
  
  /**
   * 既存のプロファイルデータがあるかチェック
   */
  static hasLegacyProfiles(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const profilesList = localStorage.getItem('agentapi-profiles-list');
      return profilesList !== null && JSON.parse(profilesList).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 移行が必要かチェック
   */
  static async needsMigration(): Promise<boolean> {
    try {
      // 既存のLocalStorageプロファイルがあるかチェック
      const hasLegacy = this.hasLegacyProfiles();
      
      if (!hasLegacy) {
        return false;
      }

      // SecureProfileManagerがまだ初期化されていない場合は移行が必要
      try {
        await SecureProfileManager.getProfiles();
        return false; // すでに新システムが動作している
      } catch {
        return true; // 新システムがまだ初期化されていない
      }
    } catch {
      return false;
    }
  }

  /**
   * LocalStorageから全プロファイルを取得
   */
  static getLegacyProfiles(): { profiles: Profile[]; profilesList: ProfileListItem[] } {
    try {
      const profilesList = ProfileManager.getProfiles();
      const profiles: Profile[] = [];

      for (const profileItem of profilesList) {
        const profile = ProfileManager.getProfile(profileItem.id);
        if (profile) {
          profiles.push(profile);
        }
      }

      return { profiles, profilesList };
    } catch (error) {
      console.error('Legacy profiles の取得に失敗:', error);
      return { profiles: [], profilesList: [] };
    }
  }

  /**
   * プロファイルをSecureProfileManagerに移行
   */
  static async migrateProfiles(password: string): Promise<{
    success: boolean;
    migratedCount: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      migratedCount: 0,
      errors: [] as string[]
    };

    try {
      // SecureProfileManagerを初期化
      await SecureProfileManager.initialize(password);

      // 既存プロファイルを取得
      const { profiles } = this.getLegacyProfiles();
      
      if (profiles.length === 0) {
        result.success = true;
        return result;
      }

      // 各プロファイルを移行
      for (const profile of profiles) {
        try {
          // 新しいプロファイルとして作成（IDは新規生成される）
          const createRequest = {
            name: profile.name,
            description: profile.description,
            icon: profile.icon,
            mainColor: profile.mainColor,
            systemPrompt: profile.systemPrompt,
            fixedOrganizations: profile.fixedOrganizations || [],
            agentApiProxy: profile.agentApiProxy,
            environmentVariables: profile.environmentVariables || [],
            isDefault: profile.isDefault
          };

          const newProfile = await SecureProfileManager.createProfile(createRequest);
          
          // 追加情報を更新
          if (profile.messageTemplates || profile.repositoryHistory.length > 0) {
            await SecureProfileManager.updateProfile(newProfile.id, {
              messageTemplates: profile.messageTemplates || [],
            });

            // リポジトリ履歴を個別に追加
            for (const historyItem of profile.repositoryHistory) {
              await SecureProfileManager.addRepositoryToProfile(
                newProfile.id,
                historyItem.repository
              );
            }
          }

          result.migratedCount++;
        } catch (error) {
          const errorMessage = `プロファイル "${profile.name}" の移行に失敗: ${error instanceof Error ? error.message : '不明なエラー'}`;
          result.errors.push(errorMessage);
          console.error(errorMessage, error);
        }
      }

      result.success = result.migratedCount > 0 || profiles.length === 0;
      
    } catch (error) {
      const errorMessage = `移行処理に失敗: ${error instanceof Error ? error.message : '不明なエラー'}`;
      result.errors.push(errorMessage);
      console.error(errorMessage, error);
    }

    return result;
  }

  /**
   * 移行後にLocalStorageをクリア
   */
  static clearLegacyData(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // プロファイル関連のキーを削除
      const keysToRemove: string[] = [];
      
      // プロファイル一覧
      keysToRemove.push('agentapi-profiles-list');
      
      // デフォルトプロファイルID
      keysToRemove.push('agentapi-default-profile-id');
      
      // 個別プロファイル
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('agentapi-profile-')) {
          keysToRemove.push(key);
        }
      });

      // 削除実行
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log(`Legacy data cleared: ${keysToRemove.length} items removed`);
    } catch (error) {
      console.error('Legacy dataのクリアに失敗:', error);
    }
  }

  /**
   * 移行状況の詳細を取得
   */
  static getMigrationInfo(): {
    hasLegacyData: boolean;
    legacyProfileCount: number;
    legacyProfiles: ProfileListItem[];
  } {
    const hasLegacyData = this.hasLegacyProfiles();
    
    if (!hasLegacyData) {
      return {
        hasLegacyData: false,
        legacyProfileCount: 0,
        legacyProfiles: []
      };
    }

    const { profilesList } = this.getLegacyProfiles();
    
    return {
      hasLegacyData: true,
      legacyProfileCount: profilesList.length,
      legacyProfiles: profilesList
    };
  }

  /**
   * バックアップとしてLegacyデータをエクスポート
   */
  static exportLegacyDataAsBackup(): string | null {
    try {
      const { profiles } = this.getLegacyProfiles();
      
      if (profiles.length === 0) {
        return null;
      }

      const backup = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        profiles: profiles.map(profile => ({
          ...profile,
          // APIキーなどの機密情報を除外
          agentApiProxy: {
            ...profile.agentApiProxy,
            token: undefined,
            apiKey: profile.agentApiProxy.apiKey ? '[REDACTED]' : undefined
          }
        }))
      };

      return JSON.stringify(backup, null, 2);
    } catch (error) {
      console.error('Legacy data のエクスポートに失敗:', error);
      return null;
    }
  }

  /**
   * 移行のドライラン（実際の移行は行わない）
   */
  static simulateMigration(): {
    profileCount: number;
    profiles: Array<{
      name: string;
      description?: string;
      repositoryCount: number;
      hasCustomSettings: boolean;
    }>;
    estimatedSize: number;
  } {
    try {
      const { profiles } = this.getLegacyProfiles();
      
      const profileSummaries = profiles.map(profile => ({
        name: profile.name,
        description: profile.description,
        repositoryCount: profile.repositoryHistory.length,
        hasCustomSettings: Boolean(
          profile.systemPrompt ||
          profile.environmentVariables.length > 0 ||
          profile.messageTemplates.length > 0 ||
          profile.fixedOrganizations.length > 0
        )
      }));

      // 推定サイズ計算（JSON文字列のバイト数）
      const estimatedSize = JSON.stringify(profiles).length;

      return {
        profileCount: profiles.length,
        profiles: profileSummaries,
        estimatedSize
      };
    } catch (error) {
      console.error('Migration simulation failed:', error);
      return {
        profileCount: 0,
        profiles: [],
        estimatedSize: 0
      };
    }
  }
}