'use client';

import React, { useState, useEffect } from 'react';
import { pushNotificationManager } from '@/utils/pushNotification';

interface NotificationSettingsProps {
  isExpanded: boolean;
  onToggle: () => void;
}

interface NotificationConfig {
  enabled: boolean;
  agentResponses: boolean;
  sessionEvents: boolean;
  systemNotifications: boolean;
  quiet: boolean;
  quietStart: string;
  quietEnd: string;
}

const defaultConfig: NotificationConfig = {
  enabled: false,
  agentResponses: true,
  sessionEvents: true,
  systemNotifications: true,
  quiet: false,
  quietStart: '22:00',
  quietEnd: '08:00',
};

export default function NotificationSettings({ isExpanded, onToggle }: NotificationSettingsProps) {
  const [config, setConfig] = useState<NotificationConfig>(defaultConfig);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsSupported(pushNotificationManager.isSupported());
    const currentPermission = pushNotificationManager.getPermissionStatus();
    setPermission(currentPermission);
    
    const savedConfig = localStorage.getItem('notification-settings');
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      // 通知許可が取り消された場合は、設定も無効化
      if (parsedConfig.enabled && currentPermission !== 'granted') {
        parsedConfig.enabled = false;
        localStorage.setItem('notification-settings', JSON.stringify(parsedConfig));
      }
      setConfig(parsedConfig);
    }
  }, []);

  const saveConfig = (newConfig: NotificationConfig) => {
    setConfig(newConfig);
    localStorage.setItem('notification-settings', JSON.stringify(newConfig));
  };

  const handleToggleEnabled = async () => {
    console.log('Toggle clicked, current enabled:', config.enabled);
    console.log('Is supported:', isSupported);
    console.log('Current permission:', permission);
    
    if (!config.enabled) {
      setIsLoading(true);
      try {
        console.log('Attempting to initialize notifications...');
        
        // 現在の許可状態を確認
        let currentPermission = Notification.permission;
        console.log('Current permission:', currentPermission);
        
        // まだ許可を求めていない場合のみリクエスト
        if (currentPermission === 'default') {
          console.log('Requesting notification permission...');
          currentPermission = await Notification.requestPermission();
          console.log('Permission request result:', currentPermission);
        }
        
        if (currentPermission === 'granted') {
          // 通知許可が得られた場合、設定を有効化
          const newConfig = { ...config, enabled: true };
          saveConfig(newConfig);
          setPermission('granted');
          console.log('Notifications enabled successfully');
          
          // Service Worker の初期化は別途実行（失敗してもOK）
          try {
            await pushNotificationManager.initialize();
          } catch (swError) {
            console.log('Service Worker initialization failed, but basic notifications work:', swError);
          }
        } else {
          console.log('Notification permission denied or not available');
          setPermission(currentPermission);
          // 許可されなかった場合は無効のまま
        }
      } catch (error) {
        console.error('Failed to enable notifications:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      console.log('Disabling notifications...');
      try {
        await pushNotificationManager.unsubscribe();
      } catch (error) {
        console.log('Unsubscribe failed (ok for fallback mode):', error);
      }
      saveConfig({ ...config, enabled: false });
      console.log('Notifications disabled');
    }
  };

  const handleConfigChange = (key: keyof NotificationConfig, value: boolean | string) => {
    const newConfig = { ...config, [key]: value };
    saveConfig(newConfig);
  };

  const testNotification = async () => {
    console.log('Test notification clicked, config.enabled:', config.enabled);
    if (config.enabled) {
      try {
        console.log('Sending test notification...');
        await pushNotificationManager.sendLocalNotification(
          'テスト通知',
          'AgentAPIからのテスト通知です'
        );
        console.log('Test notification sent successfully');
      } catch (error) {
        console.error('Failed to send test notification:', error);
      }
    } else {
      console.log('Notifications not enabled, cannot send test notification');
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              このブラウザではプッシュ通知がサポートされていません。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center">
            <svg className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 21h5l-5-5v5zM12 3v18m0-18l-4 4m4-4l4 4" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                プッシュ通知
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                エージェントからの通知を受信します
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation(); // 親ボタンのクリックを防ぐ
                console.log('Toggle button clicked');
                handleToggleEnabled();
              }}
              onTouchStart={(e) => {
                e.stopPropagation(); // モバイルでのタッチ処理
              }}
              disabled={isLoading}
              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80 active:opacity-90'} ${config.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              style={{
                backgroundColor: config.enabled ? '#2563eb' : '#d1d5db',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <span className="sr-only">
                {config.enabled ? 'Disable notifications' : 'Enable notifications'}
              </span>
              <span
                className={`inline-block w-4 h-4 transform bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
            <svg
              className={`h-5 w-5 text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {permission === 'denied' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200">
                  通知が拒否されています。ブラウザの設定から通知を許可してください。
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    エージェントの応答通知
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    エージェントが応答を完了した時に通知
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.agentResponses}
                  onChange={(e) => handleConfigChange('agentResponses', e.target.checked)}
                  disabled={!config.enabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    セッションイベント通知
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    新しいセッションやエラーの発生時に通知
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.sessionEvents}
                  onChange={(e) => handleConfigChange('sessionEvents', e.target.checked)}
                  disabled={!config.enabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    システム通知
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    システムの更新や重要なお知らせ
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.systemNotifications}
                  onChange={(e) => handleConfigChange('systemNotifications', e.target.checked)}
                  disabled={!config.enabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      マナーモード
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      指定時間帯の通知を無効化
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.quiet}
                    onChange={(e) => handleConfigChange('quiet', e.target.checked)}
                    disabled={!config.enabled}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                  />
                </div>

                {config.quiet && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={config.quietStart}
                      onChange={(e) => handleConfigChange('quietStart', e.target.value)}
                      disabled={!config.enabled}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">から</span>
                    <input
                      type="time"
                      value={config.quietEnd}
                      onChange={(e) => handleConfigChange('quietEnd', e.target.value)}
                      disabled={!config.enabled}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">まで</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={testNotification}
                  disabled={!config.enabled}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  テスト通知
                </button>
                <button
                  onClick={async () => {
                    console.log('Simple notification test');
                    if (Notification.permission === 'granted') {
                      new Notification('シンプルテスト', { 
                        body: '基本的な通知のテストです',
                        icon: '/icon-192x192.png'
                      });
                    }
                  }}
                  disabled={!config.enabled}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  シンプルテスト
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}