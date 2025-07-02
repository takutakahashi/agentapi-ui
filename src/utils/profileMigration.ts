/**
 * プロファイルの暗号化移行処理
 * 既存のプレーンテキストプロファイルを暗号化形式に移行
 */

import { ProfileManager } from './profileManager';
import { CryptoStorage } from './cryptoStorage';
import { MasterPasswordManager } from './masterPasswordManager';

export interface MigrationStatus {
  totalProfiles: number;
  encryptedProfiles: number;
  plainTextProfiles: number;
  needsMigration: boolean;
}

export class ProfileMigration {
  /**
   * 移行が必要かどうかをチェック
   */
  static async checkMigrationNeeded(): Promise<MigrationStatus> {
    const profiles = ProfileManager.getProfiles();
    let encryptedCount = 0;
    let plainTextCount = 0;

    for (const profileItem of profiles) {
      try {
        const storedData = localStorage.getItem(`agentapi-profile-${profileItem.id}`);
        if (storedData) {
          if (CryptoStorage.isEncryptedData(storedData)) {
            encryptedCount++;
          } else {
            plainTextCount++;
          }
        }
      } catch (error) {
        console.error(`Failed to check profile ${profileItem.id}:`, error);
        plainTextCount++; // エラーの場合は未暗号化とみなす
      }
    }

    return {
      totalProfiles: profiles.length,
      encryptedProfiles: encryptedCount,
      plainTextProfiles: plainTextCount,
      needsMigration: plainTextCount > 0 && await CryptoStorage.isEncryptionEnabled(),
    };
  }

