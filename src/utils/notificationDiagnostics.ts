// 包括的な通知診断ユーティリティ
export interface NotificationDiagnosticResult {
  timestamp: number;
  userAgent: string;
  environment: {
    isSecureContext: boolean;
    isLocalhost: boolean;
    protocol: string;
    origin: string;
    domain: string;
  };
  permissions: {
    current: NotificationPermission;
    canRequestPermission: boolean;
    permissionsAPISupported: boolean;
    permissionsAPIState?: string;
  };
  apis: {
    notificationAPI: boolean;
    serviceWorkerAPI: boolean;
    pushManagerAPI: boolean;
    permissionsAPI: boolean;
  };
  serviceWorker: {
    supported: boolean;
    controlled: boolean;
    registrations: Array<{
      scope: string;
      active: boolean;
      installing: boolean;
      waiting: boolean;
      updatefound: boolean;
    }>;
    activeWorkerState?: string;
  };
  browser: {
    name: string;
    version: string;
    mobile: boolean;
    ios: boolean;
    android: boolean;
    safari: boolean;
    chrome: boolean;
    firefox: boolean;
    edge: boolean;
  };
  document: {
    visibilityState: DocumentVisibilityState;
    hasFocus: boolean;
    hidden: boolean;
  };
  pwa: {
    isStandalone: boolean;
    isInstalled: boolean;
    canInstall: boolean;
  };
  tests: {
    basicNotificationTest: NotificationTestResult;
    serviceWorkerNotificationTest: NotificationTestResult;
    backgroundNotificationTest: NotificationTestResult;
  };
}

export interface NotificationTestResult {
  attempted: boolean;
  successful: boolean;
  error?: string;
  duration?: number;
  details?: any;
}

export class NotificationDeepDiagnostics {
  private results: Partial<NotificationDiagnosticResult> = {};

  async runFullDiagnostics(): Promise<NotificationDiagnosticResult> {
    console.log('🔍 Starting Ultra Deep Notification Diagnostics...');
    
    this.results.timestamp = Date.now();
    this.results.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR';
    
    // 環境分析
    await this.analyzeEnvironment();
    
    // 権限分析
    await this.analyzePermissions();
    
    // API分析
    await this.analyzeAPIs();
    
    // Service Worker分析
    await this.analyzeServiceWorker();
    
    // ブラウザ分析
    await this.analyzeBrowser();
    
    // ドキュメント状態分析
    await this.analyzeDocumentState();
    
    // PWA分析
    await this.analyzePWA();
    
    // 通知テスト実行
    await this.runNotificationTests();
    
    console.log('📊 Deep Diagnostics Complete:', this.results);
    return this.results as NotificationDiagnosticResult;
  }

  private async analyzeEnvironment(): Promise<void> {
    if (typeof window === 'undefined') {
      this.results.environment = {
        isSecureContext: false,
        isLocalhost: false,
        protocol: 'SSR',
        origin: 'SSR',
        domain: 'SSR'
      };
      return;
    }

    this.results.environment = {
      isSecureContext: window.isSecureContext,
      isLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
      protocol: location.protocol,
      origin: location.origin,
      domain: location.hostname
    };
  }

  private async analyzePermissions(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permissions: any = {
      current: Notification.permission,
      canRequestPermission: typeof Notification.requestPermission === 'function',
      permissionsAPISupported: 'permissions' in navigator
    };

    if (permissions.permissionsAPISupported) {
      try {
        const status = await navigator.permissions.query({ name: 'notifications' as PermissionName });
        permissions.permissionsAPIState = status.state;
      } catch (error) {
        console.warn('Permissions API query failed:', error);
      }
    }

    this.results.permissions = permissions;
  }

  private async analyzeAPIs(): Promise<void> {
    this.results.apis = {
      notificationAPI: 'Notification' in window,
      serviceWorkerAPI: 'serviceWorker' in navigator,
      pushManagerAPI: 'PushManager' in window,
      permissionsAPI: 'permissions' in navigator
    };
  }

  private async analyzeServiceWorker(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sw: any = {
      supported: 'serviceWorker' in navigator,
      controlled: !!navigator.serviceWorker?.controller,
      registrations: []
    };

    if (sw.supported) {
      try {
        // 全てのregistrationを取得
        const registrations = await navigator.serviceWorker.getRegistrations();
        sw.registrations = registrations.map(reg => ({
          scope: reg.scope,
          active: !!reg.active,
          installing: !!reg.installing,
          waiting: !!reg.waiting,
          updatefound: false // イベントベースなので現在の状態では取得不可
        }));

        if (navigator.serviceWorker.controller) {
          sw.activeWorkerState = navigator.serviceWorker.controller.state;
        }
      } catch (error) {
        console.error('Service Worker analysis failed:', error);
      }
    }

    this.results.serviceWorker = sw;
  }

