'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '../../types/profile';
import { githubAuthService } from '../../services/githubAuthService';

interface GitHubAuthSettingsProps {
  profile: Profile;
  onProfileUpdated?: () => void;
}

export const GitHubAuthSettings: React.FC<GitHubAuthSettingsProps> = ({ profile, onProfileUpdated }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ type: 'github' | 'none'; authenticated: boolean; user?: any }>({ type: 'none', authenticated: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, [profile.id]);

  const checkAuthStatus = async () => {
    setLoading(true);
    try {
      const status = await githubAuthService.checkAuthStatus(profile.id);
      setAuthStatus(status);
    } catch (error) {
      console.error('Failed to check auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await githubAuthService.startGitHubAuth(profile.id);
      
      // Wait for authentication to complete
      const authenticated = await githubAuthService.waitForAuth(profile.id);
      
      if (authenticated) {
        await checkAuthStatus();
        onProfileUpdated?.();
        alert('GitHub連携が完了しました');
      } else {
        alert('GitHub連携がタイムアウトしました');
      }
    } catch (error) {
      console.error('GitHub連携に失敗しました:', error);
      alert('GitHub連携に失敗しました');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('GitHub連携を解除しますか？')) {
      try {
        await githubAuthService.disconnect(profile.id);
        setAuthStatus({ type: 'none', authenticated: false });
        onProfileUpdated?.();
        alert('GitHub連携を解除しました');
      } catch (error) {
        console.error('Failed to disconnect:', error);
        alert('連携解除に失敗しました');
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">GitHub連携設定</h3>
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">GitHub連携設定</h3>
      
      {authStatus.type === 'none' ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            このプロファイルでは認証が設定されていません
          </p>
        </div>
      ) : authStatus.type === 'github' && (
        <>
          {authStatus.authenticated && authStatus.user ? (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                {authStatus.user.avatarUrl && (
                  <img 
                    src={authStatus.user.avatarUrl} 
                    alt={authStatus.user.login}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {authStatus.user.name || authStatus.user.login}
                  </p>
                  {authStatus.user.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{authStatus.user.email}</p>
                  )}
                </div>
                <button
                  onClick={handleDisconnect}
                  className="bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-200 px-3 py-2 rounded text-sm transition-colors"
                >
                  連携解除
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                GitHub認証が必要です
              </p>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span>{isConnecting ? '接続中...' : 'GitHubで認証'}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};