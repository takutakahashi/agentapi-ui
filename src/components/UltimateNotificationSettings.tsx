'use client';

import React, { useState, useEffect } from 'react';
import { ultimateNotificationManager, UltimateNotificationStatus, NotificationConfig } from '@/utils/ultimateNotificationManager';

interface UltimateNotificationSettingsProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export default function UltimateNotificationSettings({ isExpanded, onToggle }: UltimateNotificationSettingsProps) {
  const [status, setStatus] = useState<UltimateNotificationStatus | null>(null);
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    loadStatus();
    loadConfig();
  }, []);

  const loadStatus = async () => {
    try {
      const currentStatus = await ultimateNotificationManager.getStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const loadConfig = () => {
    const currentConfig = ultimateNotificationManager.getConfig();
    setConfig(currentConfig);
  };

  const handleInitialize = async () => {
    setIsLoading(true);
    setTestResults(['🚀 通知システムを初期化中...']);
    
    try {
      const success = await ultimateNotificationManager.initialize();
      
      if (success) {
        setTestResults(prev => [...prev, '✅ 初期化完了']);
        await loadStatus();
      } else {
        setTestResults(prev => [...prev, '❌ 初期化失敗']);
      }
    } catch (error) {
      setTestResults(prev => [...prev, `❌ エラー: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    setTestResults(['🧪 通知テストを実行中...']);
    
    try {
      const result = await ultimateNotificationManager.sendNotification(
        'Ultimate Test Notification',
        {
          body: `テスト時刻: ${new Date().toLocaleTimeString('ja-JP')}`,
          icon: '/icon-192x192.png',
          tag: 'ultimate-test'
        }
      );
      
      if (result.success) {
        setTestResults(prev => [...prev, `✅ テスト成功 (${result.method}, ${result.duration}ms)`]);
      } else {
        setTestResults(prev => [...prev, `❌ テスト失敗: ${result.error}`]);
      }
    } catch (error) {
      setTestResults(prev => [...prev, `❌ テストエラー: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUltimateTest = async () => {
    setIsLoading(true);
    setTestResults(['🎯 Ultimate Test を実行中...']);
    
    try {
      await ultimateNotificationManager.runUltimateTest();
      const newStatus = await ultimateNotificationManager.getStatus();
      setStatus(newStatus);
      
      setTestResults(prev => [
        ...prev,
        '📊 完全診断完了',
        ...newStatus.recommendations.map(rec => `💡 ${rec}`)
      ]);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Ultimate Test エラー: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (key: keyof NotificationConfig, value: boolean | string) => {
    if (!config) return;
    
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    ultimateNotificationManager.updateConfig({ [key]: value });
  };

  const getStatusColor = (permission: NotificationPermission) => {
    switch (permission) {
      case 'granted': return 'text-green-600 dark:text-green-400';
      case 'denied': return 'text-red-600 dark:text-red-400';
      default: return 'text-yellow-600 dark:text-yellow-400';
    }
  };

  const getStatusIcon = (permission: NotificationPermission) => {
    switch (permission) {
      case 'granted': return '✅';
      case 'denied': return '❌';
      default: return '⚠️';
    }
  };

  if (!status || !config) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
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
                Ultimate Push通知システム
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {getStatusIcon(status.permission)} {status.permission} - {status.isReady ? '準備完了' : '初期化が必要'}
              </p>
            </div>
          </div>
          <svg
            className={`h-5 w-5 text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* システム状態 */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <h4 className="text-sm font-semibold mb-2">システム状態</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>API サポート: {status.isSupported ? '✅' : '❌'}</div>
                <div>権限状態: <span className={getStatusColor(status.permission)}>{status.permission}</span></div>
                <div>初期化状態: {status.isReady ? '✅' : '❌'}</div>
                <div>ブラウザ: {status.diagnostics.browser.name} {status.diagnostics.browser.version}</div>
                <div>OS: {status.diagnostics.browser.ios ? 'iOS' : status.diagnostics.browser.android ? 'Android' : 'Desktop'}</div>
                <div>PWA: {status.diagnostics.pwa.isStandalone ? '✅' : '❌'}</div>
                <div>SW登録数: {status.serviceWorkerStatus.registrations.length}</div>
                <div>フォーカス: {status.diagnostics.document.hasFocus ? '✅' : '❌'}</div>
              </div>
            </div>

            {/* 推奨事項 */}
            {status.recommendations.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">推奨事項</h4>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                  {status.recommendations.slice(0, 3).map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                  {status.recommendations.length > 3 && (
                    <li className="text-yellow-600 dark:text-yellow-400">
                      ... および {status.recommendations.length - 3} 件の追加推奨事項
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* 操作ボタン */}
            <div className="flex flex-wrap gap-2">
              {!status.isReady && (
                <button
                  onClick={handleInitialize}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? '初期化中...' : '初期化'}
                </button>
              )}
              
              <button
                onClick={handleTestNotification}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'テスト中...' : 'テスト通知'}
              </button>
              
              <button
                onClick={handleUltimateTest}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {isLoading ? '診断中...' : 'Ultimate Test'}
              </button>
              
              <button
                onClick={loadStatus}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                状態更新
              </button>
            </div>

            {/* 通知設定 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">通知設定</h4>
              
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                {config.quiet && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={config.quietStart}
                      onChange={(e) => handleConfigChange('quietStart', e.target.value)}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">から</span>
                    <input
                      type="time"
                      value={config.quietEnd}
                      onChange={(e) => handleConfigChange('quietEnd', e.target.value)}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">まで</span>
                  </div>
                )}
              </div>
            </div>

            {/* テスト結果 */}
            {testResults.length > 0 && (
              <div className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono max-h-32 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index}>{result}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}