  /**
   * すべてのプロファイルを暗号化に移行
   */
  static async migrateAllProfiles(): Promise<{
    success: boolean;
    migratedCount: number;
    errors: string[];
  }> {
    const profiles = ProfileManager.getProfiles();
    const errors: string[] = [];
    let migratedCount = 0;

    if (!await CryptoStorage.isEncryptionEnabled()) {
      throw new Error('Encryption is not enabled');
    }

    if (!MasterPasswordManager.isUnlocked()) {
      throw new Error('Master password is required for migration');
    }

    for (const profileItem of profiles) {
      try {
        const storedData = localStorage.getItem(`agentapi-profile-${profileItem.id}`);
        
        if (storedData && !CryptoStorage.isEncryptedData(storedData)) {
          // プレーンテキストのプロファイルを読み込み
          const profile = await ProfileManager.getProfile(profileItem.id);
          
          if (profile) {
            // 暗号化して再保存（ProfileManager.saveProfileが自動的に暗号化する）
            await ProfileManager.updateProfile(profile.id, {
              updated_at: new Date().toISOString(),
            });
            migratedCount++;
          }
        }
      } catch (error) {
        const errorMessage = `Profile ${profileItem.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        console.error('Migration error:', errorMessage);
      }
    }

    return {
      success: errors.length === 0,
      migratedCount,
      errors,
    };
  }

  /**
   * 単一プロファイルを暗号化に移行
   */
  static async migrateProfile(profileId: string): Promise<boolean> {
    try {
      if (!await CryptoStorage.isEncryptionEnabled()) {
        throw new Error('Encryption is not enabled');
      }

      if (!MasterPasswordManager.isUnlocked()) {
        throw new Error('Master password is required for migration');
      }

      const storedData = localStorage.getItem(`agentapi-profile-${profileId}`);
      if (!storedData) {
        throw new Error('Profile not found');
      }

      if (CryptoStorage.isEncryptedData(storedData)) {
        // 既に暗号化済み
        return true;
      }

      // プロファイルを読み込み、暗号化して再保存
      const profile = await ProfileManager.getProfile(profileId);
      if (!profile) {
        throw new Error('Failed to load profile');
      }

      await ProfileManager.updateProfile(profileId, {
        updated_at: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error(`Failed to migrate profile ${profileId}:`, error);
      return false;
    }
  }

  /**
   * 暗号化を無効にしてプレーンテキストに戻す
   */
  static async migrateToPlainText(): Promise<{
    success: boolean;
    migratedCount: number;
    errors: string[];
  }> {
    const profiles = ProfileManager.getProfiles();
    const errors: string[] = [];
    let migratedCount = 0;

    if (!MasterPasswordManager.isUnlocked()) {
      throw new Error('Master password is required to decrypt profiles');
    }

    for (const profileItem of profiles) {
      try {
        const storedData = localStorage.getItem(`agentapi-profile-${profileItem.id}`);
        
        if (storedData && CryptoStorage.isEncryptedData(storedData)) {
          // 暗号化されたプロファイルを復号化
          const profile = await ProfileManager.getProfile(profileItem.id);
          
          if (profile) {
            // 暗号化を一時的に無効にして保存
            await CryptoStorage.disableEncryption();
            
            // プレーンテキストで再保存
            const key = `agentapi-profile-${profile.id}`;
            const profileToSave = {
              ...profile,
              repositoryHistory: profile.repositoryHistory.map(item => ({
                ...item,
                lastUsed: item.lastUsed instanceof Date ? item.lastUsed.toISOString() : item.lastUsed
              }))
            };
            
            localStorage.setItem(key, JSON.stringify(profileToSave));
            migratedCount++;
          }
        }
      } catch (error) {
        const errorMessage = `Profile ${profileItem.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        console.error('Plain text migration error:', errorMessage);
        
        // エラーが発生した場合でも暗号化状態は維持
        await CryptoStorage.enableEncryption();
      }
    }

    return {
      success: errors.length === 0,
      migratedCount,
      errors,
    };
  }

  /**
   * 安全でないプロファイルの警告情報を取得
   */
  static async getSecurityWarnings(): Promise<{
    hasPlainTextProfiles: boolean;
    plainTextProfileIds: string[];
    encryptionAvailable: boolean;
    masterPasswordSet: boolean;
  }> {
    const status = await this.checkMigrationNeeded();
    const plainTextProfileIds: string[] = [];

    if (status.plainTextProfiles > 0) {
      const profiles = ProfileManager.getProfiles();
      
      for (const profileItem of profiles) {
        try {
          const storedData = localStorage.getItem(`agentapi-profile-${profileItem.id}`);
          if (storedData && !CryptoStorage.isEncryptedData(storedData)) {
            plainTextProfileIds.push(profileItem.id);
          }
        } catch (error) {
          plainTextProfileIds.push(profileItem.id);
        }
      }
    }

    return {
      hasPlainTextProfiles: status.plainTextProfiles > 0,
      plainTextProfileIds,
      encryptionAvailable: typeof window !== 'undefined' && 'crypto' in window && 'subtle' in window.crypto,
      masterPasswordSet: await MasterPasswordManager.isMasterPasswordSet(),
    };
  }

  /**
   * 移行進捗の監視用イベントエミッター
   */
  static createMigrationProgress(): {
    start: (totalCount: number) => void;
    update: (currentCount: number, profileId: string) => void;
    complete: (result: { success: boolean; migratedCount: number; errors: string[] }) => void;
    onProgress: (callback: (progress: { current: number; total: number; profileId: string }) => void) => void;
    onComplete: (callback: (result: { success: boolean; migratedCount: number; errors: string[] }) => void) => void;
  } {
    let progressCallback: ((progress: { current: number; total: number; profileId: string }) => void) | null = null;
    let completeCallback: ((result: { success: boolean; migratedCount: number; errors: string[] }) => void) | null = null;

    return {
      start: (totalCount: number) => {
        // 開始時の処理
      },
      update: (currentCount: number, profileId: string) => {
        if (progressCallback) {
          progressCallback({ current: currentCount, total: 0, profileId });
        }
      },
      complete: (result) => {
        if (completeCallback) {
          completeCallback(result);
        }
      },
      onProgress: (callback) => {
        progressCallback = callback;
      },
      onComplete: (callback) => {
        completeCallback = callback;
      },
    };
  }
}