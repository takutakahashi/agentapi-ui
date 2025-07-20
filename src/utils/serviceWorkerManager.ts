// Service Worker 管理システム（競合問題対応）
export interface ServiceWorkerRegistrationInfo {
  scope: string;
  scriptURL: string;
  state: string;
  updateFound: boolean;
  isActive: boolean;
  isInstalling: boolean;
  isWaiting: boolean;
}

export class ServiceWorkerManager {
  private registrations: Map<string, ServiceWorkerRegistration> = new Map();
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor() {
    this.setupMessageListener();
  }

  // Service Worker の状態を詳細に分析
  async analyzeServiceWorkerState(): Promise<{
    supported: boolean;
    controlled: boolean;
    registrations: ServiceWorkerRegistrationInfo[];
    conflicts: string[];
    recommendations: string[];
  }> {
    console.log('🔍 Analyzing Service Worker state...');

    const result = {
      supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      controlled: typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller,
      registrations: [] as ServiceWorkerRegistrationInfo[],
      conflicts: [] as string[],
      recommendations: [] as string[]
    };

    if (!result.supported) {
      result.recommendations.push('Service Worker がサポートされていません');
      return result;
    }

    try {
      // 全ての登録済み Service Worker を取得
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`📋 Found ${registrations.length} Service Worker registrations`);

      for (const registration of registrations) {
        const info: ServiceWorkerRegistrationInfo = {
          scope: registration.scope,
          scriptURL: registration.active?.scriptURL || registration.installing?.scriptURL || 'unknown',
          state: registration.active?.state || 'unknown',
          updateFound: false,
          isActive: !!registration.active,
          isInstalling: !!registration.installing,
          isWaiting: !!registration.waiting
        };

        result.registrations.push(info);
        this.registrations.set(registration.scope, registration);

        // 競合検出
        if (registration.scope === location.origin + '/' && 
            !info.scriptURL.includes('notification-sw.js') && 
            !info.scriptURL.includes('sw.js')) {
          result.conflicts.push(`Unknown Service Worker at root scope: ${info.scriptURL}`);
        }

        // 複数のワーカーが同じスコープを制御
        if (info.isActive && info.isWaiting) {
          result.conflicts.push(`Multiple workers in scope ${registration.scope}`);
        }
      }

      // 推奨事項の生成
      this.generateRecommendations(result);

    } catch (error) {
      console.error('❌ Failed to analyze Service Worker state:', error);
      result.recommendations.push(`分析エラー: ${error}`);
    }

