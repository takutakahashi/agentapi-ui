# agentapi-ui

このリポジトリは、[agentapi](https://github.com/coder/agentapi) のUIクライアントです。
[agentapi-proxy](https://github.com/takutakahashi/agentapi-proxy) を通じたセッション管理機能も提供します。

## 機能

- **Direct AgentAPI Connection**: AgentAPIに直接接続してチャット
- **Session Management**: agentapi-proxyを通じたセッション管理
- **Settings Management**: グローバル・リポジトリ別設定管理
- **Real-time Communication**: WebSocketによるリアルタイム通信
- **Push Notifications**: PWAプッシュ通知機能

## セットアップ

1. 依存関係のインストール:
```bash
bun install
```

2. 環境変数の設定:
```bash
cp .env.local.example .env.local
```

3. `.env.local`を編集:
```bash
# Cookie encryption secret (generate with: openssl rand -hex 32)
COOKIE_ENCRYPTION_SECRET=your_64_character_hex_string_here

# AgentAPI Proxy Configuration
AGENTAPI_PROXY_URL=http://localhost:8080

# OAuth Only Mode (optional - hides API key login form)
NEXT_PUBLIC_OAUTH_ONLY_MODE=false

# Push Notification Configuration (オプション)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key_here
```

4. 開発サーバーの起動:
```bash
bun run dev
```

### 認証

ユーザーは `/login` ページで認証を行います：
- **APIキー認証**: APIキーを入力してログイン
- **GitHub OAuth認証**: GitHub経由でログイン（agentapi-proxyのOAuth設定が必要）

APIキーは暗号化されてセキュアなCookieに保存されます。

**OAuth専用モード**: `NEXT_PUBLIC_OAUTH_ONLY_MODE=true` を設定すると、APIキー入力フォームを非表示にしてGitHub OAuth認証のみを使用できます。

**重要**: 必ず `COOKIE_ENCRYPTION_SECRET` に安全な暗号化キーを設定してください。

## 設定方法

### AgentAPI Proxy

1. [agentapi-proxy](https://github.com/takutakahashi/agentapi-proxy) を起動
2. UIの設定画面 (`/settings`) でproxy設定を有効化
3. Proxy Endpoint を設定 (デフォルト: `http://localhost:8080`)

### Settings管理

- **Global Settings**: `/settings` - すべてのリポジトリのデフォルト設定
- **Repository Settings**: `/settings/[repo]` - 特定リポジトリの設定

設定は優先順位に従って適用されます：
1. Repository Settings (最優先)
2. Global Settings
3. Environment Variables

## 使用方法

### Conversationsページ (`/chats`)

- agentapi-proxyのセッション一覧を表示
- アクティブなセッションからチャット開始
- セッション詳細の確認

### AgentAPIページ (`/agentapi`)

- 直接AgentAPIとのチャット
- URLパラメータ`?session=<session_id>`でセッション指定可能

## プッシュ通知設定

プッシュ通知機能を有効にするには：

1. **VAPIDキーの生成**:
```bash
npx web-push generate-vapid-keys
```

2. **環境変数の設定**:
```bash
# .env.local に追加
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
```

3. **設定画面で有効化**:
- `/settings` ページのプッシュ通知セクションから設定
- 通知許可を取得してサブスクリプションを有効化
- テスト通知で動作確認

**セキュリティ**: プライベートキーは環境変数で管理し、公開しないでください。

**本番環境の注意点**: 
- サブスクリプションデータは現在メモリベースで保存されます（サーバー再起動で消失）
- 本番環境では外部データベース（PostgreSQL、Redis、Vercel KV等）の使用を推奨