  private async analyzeBrowser(): Promise<void> {
    const ua = navigator.userAgent;
    
    this.results.browser = {
      name: this.getBrowserName(ua),
      version: this.getBrowserVersion(ua),
      mobile: /Mobi|Android/i.test(ua),
      ios: /iPhone|iPad|iPod/i.test(ua),
      android: /Android/i.test(ua),
      safari: /Safari/i.test(ua) && !/Chrome/i.test(ua),
      chrome: /Chrome/i.test(ua) && !/Edge/i.test(ua),
      firefox: /Firefox/i.test(ua),
      edge: /Edge/i.test(ua)
    };
  }

  private getBrowserName(ua: string): string {
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Edge/i.test(ua)) return 'Edge';
    return 'Unknown';
  }

  private getBrowserVersion(ua: string): string {
    const matches = ua.match(/(Firefox|Chrome|Safari|Edge)\/(\d+\.\d+)/i);
    return matches ? matches[2] : 'Unknown';
  }

  private async analyzeDocumentState(): Promise<void> {
    this.results.document = {
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
      hidden: document.hidden
    };
  }

  private async analyzePWA(): Promise<void> {
    this.results.pwa = {
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      isInstalled: window.matchMedia('(display-mode: standalone)').matches || 
                   ('standalone' in window.navigator && (window.navigator as any).standalone === true),
      canInstall: false // beforeinstallpromptイベントベースなので静的には判定困難
    };
  }

  private async runNotificationTests(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tests: any = {
      basicNotificationTest: await this.testBasicNotification(),
      serviceWorkerNotificationTest: await this.testServiceWorkerNotification(),
      backgroundNotificationTest: await this.testBackgroundNotification()
    };

    this.results.tests = tests;
  }

  private async testBasicNotification(): Promise<NotificationTestResult> {
    const result: NotificationTestResult = { attempted: false, successful: false };
    
    if (Notification.permission !== 'granted') {
      result.error = 'Permission not granted';
      return result;
    }

    try {
      result.attempted = true;
      const startTime = Date.now();
      
      const notification = new Notification('Deep Diagnostic Test', {
        body: 'Testing basic browser notification',
        tag: 'deep-diagnostic-basic',
        silent: true // テスト中は音を出さない
      });

      // 通知の表示確認
      const showPromise = new Promise<boolean>((resolve) => {
        notification.onshow = () => resolve(true);
        notification.onerror = () => resolve(false);
        // 3秒でタイムアウト
        setTimeout(() => resolve(false), 3000);
      });

      result.successful = await showPromise;
      result.duration = Date.now() - startTime;
      
      // クリーンアップ
      setTimeout(() => notification.close(), 1000);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  private async testServiceWorkerNotification(): Promise<NotificationTestResult> {
    const result: NotificationTestResult = { attempted: false, successful: false };
    
    if (Notification.permission !== 'granted') {
      result.error = 'Permission not granted';
      return result;
    }

    try {
      result.attempted = true;
      const startTime = Date.now();
      
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration) {
        result.error = 'No service worker registration';
        return result;
      }

      await registration.showNotification('Deep Diagnostic SW Test', {
        body: 'Testing service worker notification',
        tag: 'deep-diagnostic-sw',
        silent: true
      });

      result.successful = true;
      result.duration = Date.now() - startTime;
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  private async testBackgroundNotification(): Promise<NotificationTestResult> {
    const result: NotificationTestResult = { attempted: false, successful: false };
    
    // ドキュメントをバックグラウンドにして通知テスト
    try {
      result.attempted = true;
      const startTime = Date.now();
      
      // ページを隠す（実際にはできないが、通知の動作をテスト）
      const beforeVisibility = document.visibilityState;
      
      if (Notification.permission === 'granted') {
        const notification = new Notification('Background Test', {
          body: 'Testing background notification behavior',
          tag: 'deep-diagnostic-bg',
          silent: true,
          requireInteraction: false
        });

        result.successful = true;
        result.details = { beforeVisibility };
        
        setTimeout(() => notification.close(), 1000);
      }
      
      result.duration = Date.now() - startTime;
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }
}

// Export singleton instance
export const notificationDiagnostics = new NotificationDeepDiagnostics();