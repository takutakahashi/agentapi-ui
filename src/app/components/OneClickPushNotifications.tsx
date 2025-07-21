'use client';

import React, { useState, useEffect } from 'react';
import { pushNotificationManager } from '../../utils/pushNotification';
import { pushNotificationSettings } from '../../lib/pushNotificationSettings';

interface NotificationState {
  isEnabled: boolean;
  isSupported: boolean;
  permission: NotificationPermission;
  isLoading: boolean;
  lastMessage: string;
  endpoint?: string;
}

export const OneClickPushNotifications: React.FC = () => {
  const [state, setState] = useState<NotificationState>({
    isEnabled: false,
    isSupported: false,
    permission: 'default',
    isLoading: false,
    lastMessage: ''
  });

  useEffect(() => {
    checkStatus();
    // 自動初期化を試行
    if (pushNotificationSettings.isEnabled()) {
      pushNotificationManager.autoInitialize();
    }
  }, []);

  const checkStatus = () => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    const permission = isSupported ? Notification.permission : 'denied';
    const settings = pushNotificationSettings.getSettings();
    const subscriptionStatus = pushNotificationManager.getSubscriptionStatus();
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission,
      isEnabled: settings.enabled,
      endpoint: settings.endpoint || subscriptionStatus.endpoint
    }));
  };

  const handleOneClickEnable = async () => {
    setState(prev => ({ ...prev, isLoading: true, lastMessage: '' }));

    try {
      const result = await pushNotificationManager.enableOneClick();
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastMessage: result.message,
        isEnabled: result.success
      }));
      
      if (result.success) {
        checkStatus(); // ステータスを更新
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastMessage: `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        isEnabled: false
      }));
    }
  };

  const handleOneClickDisable = async () => {
    setState(prev => ({ ...prev, isLoading: true, lastMessage: '' }));

    try {
      const result = await pushNotificationManager.disableOneClick();
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastMessage: result.message,
        isEnabled: !result.success ? prev.isEnabled : false
      }));
      
      if (result.success) {
        checkStatus(); // ステータスを更新
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastMessage: `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
      }));
    }
  };

  const handleTestNotification = async () => {
    setState(prev => ({ ...prev, isLoading: true, lastMessage: '' }));

    try {
      await pushNotificationManager.testNotification();
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastMessage: 'テスト通知を送信しました'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastMessage: `テスト通知エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
      }));
    }
  };

  const getStatusColor = () => {
    if (!state.isSupported) return 'text-red-600';
    if (state.permission === 'denied') return 'text-red-600';
    if (state.isEnabled) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getStatusText = () => {
    if (!state.isSupported) return '非対応';
    if (state.permission === 'denied') return '許可が拒否されています';
    if (state.isEnabled) return '有効';
    return '無効';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        プッシュ通知
      </h3>

      {/* 現在のステータス */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ステータス:
          </span>
          <span className={`text-sm font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {state.isSupported && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            許可状況: {state.permission === 'granted' ? '許可済み' : 
                      state.permission === 'denied' ? '拒否済み' : '未設定'}
          </div>
        )}
        
        {state.endpoint && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 break-all">
            エンドポイント: {state.endpoint.substring(0, 60)}...
          </div>
        )}
      </div>

      {/* メッセージ表示 */}
      {state.lastMessage && (
        <div className={`mb-4 p-3 rounded-md ${
          state.lastMessage.includes('エラー') || state.lastMessage.includes('失敗')
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
        }`}>
          <p className="text-sm">{state.lastMessage}</p>
        </div>
      )}

      {/* ワンクリックボタン */}
      <div className="space-y-3">
        {!state.isSupported ? (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200">
              お使いのブラウザはプッシュ通知をサポートしていません
            </p>
          </div>
        ) : (
          <>
            {!state.isEnabled ? (
              <button
                onClick={handleOneClickEnable}
                disabled={state.isLoading}
                className="w-full px-4 py-3 text-white font-medium bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {state.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    有効化中...
                  </>
                ) : (
                  '🔔 プッシュ通知を有効にする'
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleTestNotification}
                  disabled={state.isLoading}
                  className="w-full px-4 py-2 text-white font-medium bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {state.isLoading ? '送信中...' : '📬 テスト通知を送信'}
                </button>
                
                <button
                  onClick={handleOneClickDisable}
                  disabled={state.isLoading}
                  className="w-full px-4 py-2 text-white font-medium bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {state.isLoading ? '無効化中...' : '🔕 プッシュ通知を無効にする'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 設定情報 */}
      {state.isEnabled && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 プッシュ通知が有効です。AgentAPIからの応答や重要な更新をリアルタイムで受け取れます。
          </p>
        </div>
      )}

      {/* ヘルプ情報 */}
      <details className="mt-4">
        <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
          設定について
        </summary>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>• 設定はブラウザに永続的に保存されます</p>
          <p>• 通知許可は一度拒否すると、ブラウザ設定から手動で有効にする必要があります</p>
          <p>• プライベートブラウジングモードでは設定が保存されません</p>
        </div>
      </details>
    </div>
  );
};