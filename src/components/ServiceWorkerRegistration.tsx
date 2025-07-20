'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    console.log('🔍 ServiceWorkerRegistration component mounted');
    console.log('🔍 window object:', typeof window);
    console.log('🔍 navigator.serviceWorker:', 'serviceWorker' in navigator);
    
    // Service Worker登録のデバッグ関数
    const registerServiceWorker = async () => {
      console.log('🔧 Attempting to register Service Worker...');
      console.log('🔍 Current URL:', window.location.href);
      console.log('🔍 Protocol:', window.location.protocol);
      console.log('🔍 Is HTTPS:', window.location.protocol === 'https:');
      console.log('🔍 Is localhost:', window.location.hostname === 'localhost');
      
      try {
        // sw.jsのフェッチテスト
        console.log('🔍 Testing sw.js accessibility...');
        const swResponse = await fetch('/sw.js');
        console.log('🔍 sw.js response status:', swResponse.status);
        console.log('🔍 sw.js content-type:', swResponse.headers.get('content-type'));
        
        // 既存の登録を確認
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`📋 Found ${registrations.length} existing Service Worker registrations`);
        registrations.forEach((reg, index) => {
          console.log(`📋 Registration ${index}:`, {
            scope: reg.scope,
            scriptURL: reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL,
            state: reg.active ? 'active' : reg.installing ? 'installing' : reg.waiting ? 'waiting' : 'none'
          });
        });
        
        // /sw.js が登録されているか確認
        const hasMainSW = registrations.some(reg => 
          reg.active?.scriptURL.includes('/sw.js')
        );
        
        if (!hasMainSW) {
          console.log('📦 Registering main Service Worker...');
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });
          
          console.log('✅ Service Worker registered:', registration);
          console.log('🔍 Registration details:', {
            scope: registration.scope,
            installing: registration.installing,
            waiting: registration.waiting,
            active: registration.active,
            updateViaCache: registration.updateViaCache
          });
          
          // 登録完了を待機
          if (!registration.active) {
            await new Promise<void>((resolve) => {
              const worker = registration.installing || registration.waiting;
              if (worker) {
                console.log('🔍 Worker state:', worker.state);
                worker.addEventListener('statechange', () => {
                  console.log('🔍 Worker state changed to:', worker.state);
                  if (worker.state === 'activated') {
                    console.log('✅ Service Worker activated');
                    resolve();
                  }
                });
              } else {
                console.log('⚠️ No worker found in installing or waiting state');
                resolve();
              }
            });
          }
          
          // ページをリロードして新しいService Workerを適用
          if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('📱 PWA mode detected, Service Worker will be active on next launch');
          }
        } else {
          console.log('✅ Service Worker already registered');
        }
        
        // Service Worker の準備完了を確認
        const ready = await navigator.serviceWorker.ready;
        console.log('✅ Service Worker ready:', ready);
        console.log('🔍 Ready SW details:', {
          scope: ready.scope,
          active: ready.active ? {
            scriptURL: ready.active.scriptURL,
            state: ready.active.state
          } : null
        });
        
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : 'Unknown'
        });
      }
    };
    
    // window.onloadを使用してService Workerを登録
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // 即座に登録を試みる
      console.log('🔍 Attempting immediate registration...');
      registerServiceWorker();
      
      // window.onloadでも登録を試みる
      window.addEventListener('load', () => {
        console.log('🔍 Window loaded, attempting registration again...');
        registerServiceWorker();
      });
    } else {
      console.warn('⚠️ Service Worker not supported:', {
        windowDefined: typeof window !== 'undefined',
        serviceWorkerInNavigator: typeof window !== 'undefined' && 'serviceWorker' in navigator
      });
    }
    
    // クリーンアップ
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', () => {});
      }
    };
  }, []);
  
  return null;
}