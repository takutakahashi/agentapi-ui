/**
 * Web Crypto API を使用した暗号化・復号化ユーティリティ
 */

// 暗号化設定
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // GCM推奨のIVサイズ
const SALT_LENGTH = 16;
const ITERATIONS = 100000; // PBKDF2のイテレーション回数

// マスターキーの生成または取得
async function getMasterKey(): Promise<CryptoKey> {
  // IndexedDBからマスターキーを取得
  const db = await openDB();
  const tx = db.transaction(['keys'], 'readonly');
  const store = tx.objectStore('keys');
  const request = store.get('master');
  
  const existingKey = await new Promise<{ keyData?: Uint8Array }>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (existingKey && existingKey.keyData) {
    // 既存のキーを復元
    return await crypto.subtle.importKey(
      'raw',
      existingKey.keyData,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // 新しいマスターキーを生成
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  // キーを保存
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const writeTx = db.transaction(['keys'], 'readwrite');
  const writeStore = writeTx.objectStore('keys');
  const putRequest = writeStore.put({ id: 'master', keyData: new Uint8Array(exportedKey) });
  
  await new Promise<void>((resolve, reject) => {
    putRequest.onsuccess = () => resolve();
    putRequest.onerror = () => reject(putRequest.error);
  });

  return key;
}

// パスワードベースの暗号化キーを生成
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// IndexedDBを開く
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('agentapi-encryption', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'id' });
      }
    };
  });
}

/**
 * データを暗号化
 */
export async function encrypt(data: string): Promise<{
  encrypted: string;
  iv: string;
  salt: string;
}> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // ランダムなIVとソルトを生成
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    
    // マスターキーを取得
    const masterKey = await getMasterKey();
    
    // 暗号化
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      masterKey,
      dataBuffer
    );
    
    // Base64エンコード
    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt))
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * データを復号化
 */
export async function decrypt(encryptedData: {
  encrypted: string;
  iv: string;
  salt: string;
}): Promise<string> {
  try {
    // Base64デコード
    const encryptedBuffer = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    
    // マスターキーを取得
    const masterKey = await getMasterKey();
    
    // 復号化
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      masterKey,
      encryptedBuffer
    );
    
    // テキストに変換
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * パスワードで保護された暗号化
 */
export async function encryptWithPassword(data: string, password: string): Promise<{
  encrypted: string;
  iv: string;
  salt: string;
}> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // ランダムなIVとソルトを生成
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    
    // パスワードからキーを導出
    const key = await deriveKeyFromPassword(password, salt);
    
    // 暗号化
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      dataBuffer
    );
    
    // Base64エンコード
    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt))
    };
  } catch (error) {
    console.error('Password encryption error:', error);
    throw new Error('Failed to encrypt data with password');
  }
}

/**
 * パスワードで保護された復号化
 */
export async function decryptWithPassword(
  encryptedData: {
    encrypted: string;
    iv: string;
    salt: string;
  },
  password: string
): Promise<string> {
  try {
    // Base64デコード
    const encryptedBuffer = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(encryptedData.salt), c => c.charCodeAt(0));
    
    // パスワードからキーを導出
    const key = await deriveKeyFromPassword(password, salt);
    
    // 復号化
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encryptedBuffer
    );
    
    // テキストに変換
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Password decryption error:', error);
    throw new Error('Failed to decrypt data with password');
  }
}

/**
 * 暗号化が必要なフィールドかどうかを判定
 */
export function shouldEncryptField(fieldPath: string): boolean {
  const encryptedFields = [
    'agentApiProxy.apiKey',
    'githubAuth.accessToken',
    'githubAuth.refreshToken',
    'environmentVariables.*.value',
    'mcpServers.*.env.*',
    'globalSettings.apiKey',
    'globalSettings.githubToken',
    'globalSettings.environmentVariables.*.value'
  ];

  return encryptedFields.some(pattern => {
    const regex = pattern.replace(/\*/g, '[^.]+').replace(/\./g, '\\.');
    return new RegExp(`^${regex}$`).test(fieldPath);
  });
}

/**
 * オブジェクト内の機密フィールドを暗号化
 */
export async function encryptSensitiveFields(obj: unknown, path: string = ''): Promise<unknown> {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item, index) => 
      encryptSensitiveFields(item, `${path}[${index}]`)
    ));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string' && shouldEncryptField(currentPath)) {
        // 機密フィールドを暗号化
        const encrypted = await encrypt(value);
        result[key] = {
          _encrypted: true,
          ...encrypted
        } as unknown;
      } else {
        result[key] = await encryptSensitiveFields(value, currentPath);
      }
    }
    return result;
  }

  return obj;
}

/**
 * オブジェクト内の暗号化されたフィールドを復号化
 */
export async function decryptSensitiveFields(obj: unknown): Promise<unknown> {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => decryptSensitiveFields(item)));
  }

  if (typeof obj === 'object') {
    const objRecord = obj as Record<string, unknown>;
    // 暗号化されたフィールドかチェック
    if (objRecord._encrypted === true && objRecord.encrypted && objRecord.iv && objRecord.salt) {
      try {
        return await decrypt({
          encrypted: objRecord.encrypted as string,
          iv: objRecord.iv as string,
          salt: objRecord.salt as string
        });
      } catch (error) {
        console.error('Failed to decrypt field:', error);
        return ''; // 復号化に失敗した場合は空文字を返す
      }
    }

    // 通常のオブジェクトの場合は再帰的に処理
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(objRecord)) {
      result[key] = await decryptSensitiveFields(value);
    }
    return result;
  }

  return obj;
}

/**
 * 暗号化キーのリセット（セキュリティ用）
 */
export async function resetEncryptionKey(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['keys'], 'readwrite');
  const store = tx.objectStore('keys');
  const clearRequest = store.clear();
  
  await new Promise<void>((resolve, reject) => {
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(clearRequest.error);
  });
}