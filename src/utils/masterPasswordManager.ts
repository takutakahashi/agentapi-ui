/**
 * マスターパスワードの管理
 * セッション内でのパスワード保持とセキュアなメモリ管理
 */

import { CryptoStorage } from './cryptoStorage';

interface MasterPasswordState {
  isSet: boolean;
  isUnlocked: boolean;
  password?: string;
  unlockTime?: number;
}

export class MasterPasswordManager {
  private static state: MasterPasswordState = {
    isSet: false,
    isUnlocked: false,
  };

  private static readonly LOCK_TIMEOUT = 30 * 60 * 1000; // 30分でタイムアウト
  private static lockTimer?: NodeJS.Timeout;

  /**
   * マスターパスワードが設定されているかチェック
   */
  static async isMasterPasswordSet(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const hasPassword = localStorage.getItem('agentapi-master-password-set');
      const encryptionEnabled = await CryptoStorage.isEncryptionEnabled();
      return hasPassword === 'true' && encryptionEnabled;
    } catch {
      return false;
    }
  }

  /**
   * マスターパスワードを設定
   */
  static async setMasterPassword(password: string): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Window is not available');
    }

    // パスワード強度チェック
    const validation = CryptoStorage.validatePasswordStrength(password);
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    // 暗号化を有効にし、パスワードをセッションに保存
    await CryptoStorage.enableEncryption();
    localStorage.setItem('agentapi-master-password-set', 'true');
    
    this.state = {
      isSet: true,
      isUnlocked: true,
      password,
      unlockTime: Date.now(),
    };

    this.resetLockTimer();
  }

  /**
   * マスターパスワードでアンロック
   */
  static async unlockWithPassword(password: string): Promise<boolean> {
    if (!await this.isMasterPasswordSet()) {
      throw new Error('Master password is not set');
    }

    try {
      // テスト用の暗号化データを作成して復号化を試行
      const testData = 'test-unlock-data';
      const encrypted = await CryptoStorage.encrypt(testData, password);
      const decrypted = await CryptoStorage.decrypt(encrypted, password);
      
      if (decrypted === testData) {
        this.state = {
          isSet: true,
          isUnlocked: true,
          password,
          unlockTime: Date.now(),
        };
        
        this.resetLockTimer();
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * セッションをロック
   */
  static lock(): void {
    if (this.state.password) {
      // メモリクリア（完全ではないが最善の努力）
      this.state.password = undefined;
    }
    
    this.state.isUnlocked = false;
    this.state.unlockTime = undefined;
    
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = undefined;
    }
  }

  /**
   * アンロック状態かチェック
   */
  static isUnlocked(): boolean {
    if (!this.state.isUnlocked || !this.state.password) {
      return false;
    }

    // タイムアウトチェック
    if (this.state.unlockTime && 
        Date.now() - this.state.unlockTime > this.LOCK_TIMEOUT) {
      this.lock();
      return false;
    }

    return true;
  }

  /**
   * 現在のマスターパスワードを取得
   */
  static getCurrentPassword(): string | null {
    if (!this.isUnlocked()) {
      return null;
    }
    
    return this.state.password || null;
  }

  /**
   * マスターパスワードを削除（暗号化無効化）
   */
  static async removeMasterPassword(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    await CryptoStorage.disableEncryption();
    localStorage.removeItem('agentapi-master-password-set');
    
    this.lock();
    this.state.isSet = false;
  }

  /**
   * セッション延長（アクティビティ検出時に呼び出し）
   */
  static extendSession(): void {
    if (this.state.isUnlocked) {
      this.state.unlockTime = Date.now();
      this.resetLockTimer();
    }
  }

  /**
   * 自動ロックタイマーをリセット
   */
  private static resetLockTimer(): void {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
    }

    this.lockTimer = setTimeout(() => {
      this.lock();
    }, this.LOCK_TIMEOUT);
  }

  /**
   * ブラウザの可視性変更時の処理
   */
  static handleVisibilityChange(): void {
    if (typeof document === 'undefined') {
      return;
    }

    if (document.hidden) {
      // ブラウザが非表示になった時は即座にロック
      this.lock();
    }
  }

  /**
   * 初期化処理
   */
  static async initialize(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    // 状態を復元
    this.state.isSet = await this.isMasterPasswordSet();
    this.state.isUnlocked = false;

    // 可視性変更イベントの監視
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.handleVisibilityChange();
      });
    }

    // アクティビティ監視（マウス、キーボード）
    const extendSessionThrottled = this.throttle(() => {
      this.extendSession();
    }, 60000); // 1分に1回まで

    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(eventType => {
      document.addEventListener(eventType, extendSessionThrottled, { passive: true });
    });
  }

  /**
   * スロットル関数
   */
  private static throttle<T extends (...args: never[]) => unknown>(
    func: T,
    wait: number
  ): T {
    let timeout: NodeJS.Timeout | null = null;
    let previous = 0;

    return ((...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = wait - (now - previous);

      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        func(...args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          previous = Date.now();
          timeout = null;
          func(...args);
        }, remaining);
      }
    }) as T;
  }

  /**
   * 状態をデバッグ用に取得
   */
  static getState(): Omit<MasterPasswordState, 'password'> {
    return {
      isSet: this.state.isSet,
      isUnlocked: this.state.isUnlocked,
      unlockTime: this.state.unlockTime,
    };
  }
}