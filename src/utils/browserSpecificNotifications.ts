// ブラウザ・OS固有の通知制限と対応策
export interface BrowserNotificationLimitations {
  browser: string;
  version?: string;
  os: string;
  limitations: string[];
  workarounds: string[];
  testStrategy: () => Promise<boolean>;
}

export class BrowserSpecificNotificationHandler {
  private userAgent = navigator.userAgent;
  
  detectEnvironment() {
    return {
      browser: this.getBrowser(),
      os: this.getOS(),
      mobile: this.isMobile(),
      limitations: this.getCurrentLimitations()
    };
  }

  private getBrowser(): string {
    if (this.userAgent.includes('Firefox')) return 'Firefox';
    if (this.userAgent.includes('Chrome') && !this.userAgent.includes('Edge')) return 'Chrome';
    if (this.userAgent.includes('Safari') && !this.userAgent.includes('Chrome')) return 'Safari';
    if (this.userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getOS(): string {
    if (this.userAgent.includes('iPhone') || this.userAgent.includes('iPad')) return 'iOS';
    if (this.userAgent.includes('Android')) return 'Android';
    if (this.userAgent.includes('Windows')) return 'Windows';
    if (this.userAgent.includes('Mac')) return 'macOS';
    if (this.userAgent.includes('Linux')) return 'Linux';
    return 'Unknown';
  }

  private isMobile(): boolean {
    return /Mobi|Android|iPhone|iPad/i.test(this.userAgent);
  }

  private getCurrentLimitations(): BrowserNotificationLimitations {
    const browser = this.getBrowser();
    const os = this.getOS();

    // Safari iOS の制限
    if (browser === 'Safari' && os === 'iOS') {
      return {
        browser,
        os,
        limitations: [
          'PWA としてホーム画面に追加されている必要がある',
          'iOS 16.4 以降でのみサポート',
          'バックグラウンドでの通知は制限される',
          'フォーカス状態による表示制限',
          'バッテリー節約モードでは無効化される可能性'
        ],
        workarounds: [
          'PWA インストールプロンプトの表示',
          'ユーザーにホーム画面追加を促す',
          'フォアグラウンド通知のフォールバック',
          'バッテリー状態の確認と警告'
        ],
        testStrategy: this.testIOSSafari.bind(this)
      };
    }

    // Chrome Android の制限
    if (browser === 'Chrome' && os === 'Android') {
      return {
        browser,
        os,
        limitations: [
          'アプリレベルの通知設定による制御',
          'バッテリー最適化による制限',
          'サイト設定での通知ブロック',
          'Do Not Disturb モード',
          'バックグラウンドアプリ制限'
        ],
        workarounds: [
          'アプリ設定へのガイダンス',
          'バッテリー最適化の除外設定',
          'フォアグラウンド通知の併用',
          'ユーザー教育コンテンツ'
        ],
        testStrategy: this.testChromeAndroid.bind(this)
      };
    }

    // Desktop Chrome の制限
    if (browser === 'Chrome' && ['Windows', 'macOS', 'Linux'].includes(os)) {
      return {
        browser,
        os,
        limitations: [
          'サイト設定での通知ブロック',
          'OS レベルの通知設定',
          'フォーカス状態での表示制御',
          'Do Not Disturb / Focus モード',
          'マルチモニター環境での表示位置'
        ],
        workarounds: [
          'サイト設定確認の促し',
          'OS 通知設定の確認',
          'アクティブタブ検出',
          'ユーザー操作に基づく通知'
        ],
        testStrategy: this.testDesktopChrome.bind(this)
      };
    }

    // Firefox の制限
    if (browser === 'Firefox') {
      return {
        browser,
        os,
        limitations: [
          'サイトごとの通知設定',
          'プライベートブラウジングでの制限',
          '拡張機能による干渉',
          'セキュリティ設定による制限'
        ],
        workarounds: [
          'サイト情報パネルでの設定確認',
          '通常ブラウジングモードでのテスト',
          '拡張機能の一時無効化',
          'セキュリティ例外の設定'
        ],
        testStrategy: this.testFirefox.bind(this)
      };
    }

    // Safari macOS の制限
    if (browser === 'Safari' && os === 'macOS') {
      return {
        browser,
        os,
        limitations: [
          'macOS 通知センターとの連携',
          'Focus モードでの制限',
          'サイト設定での細かい制御',
          'ITP による制限'
        ],
        workarounds: [
          'システム環境設定の確認',
          'Focus モード設定の調整',
          'サイト設定の最適化',
          'ユーザー操作に基づく通知'
        ],
        testStrategy: this.testSafariMacOS.bind(this)
      };
    }

    // デフォルト（一般的な制限）
    return {
      browser,
      os,
      limitations: [
        '通知許可が必要',
        'セキュアコンテキスト（HTTPS）が必要',
        'ユーザー操作に基づく許可要求'
      ],
      workarounds: [
        '適切な許可要求フロー',
        'HTTPS の確保',
        'ユーザーフレンドリーな UI'
      ],
      testStrategy: this.testGeneric.bind(this)
    };
  }

  // iOS Safari 専用テスト
  private async testIOSSafari(): Promise<boolean> {
    console.log('🍎 Testing iOS Safari notifications...');
    
    // PWA モード確認
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  ('standalone' in window.navigator && (window.navigator as any).standalone === true);
    
    console.log('PWA mode:', isPWA);
    
    if (!isPWA) {
      console.warn('❌ iOS Safari requires PWA installation for notifications');
      return false;
    }

    // iOS バージョン確認
    const iosVersionMatch = this.userAgent.match(/OS (\d+)_/);
    const iosVersion = iosVersionMatch ? parseInt(iosVersionMatch[1]) : 0;
    
    console.log('iOS version:', iosVersion);
    
    if (iosVersion < 16) {
      console.warn('❌ iOS notifications require iOS 16.4+');
      return false;
    }

    return await this.testBasicNotificationWithTimeout();
  }

  // Chrome Android 専用テスト
  private async testChromeAndroid(): Promise<boolean> {
    console.log('🤖 Testing Chrome Android notifications...');
    
    // Android 通知チャンネルの確認（間接的）
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Android Test', {
        body: 'Testing Android-specific notification',
        icon: '/icon-192x192.png',
        tag: 'android-test',
        silent: true
      });
      
      // 通知の表示確認（Android では即座に表示される）
      const notifications = await registration.getNotifications();
      const success = notifications.some(n => n.tag === 'android-test');
      
      // クリーンアップ
      notifications.forEach(n => n.close());
      
      return success;
    } catch (error) {
      console.error('Chrome Android test failed:', error);
      return false;
    }
  }

  // Desktop Chrome 専用テスト
  private async testDesktopChrome(): Promise<boolean> {
    console.log('💻 Testing Desktop Chrome notifications...');
    
    // フォーカス状態での通知テスト
    const hadFocus = document.hasFocus();
    
    try {
      const notification = new Notification('Desktop Chrome Test', {
        body: 'Testing desktop notification behavior',
        icon: '/icon-192x192.png',
        tag: 'desktop-test',
        requireInteraction: false
      });

      const result = await new Promise<boolean>((resolve) => {
        notification.onshow = () => {
          console.log('✅ Desktop notification shown');
          resolve(true);
        };
        notification.onerror = (error) => {
          console.error('❌ Desktop notification error:', error);
          resolve(false);
        };
        setTimeout(() => {
          console.warn('⏰ Desktop notification timeout');
          resolve(false);
        }, 3000);
      });

      setTimeout(() => notification.close(), 1000);
      
      console.log('Focus state during test:', hadFocus);
      return result;
      
    } catch (error) {
      console.error('Desktop Chrome test failed:', error);
      return false;
    }
  }

  // Firefox 専用テスト
  private async testFirefox(): Promise<boolean> {
    console.log('🦊 Testing Firefox notifications...');
    
    // Firefox 特有の設定確認
    const permissions = await navigator.permissions.query({ name: 'notifications' as PermissionName });
    console.log('Firefox permissions state:', permissions.state);
    
    return await this.testBasicNotificationWithTimeout();
  }

  // Safari macOS 専用テスト
  private async testSafariMacOS(): Promise<boolean> {
    console.log('🍎💻 Testing Safari macOS notifications...');
    
    // macOS 通知センター連携テスト
    try {
      const notification = new Notification('Safari macOS Test', {
        body: 'Testing macOS notification center integration',
        icon: '/icon-192x192.png',
        tag: 'safari-macos-test'
      });

      const result = await new Promise<boolean>((resolve) => {
        notification.onshow = () => resolve(true);
        notification.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000); // Safari は表示が遅い場合がある
      });

      setTimeout(() => notification.close(), 1000);
      return result;
      
    } catch (error) {
      console.error('Safari macOS test failed:', error);
      return false;
    }
  }

  // 汎用テスト
  private async testGeneric(): Promise<boolean> {
    console.log('🌐 Testing generic browser notifications...');
    return await this.testBasicNotificationWithTimeout();
  }

  private async testBasicNotificationWithTimeout(): Promise<boolean> {
    if (Notification.permission !== 'granted') {
      console.warn('❌ Notification permission not granted');
      return false;
    }

    try {
      const notification = new Notification('Generic Test', {
        body: 'Testing basic notification',
        icon: '/icon-192x192.png',
        tag: 'generic-test',
        silent: true
      });

      const result = await new Promise<boolean>((resolve) => {
        notification.onshow = () => resolve(true);
        notification.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 3000);
      });

      setTimeout(() => notification.close(), 1000);
      return result;
      
    } catch (error) {
      console.error('Generic test failed:', error);
      return false;
    }
  }

  // 包括的なテスト実行
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async runEnvironmentSpecificTest(): Promise<{
    environment: any;
    limitations: BrowserNotificationLimitations;
    testResult: boolean;
    recommendations: string[];
  }> {
    const environment = this.detectEnvironment();
    const limitations = this.getCurrentLimitations();
    const testResult = await limitations.testStrategy();
    
    const recommendations = this.generateRecommendations(limitations, testResult);
    
    return {
      environment,
      limitations,
      testResult,
      recommendations
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private generateRecommendations(limitations: BrowserNotificationLimitations, testResult: boolean): string[] {
    const recommendations: string[] = [];
    
    if (!testResult) {
      recommendations.push('⚠️ 通知テストが失敗しました');
      recommendations.push(...limitations.workarounds);
      
      // 環境固有の追加推奨事項
      if (limitations.browser === 'Safari' && limitations.os === 'iOS') {
        recommendations.push('🔧 Safari > 設定 > ウェブサイト > 通知 でサイトの許可を確認');
        recommendations.push('📱 ホーム画面に追加されているか確認');
        recommendations.push('🔋 低電力モードが無効になっているか確認');
      }
      
      if (limitations.browser === 'Chrome' && limitations.os === 'Android') {
        recommendations.push('🔧 Android 設定 > アプリ > Chrome > 通知 を確認');
        recommendations.push('🔋 バッテリー最適化の除外設定を確認');
        recommendations.push('🔕 サイレントモード・おやすみモードの設定を確認');
      }
      
      if (['Windows', 'macOS'].includes(limitations.os)) {
        recommendations.push('🔧 OS のシステム通知設定を確認');
        recommendations.push('🎯 集中モード・Do Not Disturb の設定を確認');
        recommendations.push('🌐 ブラウザのサイト設定で通知が許可されているか確認');
      }
    } else {
      recommendations.push('✅ 通知テストが成功しました');
      recommendations.push('🎉 この環境では通知が正常に動作します');
    }
    
    return recommendations;
  }
}

export const browserNotificationHandler = new BrowserSpecificNotificationHandler();