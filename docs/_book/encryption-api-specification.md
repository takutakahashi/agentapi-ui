# Encryption API Specification

このドキュメントは、agentapi-ui の暗号化APIエンドポイントの仕様と使用方法について説明します。

## 概要

agentapi-ui では、シングルプロファイルモードで設定情報を安全に保存するために、暗号化APIを提供しています。
これらのAPIは、APIトークンをキーとして使用し、AES-256-GCM暗号化を使用してデータを保護します。

## エンドポイント

### POST /api/encrypt

データを暗号化します。

#### リクエスト

```typescript
{
  data: string  // Base64エンコードされた平文データ
}
```

#### レスポンス

```typescript
{
  encrypted: string  // 暗号化されたデータ（文字列）
}
```

#### エラーレスポンス

```typescript
{
  error: string,
  code: "INVALID_DATA" | "UNAUTHORIZED" | "ENCRYPTION_FAILED"
}
```

### POST /api/decrypt

暗号化されたデータを復号化します。

#### リクエスト

```typescript
{
  data: string  // Base64エンコードされた暗号化データ
}
```

#### レスポンス

```typescript
{
  decrypted: string  // Base64エンコードされた復号化データ
}
```

#### エラーレスポンス

```typescript
{
  error: string,
  code: "INVALID_DATA" | "UNAUTHORIZED" | "DECRYPTION_FAILED"
}
```

## 実装の詳細

### 認証

両方のエンドポイントは、HTTPOnlyクッキー `agentapi_token` から APIトークンを取得します。
このトークンは、ログイン時に設定され、暗号化のキー導出に使用されます。

### 暗号化プロセス

1. APIトークンからハッシュを生成（SHA-256）
2. トークンハッシュを使用してデータを暗号化（AES-256-GCM）
3. 暗号化されたデータを文字列として返す

### データフォーマット

- すべてのデータは Base64 エンコードされている必要があります
- 暗号化されたデータは、IV、暗号文、認証タグを含む形式で保存されます

## 使用例

### TypeScript/JavaScript

```typescript
// 設定データを暗号化して保存
async function saveEncryptedSettings(settings: any) {
  // 設定をJSON文字列に変換
  const settingsJson = JSON.stringify(settings);
  
  // Base64エンコード
  const base64Data = Buffer.from(settingsJson).toString('base64');
  
  // 暗号化API呼び出し
  const response = await fetch('/api/encrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data })
  });
  
  if (!response.ok) {
    throw new Error('Encryption failed');
  }
  
  const { encrypted } = await response.json();
  
  // 暗号化されたデータをlocalStorageに保存
  localStorage.setItem('agentapi-encrypted-config', encrypted);
}

// 暗号化された設定を読み込む
async function loadEncryptedSettings(): Promise<any> {
  // localStorageから暗号化データを取得
  const encrypted = localStorage.getItem('agentapi-encrypted-config');
  if (!encrypted) {
    return null;
  }
  
  // 復号化API呼び出し
  const response = await fetch('/api/decrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: encrypted })
  });
  
  if (!response.ok) {
    throw new Error('Decryption failed');
  }
  
  const { decrypted } = await response.json();
  
  // Base64デコードしてJSONパース
  const settingsJson = Buffer.from(decrypted, 'base64').toString('utf8');
  return JSON.parse(settingsJson);
}
```

## 注意事項

### セキュリティ

1. **APIトークンの管理**: APIトークンは HTTPOnly クッキーに保存され、JavaScriptからは直接アクセスできません
2. **暗号化の強度**: AES-256-GCM を使用し、各暗号化操作で新しいIVを生成します
3. **トークンの有効期限**: クッキーは30日間有効です

### エラーハンドリング

- `INVALID_DATA`: リクエストデータが不正な形式（Base64でない、データフィールドがない等）
- `UNAUTHORIZED`: 有効なAPIトークンがない、またはトークンが無効
- `ENCRYPTION_FAILED` / `DECRYPTION_FAILED`: 暗号化・復号化処理中のエラー

### パフォーマンス

- 大量のデータを暗号化する場合は、分割して処理することを検討してください
- 暗号化されたデータは元のデータよりもサイズが大きくなります

## 関連ファイル

- `/src/app/api/encrypt/route.ts`: 暗号化エンドポイントの実装
- `/src/app/api/decrypt/route.ts`: 復号化エンドポイントの実装
- `/src/lib/encryption.ts`: 暗号化ロジックの実装
- `/src/lib/encryption-api.ts`: 暗号化APIヘルパー関数
- `/e2e/encryption-api.spec.ts`: E2Eテスト