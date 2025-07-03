/**
 * WebCrypto API を使用した暗号化ユーティリティクラス
 * XSS攻撃からの保護を目的とした暗号化処理を提供
 */
export class CryptoUtils {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 16;
  private static readonly ITERATIONS = 100000;

  /**
   * パスワードから暗号化キーを生成
   */
  static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * データを暗号化
   */
  static async encrypt(data: unknown, password: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(data));
      
      // ランダムなソルトとIVを生成
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      // パスワードから暗号化キーを生成
      const key = await this.deriveKey(password, salt);
      
      // データを暗号化
      const encrypted = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv: iv },
        key,
        dataBuffer
      );
      
      // ソルト + IV + 暗号化されたデータを結合
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);
      
      // Base64エンコード
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('暗号化エラー:', error);
      throw new Error('データの暗号化に失敗しました');
    }
  }

  /**
   * データを復号化
   */
  static async decrypt(encryptedData: string, password: string): Promise<unknown> {
    try {
      // Base64デコード
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      // ソルト、IV、暗号化されたデータを分離
      const salt = combined.slice(0, this.SALT_LENGTH);
      const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const encrypted = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);
      
      // パスワードから暗号化キーを生成
      const key = await this.deriveKey(password, salt);
      
      // データを復号化
      const decrypted = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: iv },
        key,
        encrypted
      );
      
      // JSONパース
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decrypted);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('復号化エラー:', error);
      throw new Error('データの復号化に失敗しました。パスワードが正しいか確認してください');
    }
  }

  /**
   * パスワードの強度をチェック
   */
  static validatePassword(password: string): { valid: boolean; message: string } {
    if (password.length < 8) {
      return { valid: false, message: 'パスワードは8文字以上で入力してください' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'パスワードに大文字を含めてください' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'パスワードに小文字を含めてください' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'パスワードに数字を含めてください' };
    }
    return { valid: true, message: 'パスワードは有効です' };
  }

  /**
   * ランダムなソルトを生成
   */
  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
  }

  /**
   * ランダムなIVを生成
   */
  static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
  }
}