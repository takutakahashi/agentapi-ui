'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SecureProfileManager } from '../../utils/secureProfileManager';
import { MigrationHelper } from '../../utils/migrationHelper';
import PasswordModal from './PasswordModal';

interface SecurityContextType {
  isInitialized: boolean;
  needsMigration: boolean;
  isLoading: boolean;
  error: string | null;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function useSecurityContext() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within a SecurityProvider');
  }
  return context;
}

interface SecurityProviderProps {
  children: React.ReactNode;
}

export default function SecurityProvider({ children }: SecurityProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalMode, setPasswordModalMode] = useState<'setup' | 'login' | 'change'>('login');
  const [migrationInfo, setMigrationInfo] = useState<{ legacyProfileCount: number } | null>(null);

  useEffect(() => {
    checkInitializationStatus();
  }, []);

  const checkInitializationStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 移行が必要かチェック
      const migrationNeeded = await MigrationHelper.needsMigration();
      setNeedsMigration(migrationNeeded);

      if (migrationNeeded) {
        // 移行情報を取得
        const info = MigrationHelper.getMigrationInfo();
        setMigrationInfo(info);
        setPasswordModalMode('setup');
        setShowPasswordModal(true);
      } else {
        // すでに初期化済みかチェック
        try {
          await SecureProfileManager.getProfiles();
          setIsInitialized(true);
        } catch {
          // 初期化されていない場合はログインモーダルを表示
          setPasswordModalMode('login');
          setShowPasswordModal(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '初期化エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSuccess = async (password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (needsMigration) {
        // 移行処理を実行
        const migrationResult = await MigrationHelper.migrateProfiles(password);
        
        if (migrationResult.success) {
          // 移行成功後、Legacy データをクリア
          MigrationHelper.clearLegacyData();
          setNeedsMigration(false);
          console.log(`移行完了: ${migrationResult.migratedCount} プロファイルを移行しました`);
          
          if (migrationResult.errors.length > 0) {
            console.warn('移行中にエラーが発生しました:', migrationResult.errors);
          }
        } else {
          throw new Error(`移行に失敗しました: ${migrationResult.errors.join(', ')}`);
        }
      } else {
        // 既存システムの初期化
        await SecureProfileManager.initialize(password);
      }

      setIsInitialized(true);
      setShowPasswordModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワード認証に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setError('セキュリティシステムの初期化がキャンセルされました');
  };

  const logout = () => {
    SecureProfileManager.logout();
    setIsInitialized(false);
    setPasswordModalMode('login');
    setShowPasswordModal(true);
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!isInitialized) {
      throw new Error('システムが初期化されていません');
    }
    
    await SecureProfileManager.changePassword(oldPassword, newPassword);
  };

  const getPasswordModalTitle = () => {
    if (needsMigration) {
      return `プロファイル移行 (${migrationInfo?.legacyProfileCount || 0}件)`;
    }
    return undefined;
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {needsMigration ? 'プロファイルデータを移行中...' : 'セキュリティシステムを初期化中...'}
          </p>
        </div>
      </div>
    );
  }

  // エラー状態の表示
  if (error && !showPasswordModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            セキュリティエラー
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={checkInitializationStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  // 初期化されていない場合はパスワードモーダルのみ表示
  if (!isInitialized) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              セキュアプロファイル
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {needsMigration 
                ? 'プロファイルデータを暗号化システムに移行します'
                : 'マスターパスワードでプロファイルデータにアクセス'
              }
            </p>
          </div>
        </div>
        
        <PasswordModal
          isOpen={showPasswordModal}
          mode={passwordModalMode}
          title={getPasswordModalTitle()}
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
        />
      </>
    );
  }

  // 正常に初期化済みの場合
  const contextValue: SecurityContextType = {
    isInitialized,
    needsMigration,
    isLoading,
    error,
    logout,
    changePassword,
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
}