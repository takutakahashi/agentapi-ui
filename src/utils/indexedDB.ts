/**
 * IndexedDB ラッパークラス
 * 暗号化されたプロファイルデータの安全な保存を提供
 */
export class IndexedDBWrapper {
  private static readonly DB_NAME = 'agentapi-secure-profiles';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'profiles';
  private static readonly METADATA_STORE = 'metadata';
  private static db: IDBDatabase | null = null;

  /**
   * データベースを初期化
   */
  static async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not supported in this environment');
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        reject(new Error('IndexedDB の初期化に失敗しました'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // プロファイル用オブジェクトストア
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('isDefault', 'isDefault', { unique: false });
          store.createIndex('lastUsed', 'lastUsed', { unique: false });
        }

        // メタデータ用オブジェクトストア
        if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
          db.createObjectStore(this.METADATA_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * データベース接続を取得
   */
  private static async getDatabase(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('データベースの初期化に失敗しました');
    }
    return this.db;
  }

  /**
   * プロファイルを保存
   */
  static async saveProfile(id: string, encryptedData: string, metadata: Record<string, unknown>): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);

    const profileData = {
      id,
      encryptedData,
      ...metadata,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(profileData);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('プロファイルの保存に失敗しました'));
    });
  }

  /**
   * プロファイルを取得
   */
  static async getProfile(id: string): Promise<{ encryptedData: string; metadata: Record<string, unknown> } | null> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.STORE_NAME], 'readonly');
    const store = transaction.objectStore(this.STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const { encryptedData, ...metadata } = result;
          resolve({ encryptedData, metadata });
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(new Error('プロファイルの取得に失敗しました'));
    });
  }

  /**
   * プロファイル一覧を取得
   */
  static async getProfiles(): Promise<Record<string, unknown>[]> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.STORE_NAME], 'readonly');
    const store = transaction.objectStore(this.STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const profiles = request.result.map((profile: Record<string, unknown>) => {
          const { encryptedData: _, ...metadata } = profile;
          return metadata;
        });
        resolve(profiles);
      };
      
      request.onerror = () => reject(new Error('プロファイル一覧の取得に失敗しました'));
    });
  }

  /**
   * プロファイルを削除
   */
  static async deleteProfile(id: string): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('プロファイルの削除に失敗しました'));
    });
  }

  /**
   * デフォルトプロファイルIDを保存
   */
  static async setDefaultProfileId(profileId: string): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(this.METADATA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.put({ key: 'defaultProfileId', value: profileId });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('デフォルトプロファイルIDの保存に失敗しました'));
    });
  }

  /**
   * デフォルトプロファイルIDを取得
   */
  static async getDefaultProfileId(): Promise<string | null> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.METADATA_STORE], 'readonly');
    const store = transaction.objectStore(this.METADATA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get('defaultProfileId');
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      
      request.onerror = () => reject(new Error('デフォルトプロファイルIDの取得に失敗しました'));
    });
  }

  /**
   * 全てのプロファイルを削除
   */
  static async clearAllProfiles(): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.STORE_NAME, this.METADATA_STORE], 'readwrite');
    
    const profilesStore = transaction.objectStore(this.STORE_NAME);
    const metadataStore = transaction.objectStore(this.METADATA_STORE);

    return new Promise((resolve, reject) => {
      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 2) resolve();
      };

      const clearProfiles = profilesStore.clear();
      const clearMetadata = metadataStore.clear();
      
      clearProfiles.onsuccess = checkComplete;
      clearMetadata.onsuccess = checkComplete;
      
      clearProfiles.onerror = () => reject(new Error('プロファイルの削除に失敗しました'));
      clearMetadata.onerror = () => reject(new Error('メタデータの削除に失敗しました'));
    });
  }

  /**
   * データベースを閉じる
   */
  static close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * データベースを削除
   */
  static async deleteDatabase(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not supported in this environment');
    }

    this.close();

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(this.DB_NAME);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('データベースの削除に失敗しました'));
    });
  }

  /**
   * ストレージ使用量を取得
   */
  static async getStorageUsage(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { used: 0, quota: 0 };
  }
}