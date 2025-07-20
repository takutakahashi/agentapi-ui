'use client';

import React, { useState } from 'react';

export default function NotificationDiagnostics() {
  const [diagnosticResults, setDiagnosticResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: string[] = [];
    
    // 1. 基本的なAPIチェック
    results.push('=== 通知診断開始 ===');
    results.push(`時刻: ${new Date().toLocaleString()}`);
    results.push(`URL: ${window.location.href}`);
    results.push(`プロトコル: ${window.location.protocol}`);
    
    // 2. Notification API
    results.push('\n--- Notification API ---');
    results.push(`Notification API: ${typeof Notification !== 'undefined' ? '✅ 利用可能' : '❌ 利用不可'}`);
    if (typeof Notification !== 'undefined') {
      results.push(`現在の許可状態: ${Notification.permission}`);
    }
    
    // 3. ドキュメント状態
    results.push('\n--- ドキュメント状態 ---');
    results.push(`可視性: ${document.visibilityState}`);
    results.push(`フォーカス: ${document.hasFocus() ? 'あり' : 'なし'}`);
    results.push(`非表示: ${document.hidden ? 'はい' : 'いいえ'}`);
    
    // 4. Service Worker
    results.push('\n--- Service Worker ---');
    if ('serviceWorker' in navigator) {
      results.push('Service Worker API: ✅ 利用可能');
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        results.push(`登録済み: ${registrations.length > 0 ? '✅ 登録済み' : '❌ 未登録'}`);
        
        if (registrations.length > 0) {
          results.push(`\n📋 全ての登録 (${registrations.length}件):`);
          registrations.forEach((reg, index) => {
            const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || 'unknown';
            const fileName = scriptURL.split('/').pop() || 'unknown';
            
            // 各状態を詳細に表示
            const states = [];
            if (reg.active) states.push(`active: ${reg.active.state}`);
            if (reg.installing) states.push(`installing: ${reg.installing.state}`);
            if (reg.waiting) states.push(`waiting: ${reg.waiting.state}`);
            
            results.push(`  SW${index + 1}: ${fileName}`);
            results.push(`    スコープ: ${reg.scope}`);
            results.push(`    状態: ${states.length > 0 ? states.join(', ') : 'none'}`);
            results.push(`    URL: ${scriptURL}`);
          });
          
          // 通知専用Service Workerがあるかチェック
          const notificationWorker = registrations.find(reg => 
            reg.scope.includes('/notifications/') || 
            reg.active?.scriptURL.includes('notification-worker.js') ||
            reg.installing?.scriptURL.includes('notification-worker.js')
          );
          
          results.push('\n🔔 通知機能チェック:');
          if (notificationWorker) {
            const isActive = !!notificationWorker.active;
            const state = notificationWorker.active?.state || notificationWorker.installing?.state || 'unknown';
            results.push(`  通知専用SW: ✅ 検出 (${state})`);
            results.push(`  アクティブ: ${isActive ? '✅ はい' : '❌ いいえ'}`);
            
            if (isActive && Notification.permission === 'granted') {
              results.push(`  テスト実行: 準備完了`);
            } else {
              results.push(`  テスト実行: 条件不足 (権限: ${Notification.permission})`);
            }
          } else {
            results.push(`  通知専用SW: ❌ 未検出`);
            results.push(`  推奨対策: ページリロードで再登録`);
          }
        }
        
        const controller = navigator.serviceWorker.controller;
        results.push('\n👤 コントローラー情報:');
        if (controller) {
          results.push(`  現在のSW: ${controller.scriptURL.split('/').pop()}`);
          results.push(`  状態: ${controller.state}`);
          results.push(`  URL: ${controller.scriptURL}`);
        } else {
          results.push(`  現在のSW: なし (ページがSWに制御されていません)`);
        }
      } catch (e) {
        results.push(`Service Worker エラー: ${e}`);
      }
    } else {
      results.push('Service Worker API: ❌ 利用不可');
    }
    
    // 5. ローカルストレージの設定
    results.push('\n--- 保存された設定 ---');
    const savedSettings = localStorage.getItem('notification-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        results.push(`設定: ${JSON.stringify(settings, null, 2)}`);
      } catch {
        results.push('設定の解析エラー');
      }
    } else {
      results.push('設定なし');
    }
    
    // 6. 通知テスト
    results.push('\n--- 通知テスト ---');
    if (Notification.permission === 'granted') {
      // 方法1: 基本的な通知
      try {
        const notif1 = new Notification('テスト1: 基本通知', {
          body: '基本的な通知のテスト',
          tag: 'test-basic'
        });
        results.push('✅ 基本通知: 成功');
        setTimeout(() => notif1.close(), 3000);
      } catch (e) {
        results.push(`❌ 基本通知: 失敗 - ${e}`);
      }
      
      // 方法2: Service Worker経由
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const notificationWorker = registrations.find(reg => 
          reg.scope.includes('/notifications/') || 
          reg.active?.scriptURL.includes('notification-worker.js')
        );
        
        if (notificationWorker && notificationWorker.active) {
          await notificationWorker.showNotification('テスト2: SW通知', {
            body: 'Service Worker経由の通知',
            icon: '/icon-192x192.png',
            tag: 'test-sw',
            silent: true
          });
          results.push('✅ SW通知: 成功');
        } else {
          // フォールバック: 任意のアクティブなService Workerを使用
          const anyActiveWorker = registrations.find(reg => reg.active);
          if (anyActiveWorker && anyActiveWorker.active) {
            await anyActiveWorker.showNotification('テスト2: 汎用SW通知', {
              body: '汎用Service Worker経由の通知',
              icon: '/icon-192x192.png',
              tag: 'test-sw-fallback',
              silent: true
            });
            results.push('✅ SW通知: 成功 (汎用SW使用)');
          } else {
            results.push('❌ SW通知: Service Worker未登録/非アクティブ');
          }
        }
      } catch (e) {
        results.push(`❌ SW通知: 失敗 - ${e}`);
      }
      
      // 方法3: タイムアウト付き
      setTimeout(() => {
        try {
          new Notification('テスト3: 遅延通知', {
            body: '3秒後の通知',
            tag: 'test-delayed'
          });
          results.push('✅ 遅延通知: 成功');
        } catch (e) {
          results.push(`❌ 遅延通知: 失敗 - ${e}`);
        }
      }, 3000);
    } else {
      results.push('通知許可がないためテストをスキップ');
    }
    
    // 7. ブラウザ情報
    results.push('\n--- ブラウザ情報 ---');
    results.push(`User Agent: ${navigator.userAgent}`);
    results.push(`プラットフォーム: ${navigator.platform}`);
    results.push(`言語: ${navigator.language}`);
    results.push(`オンライン: ${navigator.onLine ? 'はい' : 'いいえ'}`);
    
    // 8. その他のチェック
    results.push('\n--- その他 ---');
    results.push(`PWAモード: ${window.matchMedia('(display-mode: standalone)').matches ? 'はい' : 'いいえ'}`);
    results.push(`セキュアコンテキスト: ${window.isSecureContext ? 'はい' : 'いいえ'}`);
    
    // Permissions API チェック
    if ('permissions' in navigator) {
      try {
        const status = await navigator.permissions.query({ name: 'notifications' as PermissionName });
        results.push(`Permissions API状態: ${status.state}`);
      } catch {
        results.push('Permissions APIエラー');
      }
    }
    
    setDiagnosticResults(results);
    setIsRunning(false);
    
    // 結果をコンソールにも出力
    console.log(results.join('\n'));
  };

  return (
    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h3 className="text-sm font-semibold mb-3">高度な診断ツール</h3>
      
      <button
        onClick={runDiagnostics}
        disabled={isRunning}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
      >
        {isRunning ? '診断中...' : '完全診断を実行'}
      </button>
      
      {diagnosticResults.length > 0 && (
        <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-700">
          <pre className="text-xs whitespace-pre-wrap font-mono overflow-x-auto">
            {diagnosticResults.join('\n')}
          </pre>
          <button
            onClick={() => {
              const text = diagnosticResults.join('\n');
              navigator.clipboard.writeText(text);
            }}
            className="mt-2 text-xs text-blue-600 hover:text-blue-700"
          >
            結果をコピー
          </button>
        </div>
      )}
    </div>
  );
}