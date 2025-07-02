import { SecureProfileManager } from './secureProfileManager';
import { SecureSettings } from './secureSettings';

/**
 * 既存データを暗号化ストレージへ移行
 */
export async function migrateToSecureStorage(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  console.log('Starting migration to secure storage...');

  try {
    // プロファイルのマイグレーション
    await SecureProfileManager.migrateExistingProfiles();
    
    // グローバル設定とリポジトリ設定のマイグレーション
    await SecureSettings.migrateExistingSettings();
    
    console.log('Migration to secure storage completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * アプリケーション起動時にマイグレーションをチェック
 */
export async function checkAndMigrate(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const MIGRATION_CHECK_KEY = 'agentapi-secure-migration-checked';
  
  // すでにチェック済みの場合はスキップ
  const checked = sessionStorage.getItem(MIGRATION_CHECK_KEY);
  if (checked === 'true') {
    return;
  }

  try {
    await migrateToSecureStorage();
    sessionStorage.setItem(MIGRATION_CHECK_KEY, 'true');
  } catch (error) {
    console.error('Migration check failed:', error);
  }
}