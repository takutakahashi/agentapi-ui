// 統合的な通知管理システム（Ultra Deep Analysis 対応）
import { notificationDiagnostics, NotificationDiagnosticResult } from './notificationDiagnostics';
import { browserNotificationHandler } from './browserSpecificNotifications';
import { serviceWorkerManager } from './serviceWorkerManager';

export interface NotificationConfig {
  agentResponses: boolean;
  sessionEvents: boolean;
  systemNotifications: boolean;
  quiet: boolean;
  quietStart: string;
  quietEnd: string;
}

export interface NotificationTestResult {
  success: boolean;
  method: string;
  duration: number;
  error?: string;
  details?: any;
}

export interface UltimateNotificationStatus {
  isSupported: boolean;
  permission: NotificationPermission;
  isReady: boolean;
  diagnostics: NotificationDiagnosticResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browserAnalysis: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceWorkerStatus: any;
  recommendations: string[];
  testResults: NotificationTestResult[];
}

export class UltimateNotificationManager {
  private config: NotificationConfig;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.setupEventListeners();
  }

  // 完全な初期化プロセス
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;

    console.log('🚀 Starting Ultimate Notification Manager initialization...');

    this.initPromise = this.performInitialization();
    const result = await this.initPromise;
    
    if (result) {
      this.isInitialized = true;
      console.log('✅ Ultimate Notification Manager initialized successfully');
    } else {
      console.error('❌ Ultimate Notification Manager initialization failed');
    }

    return result;
  }

  private async performInitialization(): Promise<boolean> {
    try {
      // ステップ1: 基本サポート確認
      if (!('Notification' in window)) {
        console.error('❌ Notification API not supported');
        return false;
      }

      // ステップ2: 権限確認・要求
      const permission = await this.ensurePermission();
      if (permission !== 'granted') {
        console.warn('⚠️ Notification permission not granted:', permission);
        return false;
      }

      // ステップ3: Service Worker セットアップ
      await this.setupServiceWorker();

      // ステップ4: ブラウザ固有の最適化
      await this.optimizeForBrowser();

      // ステップ5: 診断実行
      await this.runDiagnostics();

      return true;
    } catch (error) {
      console.error('❌ Initialization error:', error);
      return false;
    }
  }

  private async ensurePermission(): Promise<NotificationPermission> {
    console.log('🔐 Ensuring notification permission...');
    
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return 'denied';
    }
    
    let permission = Notification.permission;
    console.log('Current permission:', permission);

    if (permission === 'default') {
      console.log('📋 Requesting notification permission...');
      permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
    }

    return permission;
  }

  private async setupServiceWorker(): Promise<void> {
    console.log('⚙️ Setting up Service Worker...');
    
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Worker not supported');
      return;
    }

    try {
      // Service Worker の状態分析
      const swState = await serviceWorkerManager.analyzeServiceWorkerState();
      console.log('📊 Service Worker state:', swState);

      // 既存のService Workerがある場合は利用
      if (swState.registrations.length > 0 && swState.controlled) {
        console.log('✅ Using existing Service Worker for notifications');
        this.setupServiceWorkerMessaging();
        return;
      }

      // Service Worker未登録の場合は緊急登録
      if (swState.registrations.length === 0) {
        console.log('🚨 No Service Worker found - attempting emergency registration');
        
        try {
          // まず既存のNext.js Service Workerを確認
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none'
          });
          
          console.log('📦 Emergency Service Worker registered:', registration);
          
          // アクティブ化を待機
          await this.waitForServiceWorkerReady(registration);
          
        } catch (swError) {
          console.warn('⚠️ Emergency SW registration failed, trying notification-specific:', swError);
          
          // フォールバック: 通知専用ワーカー
          const notificationResult = await serviceWorkerManager.registerNotificationServiceWorker();
          console.log('📦 Notification-specific Service Worker:', notificationResult);
        }
      }

      // 競合がある場合の対処
      if (swState.conflicts.length > 0) {
        console.warn('⚠️ Service Worker conflicts detected:', swState.conflicts);
      }

      // メッセージハンドラーの設定
      this.setupServiceWorkerMessaging();

    } catch (error) {
      console.error('❌ Service Worker setup failed:', error);
    }
  }

  private async waitForServiceWorkerReady(registration: ServiceWorkerRegistration): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service Worker ready timeout'));
      }, 10000);

      if (registration.active) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      const worker = registration.installing || registration.waiting;
      if (!worker) {
        clearTimeout(timeout);
        resolve(); // すでに準備完了
        return;
      }

      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          clearTimeout(timeout);
          resolve();
        } else if (worker.state === 'redundant') {
          clearTimeout(timeout);
          reject(new Error('Service Worker became redundant'));
        }
      });
    });
  }

  private setupServiceWorkerMessaging(): void {
    // Service Worker からのメッセージ処理
    serviceWorkerManager.onMessage('NOTIFICATION_DISPLAYED', (data) => {
      console.log('✅ Notification displayed via Service Worker:', data);
    });

    serviceWorkerManager.onMessage('NOTIFICATION_ERROR', (data) => {
      console.error('❌ Service Worker notification error:', data);
    });

    serviceWorkerManager.onMessage('NOTIFICATION_CLICKED', (data) => {
      console.log('👆 Notification clicked:', data);
      this.handleNotificationClick(data);
    });

    serviceWorkerManager.onMessage('NOTIFICATION_CLOSED', (data) => {
      console.log('❌ Notification closed:', data);
    });
  }

  private async optimizeForBrowser(): Promise<void> {
    console.log('🎯 Optimizing for browser...');
    
    try {
      const browserTest = await browserNotificationHandler.runEnvironmentSpecificTest();
      console.log('🌐 Browser-specific test result:', browserTest);

      if (!browserTest.testResult) {
        console.warn('⚠️ Browser-specific optimization needed:', browserTest.recommendations);
      }
    } catch (error) {
      console.error('❌ Browser optimization failed:', error);
    }
  }

  private async runDiagnostics(): Promise<void> {
    console.log('🔍 Running comprehensive diagnostics...');
    
    try {
      const diagnostics = await notificationDiagnostics.runFullDiagnostics();
      console.log('📊 Full diagnostics:', diagnostics);

      // 診断結果に基づく最適化
      this.applyDiagnosticOptimizations(diagnostics);
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
    }
  }

  private applyDiagnosticOptimizations(diagnostics: NotificationDiagnosticResult): void {
    // iOS Safari の場合
    if (diagnostics.browser.ios && diagnostics.browser.safari) {
      if (!diagnostics.pwa.isStandalone) {
        console.warn('⚠️ iOS Safari requires PWA installation for notifications');
      }
    }

    // Android Chrome の場合
    if (diagnostics.browser.android && diagnostics.browser.chrome) {
      console.log('🤖 Optimizing for Android Chrome...');
    }

    // デスクトップの場合
    if (!diagnostics.browser.mobile) {
      console.log('💻 Optimizing for desktop...');
    }
  }

  // 統合通知送信システム
  async sendNotification(title: string, options: NotificationOptions = {}): Promise<NotificationTestResult> {
    console.log('📤 Sending notification:', title, options);

    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          method: 'none',
          duration: 0,
          error: 'Manager not initialized'
        };
      }
    }

    const startTime = Date.now();
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;

    // PWAモードでは Service Worker 優先、そうでなければ従来の順序
    const methods = isPWA ? [
      () => this.sendViaServiceWorker(title, options),
      () => this.sendViaFallback(title, options) // PWAではnativeはスキップ
    ] : [
      () => this.sendViaServiceWorker(title, options),
      () => this.sendViaNativeAPI(title, options),
      () => this.sendViaFallback(title, options)
    ];

    console.log(`🎯 PWA mode: ${isPWA}, trying ${methods.length} methods`);

    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`🔄 Trying notification method ${i + 1}/${methods.length}`);
        const result = await methods[i]();
        if (result.success) {
          result.duration = Date.now() - startTime;
          console.log(`✅ Notification sent successfully via method ${i + 1}: ${result.method}`);
          return result;
        } else {
          console.warn(`⚠️ Method ${i + 1} failed: ${result.error}`);
        }
      } catch (error) {
        console.warn(`⚠️ Method ${i + 1} threw error:`, error);
      }
    }

    return {
      success: false,
      method: 'all-failed',
      duration: Date.now() - startTime,
      error: 'All notification methods failed'
    };
  }

  private async sendViaServiceWorker(title: string, options: NotificationOptions): Promise<NotificationTestResult> {
    console.log('🔧 Attempting Service Worker notification...');
    
    const result = await serviceWorkerManager.sendNotification(title, options);
    
    return {
      success: result.success,
      method: `service-worker-${result.method}`,
      duration: 0,
      error: result.error
    };
  }

  private async sendViaNativeAPI(title: string, options: NotificationOptions): Promise<NotificationTestResult> {
    console.log('🌐 Attempting native notification...');

    if (Notification.permission !== 'granted') {
      return {
        success: false,
        method: 'native',
        duration: 0,
        error: 'Permission not granted'
      };
    }

    // PWAモードや一部ブラウザでは Service Worker経由でのみ通知可能
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    if (isPWA) {
      console.log('🚫 PWA mode detected - native notifications not allowed');
      return {
        success: false,
        method: 'native',
        duration: 0,
        error: 'PWA mode requires Service Worker notifications'
      };
    }

    try {
      const notification = new Notification(title, {
        ...options,
        icon: options.icon || '/icon-192x192.png',
        tag: options.tag || `notification-${Date.now()}`
      });

      // 通知の表示確認
      const displayed = await new Promise<boolean>((resolve) => {
        notification.onshow = () => resolve(true);
        notification.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 3000);
      });

      if (displayed) {
        // イベントハンドラーの設定
        notification.onclick = () => {
          console.log('👆 Native notification clicked');
          this.handleNotificationClick({ tag: notification.tag, method: 'native' });
          notification.close();
        };

        // 自動クローズ（オプション）
        if (!options.requireInteraction) {
          setTimeout(() => notification.close(), 5000);
        }
      }

      return {
        success: displayed,
        method: 'native',
        duration: 0,
        error: displayed ? undefined : 'Notification not displayed'
      };

    } catch (error) {
      return {
        success: false,
        method: 'native',
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async sendViaFallback(title: string, options: NotificationOptions): Promise<NotificationTestResult> {
    console.log('🚨 Using fallback notification method...');

    // フォールバック: ブラウザアラート（最後の手段）
    try {
      const message = `${title}\n${options.body || ''}`;
      
      // モーダル風の表示（より良いUX）
      if (typeof window !== 'undefined') {
        const fallbackElement = this.createFallbackNotification(title, options.body || '');
        document.body.appendChild(fallbackElement);
        
        setTimeout(() => {
          document.body.removeChild(fallbackElement);
        }, 5000);

        return {
          success: true,
          method: 'fallback-modal',
          duration: 0
        };
      }

      // 最終フォールバック
      alert(message);
      
      return {
        success: true,
        method: 'fallback-alert',
        duration: 0
      };

    } catch (error) {
      return {
        success: false,
        method: 'fallback',
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private createFallbackNotification(title: string, body: string): HTMLElement {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">${title}</div>
      <div style="font-size: 14px; opacity: 0.9;">${body}</div>
      <div style="margin-top: 8px; text-align: right;">
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: none; border: 1px solid #666; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
          閉じる
        </button>
      </div>
    `;

    return notification;
  }

  // 完全なステータス取得
  async getStatus(): Promise<UltimateNotificationStatus> {
    console.log('📊 Getting ultimate notification status...');

    if (typeof window === 'undefined') {
      return {
        isSupported: false,
        permission: 'denied',
        isReady: false,
        diagnostics: {} as NotificationDiagnosticResult,
        browserAnalysis: {},
        serviceWorkerStatus: {},
        recommendations: ['SSR環境では通知機能は利用できません'],
        testResults: []
      };
    }

    const [diagnostics, browserAnalysis, serviceWorkerStatus, testResults] = await Promise.all([
      notificationDiagnostics.runFullDiagnostics(),
      browserNotificationHandler.runEnvironmentSpecificTest(),
      serviceWorkerManager.analyzeServiceWorkerState(),
      this.runComprehensiveTests()
    ]);

    const recommendations = this.generateUltimateRecommendations(
      diagnostics,
      browserAnalysis,
      serviceWorkerStatus,
      testResults
    );

    return {
      isSupported: typeof window !== 'undefined' && 'Notification' in window,
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      isReady: this.isInitialized,
      diagnostics,
      browserAnalysis,
      serviceWorkerStatus,
      recommendations,
      testResults
    };
  }

  private async runComprehensiveTests(): Promise<NotificationTestResult[]> {
    console.log('🧪 Running comprehensive notification tests...');

    const tests = [
      () => this.testMethod('basic', 'Basic Test', { body: 'Testing basic notification' }),
      () => this.testMethod('with-icon', 'Icon Test', { body: 'Testing with icon', icon: '/icon-192x192.png' }),
      () => this.testMethod('silent', 'Silent Test', { body: 'Testing silent notification', silent: true }),
      () => this.testMethod('persistent', 'Persistent Test', { body: 'Testing persistent notification', requireInteraction: true }),
    ];

    const results: NotificationTestResult[] = [];

    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
        // テスト間の間隔
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          success: false,
          method: 'test-error',
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  private async testMethod(method: string, title: string, options: NotificationOptions): Promise<NotificationTestResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.sendNotification(title, {
        ...options,
        tag: `test-${method}`,
        silent: true // テスト中は音を出さない
      });

      return {
        ...result,
        method: `test-${method}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        method: `test-${method}`,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private generateUltimateRecommendations(
    diagnostics: NotificationDiagnosticResult,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browserAnalysis: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serviceWorkerStatus: any,
    testResults: NotificationTestResult[]
  ): string[] {
    const recommendations: string[] = [];

    // 権限関連
    if (diagnostics.permissions.current !== 'granted') {
      recommendations.push('🔐 通知権限の許可が必要です');
    }

    // ブラウザ固有
    if (!browserAnalysis.testResult) {
      recommendations.push('🌐 ブラウザ固有の制限があります');
      recommendations.push(...browserAnalysis.recommendations);
    }

    // Service Worker 関連
    if (serviceWorkerStatus.conflicts.length > 0) {
      recommendations.push('⚙️ Service Worker の競合が検出されました');
      recommendations.push(...serviceWorkerStatus.recommendations);
    }

    // テスト結果関連
    const failedTests = testResults.filter(t => !t.success);
    if (failedTests.length > 0) {
      recommendations.push(`🧪 ${failedTests.length}個のテストが失敗しました`);
      failedTests.forEach(test => {
        recommendations.push(`  - ${test.method}: ${test.error}`);
      });
    }

    // 環境固有の推奨事項
    if (diagnostics.browser.ios && !diagnostics.pwa.isStandalone) {
      recommendations.push('📱 iOS では PWA としてホーム画面に追加が必要です');
    }

    if (diagnostics.browser.mobile && diagnostics.document.visibilityState === 'hidden') {
      recommendations.push('👁️ モバイルではバックグラウンド通知が制限される場合があります');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ 通知システムは正常に動作しています');
    }

    return recommendations;
  }

  // 設定管理
  private loadConfig(): NotificationConfig {
    if (typeof window === 'undefined') {
      return this.getDefaultConfig();
    }
    
    try {
      const saved = localStorage.getItem('ultimate-notification-config');
      if (saved) {
        return { ...this.getDefaultConfig(), ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('⚠️ Failed to load config:', error);
    }
    
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): NotificationConfig {
    return {
      agentResponses: true,
      sessionEvents: true,
      systemNotifications: true,
      quiet: false,
      quietStart: '22:00',
      quietEnd: '08:00'
    };
  }

  updateConfig(updates: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...updates };
    if (typeof window !== 'undefined') {
      localStorage.setItem('ultimate-notification-config', JSON.stringify(this.config));
    }
    console.log('💾 Configuration updated:', this.config);
  }

  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  // イベント処理
  private setupEventListeners(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    
    // ページの可視性変更
    document.addEventListener('visibilitychange', () => {
      console.log('👁️ Page visibility changed:', document.visibilityState);
    });

    // ページフォーカス
    window.addEventListener('focus', () => {
      console.log('🎯 Page focused');
    });

    window.addEventListener('blur', () => {
      console.log('😴 Page blurred');
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleNotificationClick(data: any): void {
    console.log('👆 Handling notification click:', data);
    
    // カスタムクリック処理をここに追加
    // 例: 特定のページへの遷移、モーダルの表示など
  }

  // テスト・デバッグ用メソッド
  async runUltimateTest(): Promise<void> {
    console.log('🎯 Running ultimate notification test...');
    
    const status = await this.getStatus();
    console.log('📊 Ultimate status:', status);
    
    if (status.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      status.recommendations.forEach(rec => console.log(`  ${rec}`));
    }
  }
}

// シングルトンインスタンス
export const ultimateNotificationManager = new UltimateNotificationManager();