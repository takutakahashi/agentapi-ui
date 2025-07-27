// Client-side auth persistence for PWA
// This module handles storing and retrieving auth tokens in IndexedDB for PWA session persistence

const DB_NAME = 'agentapi-auth';
const DB_VERSION = 1;
const STORE_NAME = 'auth-tokens';
const TOKEN_KEY = 'api-key';

class AuthPersistence {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  async saveToken(token: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(token, TOKEN_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getToken(): Promise<string | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(TOKEN_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async clearToken(): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(TOKEN_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export const authPersistence = new AuthPersistence();