    return result;
  }

  // 専用通知 Service Worker の登録
  async registerNotificationServiceWorker(): Promise<{
    success: boolean;
    registration?: ServiceWorkerRegistration;
    error?: string;
    hadConflict: boolean;
  }> {
    console.log('🔧 Registering notification Service Worker...');

    const result = {
      success: false,
      hadConflict: false,
      registration: undefined as ServiceWorkerRegistration | undefined,
      error: undefined as string | undefined
    };

    try {
      // 既存の競合をチェック
      const existingRegistrations = await navigator.serviceWorker.getRegistrations();
      const rootScopeRegistrations = existingRegistrations.filter(reg => 
        reg.scope === location.origin + '/'
      );

      if (rootScopeRegistrations.length > 0) {
        console.log('⚠️ Existing Service Worker found at root scope');
        result.hadConflict = true;

        // 既存のワーカーが通知機能を持っているかチェック
        for (const reg of rootScopeRegistrations) {
          if (reg.active?.scriptURL.includes('sw.js')) {
            console.log('🤝 Using existing Next.js Service Worker');
            // 既存のワーカーにメッセージングで通知機能を追加
            await this.enhanceExistingServiceWorker(reg);
            result.success = true;
            result.registration = reg;
            return result;
          }
        }
      }

      // 専用通知ワーカーを登録
      console.log('📦 Registering dedicated notification worker...');
      const registration = await navigator.serviceWorker.register('/notification-sw.js', {
        scope: '/notifications/',
        updateViaCache: 'none'
      });

      console.log('✅ Notification Service Worker registered:', registration);

      // アクティブ化を待機
      await this.waitForServiceWorkerActivation(registration);

      result.success = true;
      result.registration = registration;
      this.registrations.set(registration.scope, registration);

    } catch (error) {
      console.error('❌ Failed to register notification Service Worker:', error);
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  // 既存の Service Worker に通知機能を注入
  private async enhanceExistingServiceWorker(registration: ServiceWorkerRegistration): Promise<void> {
    console.log('💉 Enhancing existing Service Worker with notification capabilities...');

    if (!registration.active) {
      throw new Error('No active Service Worker to enhance');
    }

    // 既存ワーカーに通知処理を追加するメッセージを送信
    registration.active.postMessage({
      type: 'ENHANCE_WITH_NOTIFICATIONS',
      config: {
        enablePushNotifications: true,
        defaultIcon: '/icon-192x192.png',
        defaultBadge: '/icon-192x192.png'
      }
    });

    // 機能拡張の成功を確認
    const enhancementResult = await this.waitForMessage('ENHANCEMENT_COMPLETE', 5000);
    if (!enhancementResult) {
      throw new Error('Service Worker enhancement timed out');
    }

    console.log('✅ Service Worker enhanced successfully');
  }

  // Service Worker のアクティブ化を待機
  private async waitForServiceWorkerActivation(registration: ServiceWorkerRegistration): Promise<void> {
    console.log('⏳ Waiting for Service Worker activation...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service Worker activation timeout'));
      }, 10000);

      if (registration.active) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      const worker = registration.installing || registration.waiting;
      if (!worker) {
        clearTimeout(timeout);
        reject(new Error('No Service Worker to activate'));
        return;
      }

      worker.addEventListener('statechange', () => {
        console.log('🔄 Service Worker state changed to:', worker.state);
        
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

  // メッセージリスナーの設定
  private setupMessageListener(): void {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Message from Service Worker:', event.data);
        
        const { type, data } = event.data;
        const handler = this.messageHandlers.get(type);
        
        if (handler) {
          handler(data);
        } else {
          console.log('🤷 No handler for message type:', type);
        }
      });
    }
  }

  // メッセージハンドラーの登録
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // メッセージの待機
  private async waitForMessage(type: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeout);
      
      const handler = (data: any) => {
        clearTimeout(timer);
        this.messageHandlers.delete(type);
        resolve(data);
      };
      
      this.messageHandlers.set(type, handler);
    });
  }

  // 通知送信（利用可能な Service Worker 経由）
  async sendNotification(title: string, options: NotificationOptions = {}): Promise<{
    success: boolean;
    method: string;
    error?: string;
  }> {
    console.log('📤 Sending notification via Service Worker...');

    try {
      // 通知専用Service Workerを探す
      const registrations = await navigator.serviceWorker.getRegistrations();
      const notificationWorker = registrations.find(reg => 
        reg.scope.includes('/notifications/')
      );
      
      if (notificationWorker && notificationWorker.active) {
        console.log('✅ Found notification-specific Service Worker');
        
        await notificationWorker.showNotification(title, {
          body: options.body || '',
          icon: options.icon || '/icon-192x192.png',
          badge: options.badge || '/icon-192x192.png',
          tag: options.tag || `sw-notification-${Date.now()}`,
          requireInteraction: options.requireInteraction || false,
          silent: options.silent || false,
          data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
          },
          ...options
        });
        
        console.log('🔔 Notification-specific Service Worker notification sent successfully');
        return { success: true, method: 'notification-worker' };
      }
      
      // フォールバック: 一般的なService Worker
      const registration = await navigator.serviceWorker.ready;
      
      if (registration && registration.active) {
        console.log('✅ Found active Service Worker, sending notification');
        
        // Qiita記事推奨: 通知オプションを適切に設定
        const notificationOptions: NotificationOptions = {
          body: options.body || '',
          icon: options.icon || '/icon-192x192.png',
          badge: options.badge || '/icon-192x192.png',
          tag: options.tag || `sw-notification-${Date.now()}`,
          requireInteraction: options.requireInteraction || false,
          silent: options.silent || false,
          data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
          },
          ...options
        };
        
        await registration.showNotification(title, notificationOptions);
        
        console.log('🔔 Service Worker notification sent successfully');
        return { success: true, method: 'service-worker-ready' };
      }
    } catch (error) {
      console.warn('⚠️ Service Worker ready method failed:', error);
    }

    // フォールバック1: 専用通知ワーカー
    const notificationWorker = Array.from(this.registrations.values())
      .find(reg => reg.active?.scriptURL.includes('notification-sw.js'));

    if (notificationWorker?.active) {
      try {
        console.log('🔧 Trying dedicated notification worker');
        notificationWorker.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          data: { title, ...options }
        });
        
        const result = await this.waitForMessage('NOTIFICATION_DISPLAYED', 3000);
        if (result) {
          return { success: true, method: 'dedicated-worker' };
        }
      } catch (error) {
        console.warn('⚠️ Dedicated worker failed:', error);
      }
    }

    // フォールバック2: 既存ワーカー
    const mainWorker = Array.from(this.registrations.values())
      .find(reg => reg.scope === location.origin + '/');

    if (mainWorker?.active) {
      try {
        console.log('🔧 Trying main worker');
        await mainWorker.showNotification(title, options);
        return { success: true, method: 'main-worker' };
      } catch (error) {
        console.warn('⚠️ Main worker failed:', error);
      }
    }

    // フォールバック3: 緊急Service Worker登録
    try {
      console.log('🚨 Emergency Service Worker registration for notification');
      const emergencyRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      
      // アクティブ化を短時間待機
      await new Promise((resolve) => {
        if (emergencyRegistration.active) {
          resolve(void 0);
        } else {
          setTimeout(resolve, 1000); // 1秒待機
        }
      });
      
      if (emergencyRegistration.active) {
        await emergencyRegistration.showNotification(title, {
          ...options,
          icon: options.icon || '/icon-192x192.png'
        });
        return { success: true, method: 'emergency-worker' };
      }
    } catch (error) {
      console.warn('⚠️ Emergency worker registration failed:', error);
    }

    return { 
      success: false, 
      method: 'none',
      error: 'No Service Worker available for notifications'
    };
  }

  // 通知テスト（包括的）
  async runComprehensiveNotificationTest(): Promise<{
    results: Array<{
      method: string;
      success: boolean;
      duration: number;
      error?: string;
    }>;
    overallSuccess: boolean;
    recommendations: string[];
  }> {
    console.log('🧪 Running comprehensive notification test...');

    const results: Array<{
      method: string;
      success: boolean;
      duration: number;
      error?: string;
    }> = [];

    // テスト1: Service Worker経由
    const swTest = await this.testServiceWorkerNotification();
    results.push(swTest);

    // テスト2: ネイティブ通知
    const nativeTest = await this.testNativeNotification();
    results.push(nativeTest);

    // テスト3: バックグラウンド通知
    const backgroundTest = await this.testBackgroundNotification();
    results.push(backgroundTest);

    const overallSuccess = results.some(r => r.success);
    const recommendations = this.generateTestRecommendations(results);

    return {
      results,
      overallSuccess,
      recommendations
    };
  }

  private async testServiceWorkerNotification(): Promise<{
    method: string;
    success: boolean;
    duration: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const testResult = { method: 'service-worker', success: false, duration: 0, error: undefined as string | undefined };

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('SW Test', {
        body: 'Service Worker notification test',
        tag: 'sw-test',
        silent: true
      });
      
      testResult.success = true;
    } catch (error) {
      testResult.error = error instanceof Error ? error.message : String(error);
    }

    testResult.duration = Date.now() - startTime;
    return testResult;
  }

  private async testNativeNotification(): Promise<{
    method: string;
    success: boolean;
    duration: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const testResult = { method: 'native', success: false, duration: 0, error: undefined as string | undefined };

    if (Notification.permission !== 'granted') {
      testResult.error = 'Permission not granted';
      testResult.duration = Date.now() - startTime;
      return testResult;
    }

    try {
      const notification = new Notification('Native Test', {
        body: 'Native notification test',
        tag: 'native-test',
        silent: true
      });
      
      testResult.success = true;
      setTimeout(() => notification.close(), 1000);
    } catch (error) {
      testResult.error = error instanceof Error ? error.message : String(error);
    }

    testResult.duration = Date.now() - startTime;
    return testResult;
  }

  private async testBackgroundNotification(): Promise<{
    method: string;
    success: boolean;
    duration: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const testResult = { method: 'background', success: false, duration: 0, error: undefined as string | undefined };

    try {
      // フォーカス状態を記録
      const hadFocus = document.hasFocus();
      const visibility = document.visibilityState;
      
      const notification = new Notification('Background Test', {
        body: `Focus: ${hadFocus}, Visibility: ${visibility}`,
        tag: 'background-test',
        silent: true
      });
      
      testResult.success = true;
      setTimeout(() => notification.close(), 1000);
    } catch (error) {
      testResult.error = error instanceof Error ? error.message : String(error);
    }

    testResult.duration = Date.now() - startTime;
    return testResult;
  }

  private generateRecommendations(state: any): void {
    if (state.conflicts.length > 0) {
      state.recommendations.push('Service Worker の競合が検出されました');
      state.recommendations.push('専用スコープでの通知ワーカー登録を推奨');
    }

    if (!state.controlled) {
      state.recommendations.push('Service Worker がページを制御していません');
      state.recommendations.push('ページの再読み込みが必要な可能性があります');
    }

    if (state.registrations.length === 0) {
      state.recommendations.push('Service Worker が登録されていません');
      state.recommendations.push('通知機能の初期化が必要です');
    }
  }

  private generateTestRecommendations(results: any[]): string[] {
    const recommendations: string[] = [];
    
    const failedTests = results.filter(r => !r.success);
    
    if (failedTests.length === results.length) {
      recommendations.push('⚠️ 全ての通知テストが失敗しました');
      recommendations.push('ブラウザ設定と権限を確認してください');
    } else if (failedTests.length > 0) {
      recommendations.push('⚠️ 一部の通知方法が失敗しています');
      failedTests.forEach(test => {
        recommendations.push(`- ${test.method}: ${test.error}`);
      });
    } else {
      recommendations.push('✅ 全ての通知テストが成功しました');
    }
    
    return recommendations;
  }
}

export const serviceWorkerManager = new ServiceWorkerManager();