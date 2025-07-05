# 汎用暗号化・復号化API仕様書

## 概要

本仕様書は、agentapi-ui における汎用的な暗号化・復号化API機能の技術仕様を定義します。このAPIは任意のデータを安全に暗号化・復号化するための汎用的なインターフェースを提供します。

## 暗号化仕様

### 暗号化アルゴリズム

- **アルゴリズム**: AES-256-GCM
- **鍵長**: 256ビット
- **初期化ベクトル（IV）**: 96ビット（12バイト）
- **認証タグ**: 128ビット（16バイト）

### 暗号化プロセス

1. 入力データ（base64形式）を受け取る
2. トークンベースの検証を実行
3. AES-256-GCMで暗号化
4. 暗号化データ形式：
   ```
   {IV}{暗号化されたデータ}{認証タグ}
   ```
5. 全体をbase64エンコードして返却

### 復号化プロセス

1. 暗号化データ（base64形式）を受け取る
2. base64デコード
3. IV、暗号化データ、認証タグを分離
4. トークンベースの検証を実行
5. AES-256-GCMで復号化
6. 復号化されたデータをbase64エンコードして返却

## API仕様

### 暗号化エンドポイント

```
POST /api/encrypt
```

#### リクエスト

**Headers:**
```
Cookie: token={認証トークン}
Content-Type: application/json
```

**Body:**
```json
{
  "data": "base64エンコードされたデータ"
}
```

#### レスポンス

成功時（200 OK）:
```json
{
  "encrypted": "base64エンコードされた暗号化データ"
}
```

エラー時（400 Bad Request）:
```json
{
  "error": "エラーメッセージ",
  "code": "エラーコード"
}
```

エラー時（401 Unauthorized）:
```json
{
  "error": "Invalid or missing token",
  "code": "UNAUTHORIZED"
}
```

### 復号化エンドポイント

```
POST /api/decrypt
```

#### リクエスト

**Headers:**
```
Cookie: token={認証トークン}
Content-Type: application/json
```

**Body:**
```json
{
  "data": "base64エンコードされた暗号化データ"
}
```

#### レスポンス

成功時（200 OK）:
```json
{
  "decrypted": "base64エンコードされた復号化データ"
}
```

エラー時（400 Bad Request）:
```json
{
  "error": "エラーメッセージ",
  "code": "エラーコード"
}
```

エラー時（401 Unauthorized）:
```json
{
  "error": "Invalid or missing token",
  "code": "UNAUTHORIZED"
}
```

## トークン検証

### トークンの仕組み

1. **認証トークンの取得**
   - 認証ログイン（`/auth/login`）時にセットされる認証トークンを使用
   - トークンは認証成功時にCookieとして自動的にセットされる
   - Cookieキー名は認証システムで定義されたものを使用

2. **Cookie経由での受け渡し**
   - HTTPOnlyフラグを設定
   - Secureフラグを設定（HTTPS環境）
   - SameSite=Strictを設定

3. **検証プロセス**
   - Cookieから認証トークンを取得
   - トークンの有効性を確認
   - 有効期限のチェック
   - 権限の確認

## エラーコード一覧

| コード | 説明 |
|--------|------|
| `INVALID_DATA` | 無効なデータ形式 |
| `ENCRYPTION_FAILED` | 暗号化処理の失敗 |
| `DECRYPTION_FAILED` | 復号化処理の失敗 |
| `UNAUTHORIZED` | 認証エラー |
| `TOKEN_EXPIRED` | トークンの有効期限切れ |
| `INVALID_TOKEN` | 無効なトークン |
| `INTERNAL_ERROR` | 内部エラー |

## セキュリティ考慮事項

### 鍵管理

- 暗号化鍵は環境変数で管理
- 定期的な鍵のローテーション
- 鍵の安全な保管

### トークン管理

- トークンは平文で保存しない
- トークンの有効期限管理
- セッション固定攻撃への対策

### 通信セキュリティ

- HTTPS通信の必須化
- CSRFトークンの使用
- Content Security Policyの設定

### 監査ログ

- 暗号化・復号化操作のログ記録
- 失敗した認証試行の記録
- アクセスログの保存

## 実装上の注意点

### パフォーマンス

- 暗号化・復号化処理の非同期実行
- 適切なタイムアウト設定
- リクエストサイズの制限

### データ形式

- 入力データは必ずbase64形式
- UTF-8エンコーディングの統一
- URLセーフなbase64の使用

### エラーハンドリング

- セキュリティを考慮した汎用的なエラーメッセージ
- 詳細なエラー情報は内部ログのみ
- 適切なHTTPステータスコードの使用

## 使用例

### 暗号化の例

```javascript
// データを準備
const originalData = "Hello, World!";
const base64Data = btoa(originalData);

// 暗号化リクエスト
const response = await fetch('/api/encrypt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Cookieを含める
  body: JSON.stringify({
    data: base64Data
  })
});

const result = await response.json();
console.log(result.encrypted); // 暗号化されたデータ
```

### 復号化の例

```javascript
// 復号化リクエスト
const response = await fetch('/api/decrypt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Cookieを含める
  body: JSON.stringify({
    data: encryptedData
  })
});

const result = await response.json();
const decryptedData = atob(result.decrypted);
console.log(decryptedData); // "Hello, World!"
```

## 今後の拡張性

### 暗号化アルゴリズムの変更

- バージョン識別子の追加
- 後方互換性の維持
- 新しいアルゴリズムへの移行パス

### 機能拡張

- バッチ処理のサポート
- ストリーミング暗号化
- 圧縮機能の追加

### 認証方式の拡張

- OAuth2.0のサポート
- APIキー認証
- マルチファクタ認証