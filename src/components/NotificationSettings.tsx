'use client';

import React, { useState, useEffect } from 'react';
import { pushNotificationManager } from '@/utils/pushNotification';
import NotificationDiagnostics from './NotificationDiagnostics';

interface NotificationSettingsProps {
  isExpanded: boolean;
  onToggle: () => void;
}

interface NotificationConfig {
  agentResponses: boolean;
  sessionEvents: boolean;
  systemNotifications: boolean;
  quiet: boolean;
  quietStart: string;
  quietEnd: string;
}

const defaultConfig: NotificationConfig = {
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
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    // 通知のサポート状態をチェック
    const checkSupport = () => {
      const supported = 'Notification' in window;
      console.log('Notification supported:', supported);
      setIsSupported(supported);
      
      if (supported) {
        const currentPermission = Notification.permission;
        console.log('Current notification permission:', currentPermission);
        setPermission(currentPermission);
      }
    };
    
    checkSupport();
    
    const savedConfig = localStorage.getItem('notification-settings');
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      setConfig(parsedConfig);
    }

    // Permissionの変更を監視（一部のブラウザでサポート）
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then((permissionStatus) => {
        permissionStatus.onchange = () => {
          checkSupport();
        };
      }).catch(console.error);
    }
  }, []);

  const saveConfig = (newConfig: NotificationConfig) => {
    setConfig(newConfig);
    localStorage.setItem('notification-settings', JSON.stringify(newConfig));
  };

  const initializeNotifications = async () => {
    if (permission === 'granted') return;
    
    setIsInitializing(true);
    try {
      console.log('Initializing push notifications...');
      
      // 現在の許可状態を確認
      let currentPermission = Notification.permission;
      console.log('Current permission:', currentPermission);
      
      // まだ許可を求めていない場合のみリクエスト
      if (currentPermission === 'default') {
        console.log('Requesting notification permission...');
        currentPermission = await Notification.requestPermission();
        console.log('Permission request result:', currentPermission);
      }
      
      setPermission(currentPermission);
      
      if (currentPermission === 'granted') {
        console.log('Notifications permission granted');
        
        // Service Worker の初期化は別途実行（失敗してもOK）
        try {
          await pushNotificationManager.initialize();
        } catch (swError) {
          console.log('Service Worker initialization failed, but basic notifications work:', swError);
        }
      } else {
        console.log('Notification permission denied or not available');
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleConfigChange = (key: keyof NotificationConfig, value: boolean | string) => {
    const newConfig = { ...config, [key]: value };
    saveConfig(newConfig);
  };

  const testNotification = async () => {
    console.log('Test notification clicked');
    if (permission === 'granted') {
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
      console.log('Notification permission not granted');
      // 許可を求める
      await initializeNotifications();
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
                {permission === 'granted' ? '通知設定を管理します' : '通知許可が必要です'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {permission !== 'granted' && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  initializeNotifications();
                }}
                disabled={isInitializing}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInitializing ? '設定中...' : '許可する'}
              </button>
            )}
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

            {permission !== 'granted' && permission !== 'denied' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  通知機能を使用するには、ブラウザの通知許可が必要です。「許可する」ボタンをクリックしてください。
                </p>
              </div>
            )}

            {/* モバイル専用の注意事項 */}
            {typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  📱 モバイルデバイスでの通知について
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                  {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                    <>
                      <li>iOSではPWAとしてホーム画面に追加する必要があります</li>
                      <li>Safari: 共有ボタン → ホーム画面に追加</li>
                      <li>iOS 16.4以降が必要です</li>
                    </>
                  )}
                  {/Android/i.test(navigator.userAgent) && (
                    <>
                      <li>Chrome: メニュー → ホーム画面に追加</li>
                      <li>アプリの通知設定も確認してください</li>
                    </>
                  )}
                  <li>バッテリー節約モードでは通知が制限されることがあります</li>
                </ul>
              </div>
            )}

            {/* デバッグ情報 */}
            <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs space-y-1">
              <p className="font-semibold">デバッグ情報:</p>
              <p>- デバイス: {typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? '📱 モバイル' : '💻 デスクトップ'}</p>
              <p>- サポート状態: {isSupported ? '✅ サポートされています' : '❌ サポートされていません'}</p>
              <p>- 許可状態: <span className={permission === 'granted' ? 'text-green-600' : permission === 'denied' ? 'text-red-600' : 'text-yellow-600'}>{permission}</span></p>
              <p>- Notification API: {typeof Notification !== 'undefined' ? '✅ 利用可能' : '❌ 利用不可'}</p>
              <p>- 現在のURL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
              <p>- HTTPS: {typeof window !== 'undefined' && window.location.protocol === 'https:' ? '✅ Yes' : '⚠️ No (localhost以外では必須)'}</p>
              <p>- Service Worker: {typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? '✅ 利用可能' : '❌ 利用不可'}</p>
              <p>- PWAモード: {typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches ? '✅ Yes' : '❌ No'}</p>
              <button
                onClick={() => {
                  console.log('=== 通知診断 ===');
                  console.log('1. Notification API:', typeof Notification !== 'undefined' ? '存在する' : '存在しない');
                  if (typeof Notification !== 'undefined') {
                    console.log('2. Notification.permission:', Notification.permission);
                    console.log('3. 通知を作成してみる...');
                    try {
                      const testNotif = new Notification('診断テスト', { body: 'これが表示されれば通知APIは動作しています' });
                      console.log('4. 通知作成成功:', testNotif);
                    } catch (e) {
                      console.error('4. 通知作成失敗:', e);
                    }
                  }
                  console.log('5. navigator.serviceWorker:', 'serviceWorker' in navigator);
                  console.log('6. 現在のプロトコル:', window.location.protocol);
                  console.log('7. ユーザーエージェント:', navigator.userAgent);
                }}
                className="mt-2 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
              >
                詳細診断を実行
              </button>
            </div>

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
                  disabled={permission !== 'granted'}
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
                  disabled={permission !== 'granted'}
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
                  disabled={permission !== 'granted'}
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
                    disabled={permission !== 'granted'}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                  />
                </div>

                {config.quiet && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={config.quietStart}
                      onChange={(e) => handleConfigChange('quietStart', e.target.value)}
                      disabled={permission !== 'granted'}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">から</span>
                    <input
                      type="time"
                      value={config.quietEnd}
                      onChange={(e) => handleConfigChange('quietEnd', e.target.value)}
                      disabled={permission !== 'granted'}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">まで</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                {permission === 'granted' && (
                  <div className="text-xs text-green-600 dark:text-green-400 mr-2 self-center">
                    ✓ 通知許可済み
                  </div>
                )}
                <button
                  onClick={testNotification}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  テスト通知
                </button>
                <button
                  onClick={async () => {
                    console.log('Simple notification test clicked');
                    console.log('Current permission:', Notification.permission);
                    
                    if (Notification.permission === 'granted') {
                      try {
                        console.log('Creating simple notification...');
                        const notification = new Notification('シンプルテスト', { 
                          body: '基本的な通知のテストです',
                          icon: '/icon-192x192.png',
                          requireInteraction: false,
                          tag: 'simple-test'
                        });
                        console.log('Simple notification created:', notification);
                        
                        notification.onclick = () => {
                          console.log('Notification clicked');
                          notification.close();
                        };
                      } catch (error) {
                        console.error('Failed to create simple notification:', error);
                        // フォールバック: Service Worker なしでも動作するように
                        alert('通知のテスト（アラート）');
                      }
                    } else {
                      console.log('Permission not granted, initializing...');
                      await initializeNotifications();
                    }
                  }}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  シンプルテスト
                </button>
                <button
                  onClick={async () => {
                    console.log('Force test clicked');
                    try {
                      await pushNotificationManager.forceNotificationTest();
                    } catch (error) {
                      console.error('Force test failed:', error);
                      alert('強制テストに失敗しました: ' + (error instanceof Error ? error.message : String(error)));
                    }
                  }}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  強制テスト
                </button>
              </div>
              
              {/* 高度な診断ツール */}
              <NotificationDiagnostics />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}