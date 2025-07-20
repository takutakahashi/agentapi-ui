'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // window.onloadを使用してService Workerを登録（Qiita記事の解決法）
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        console.log('🔧 Window loaded, registering Service Worker...');
        
        try {
          // 既存の登録を確認
          const registrations = await navigator.serviceWorker.getRegistrations();
          console.log(`📋 Found ${registrations.length} existing Service Worker registrations`);
          
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
            
            // 登録完了を待機
            if (!registration.active) {
              await new Promise<void>((resolve) => {
                const worker = registration.installing || registration.waiting;
                if (worker) {
                  worker.addEventListener('statechange', () => {
                    if (worker.state === 'activated') {
                      console.log('✅ Service Worker activated');
                      resolve();
                    }
                  });
                } else {
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
          
        } catch (error) {
          console.error('❌ Service Worker registration failed:', error);
        }
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