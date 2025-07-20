'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    console.log('🔧 ServiceWorkerRegistration v2 - Redundant Fix');
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      
      const registerWithRetry = async () => {
        console.log('🚀 Starting Service Worker registration with redundant fix...');
        
        try {
          // 1. 既存の全登録をクリア（競合回避）
          const existing = await navigator.serviceWorker.getRegistrations();
          console.log(`🗑️ Clearing ${existing.length} existing registrations`);
          
          for (const reg of existing) {
            console.log(`🗑️ Unregistering: ${reg.scope}`);
            await reg.unregister();
          }
          
          // 2. 短い待機でブラウザ内部状態をクリア
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 3. 新しい登録を実行（通知専用Workerを使用）
          console.log('📦 Registering notification-specific Service Worker...');
          const registration = await navigator.serviceWorker.register('/notification-worker.js', {
            scope: '/notifications/',
            updateViaCache: 'none'
          });
          
          console.log('✅ Registration created:', registration);
          
          // 4. すぐにredundantになるのを防ぐため、skipWaitingを明示的に呼ぶ
          if (registration.installing) {
            console.log('📨 Sending skipWaiting to installing worker');
            registration.installing.postMessage({ type: 'SKIP_WAITING' });
          }
          
          // 5. 状態変化を詳細に監視
          const monitorWorker = (worker: ServiceWorker, label: string) => {
            if (!worker) return;
            
            console.log(`👀 Monitoring ${label} worker:`, worker.state);
            
            worker.addEventListener('statechange', () => {
              console.log(`🔄 ${label} worker state: ${worker.state}`);
              
              if (worker.state === 'activated') {
                console.log(`🎉 ${label} worker activated successfully!`);
              } else if (worker.state === 'redundant') {
                console.error(`❌ ${label} worker became redundant - investigating...`);
                console.error('💡 Possible causes: Another SW with same scope, update conflict, or registration error');
              }
            });
          };
          
          monitorWorker(registration.installing!, 'Installing');
          monitorWorker(registration.waiting!, 'Waiting');
          monitorWorker(registration.active!, 'Active');
          
          // 6. controllerchangeイベントをリッスン
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Service Worker controller changed');
          });
          
          // 7. updatefoundイベントをリッスン  
          registration.addEventListener('updatefound', () => {
            console.log('🔄 Service Worker update found');
          });
          
          // 8. 10秒後に状態確認
          setTimeout(async () => {
            const allRegs = await navigator.serviceWorker.getRegistrations();
            console.log(`🔍 Final check: Found ${allRegs.length} registrations after 10 seconds`);
            
            allRegs.forEach((reg, i) => {
              console.log(`📋 Registration ${i}:`, {
                scope: reg.scope,
                active: reg.active?.state,
                installing: reg.installing?.state,
                waiting: reg.waiting?.state
              });
            });
            
            if (allRegs.length === 0) {
              console.error('💀 All Service Workers disappeared - likely a persistent issue');
              console.log('🔧 Attempting emergency re-registration...');
              
              // 緊急再登録
              const emergencyReg = await navigator.serviceWorker.register('/notification-worker.js', {
                scope: '/notifications/',
                updateViaCache: 'none'
              });
              console.log('🚨 Emergency registration:', emergencyReg);
            }
          }, 10000);
          
        } catch (error) {
          console.error('❌ Registration failed:', error);
        }
      };
      
      // すぐに実行
      registerWithRetry();
      
      // ページロード時にも実行
      if (document.readyState === 'loading') {
        window.addEventListener('load', registerWithRetry);
      }
    }
  }, []);
  
  return null;
}