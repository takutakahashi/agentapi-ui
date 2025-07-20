'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    console.log('🔧 ServiceWorkerRegistration v3 - Qiita Article Approach');
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      
      const registerServiceWorker = async () => {
        try {
          console.log('🚀 Starting simplified Service Worker registration...');
          
          // Qiita記事に従い、既存のSWをクリアせずに新しいスコープを使用
          console.log('📦 Registering notification Service Worker with unique scope...');
          
          const registration = await navigator.serviceWorker.register('/notification-worker.js', {
            scope: '/notifications/',
            updateViaCache: 'none'
          });
          
          console.log('✅ Registration successful:', registration);
          
          // Service Workerの状態を監視
          const monitorRegistration = (reg: ServiceWorkerRegistration) => {
            console.log('👀 Monitoring registration:', {
              scope: reg.scope,
              installing: reg.installing?.state,
              waiting: reg.waiting?.state,
              active: reg.active?.state
            });
            
            // インストール中のワーカーを監視
            if (reg.installing) {
              reg.installing.addEventListener('statechange', () => {
                console.log('🔄 Installing worker state:', reg.installing?.state);
                if (reg.installing?.state === 'installed') {
                  console.log('✅ Service Worker installed successfully');
                }
              });
            }
            
            // アクティブなワーカーを監視
            if (reg.active) {
              console.log('✅ Service Worker is active:', reg.active.state);
            }
            
            // 待機中のワーカーを監視
            if (reg.waiting) {
              console.log('⏳ Service Worker is waiting:', reg.waiting.state);
            }
          };
          
          monitorRegistration(registration);
          
          // updatefoundイベント - 新しいバージョンが見つかった時
          registration.addEventListener('updatefound', () => {
            console.log('🔄 Service Worker update found');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                console.log('🔄 New worker state:', newWorker.state);
              });
            }
          });
          
          // 3秒後に状態確認
          setTimeout(async () => {
            console.log('🔍 Checking registration status after 3 seconds...');
            const allRegs = await navigator.serviceWorker.getRegistrations();
            
            console.log(`📊 Total registrations: ${allRegs.length}`);
            allRegs.forEach((reg, i) => {
              console.log(`📋 Registration ${i + 1}:`, {
                scope: reg.scope,
                scriptURL: reg.active?.scriptURL || reg.installing?.scriptURL || 'unknown',
                state: reg.active?.state || reg.installing?.state || 'unknown'
              });
            });
            
            // 通知専用ワーカーが正常に登録されているかチェック
            const notificationWorker = allRegs.find(reg => reg.scope.includes('/notifications/'));
            if (notificationWorker) {
              console.log('✅ Notification Service Worker found and registered');
              
              // 通知テストを実行
              if (Notification.permission === 'granted') {
                try {
                  await notificationWorker.showNotification('🔔 Service Worker テスト', {
                    body: '通知システムが正常に動作しています',
                    icon: '/icon-192x192.png',
                    tag: 'sw-test',
                    silent: true
                  });
                  console.log('✅ Test notification sent via Service Worker');
                } catch (error) {
                  console.warn('⚠️ Test notification failed:', error);
                }
              }
            } else {
              console.error('❌ Notification Service Worker not found in registrations');
            }
          }, 3000);
          
        } catch (error) {
          console.error('❌ Service Worker registration failed:', error);
          
          // フォールバック: 遅延再試行
          console.log('🔄 Retrying registration in 2 seconds...');
          setTimeout(() => {
            registerServiceWorker();
          }, 2000);
        }
      };
      
      // Qiita記事推奨: window.onload での登録
      if (document.readyState === 'complete') {
        // ページが既に読み込まれている場合はすぐに実行
        registerServiceWorker();
      } else {
        // ページの読み込み完了を待つ
        window.addEventListener('load', registerServiceWorker);
      }
    }
  }, []);
  
  return null;
}