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
# Single Profile Mode Configuration
SINGLE_PROFILE_MODE=true
NEXT_PUBLIC_SINGLE_PROFILE_MODE=true

# Cookie encryption secret (generate with: openssl rand -hex 32)
COOKIE_ENCRYPTION_SECRET=your_64_character_hex_string_here

# AgentAPI Proxy Configuration
AGENTAPI_PROXY_URL=http://localhost:8080

# Push Notification Configuration (オプション)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here
VAPID_SUBJECT=mailto:admin@example.com
```

4. 開発サーバーの起動:
```bash
bun run dev
```

### シングルプロファイルモード

環境変数で `SINGLE_PROFILE_MODE=true` を設定すると：
- ユーザーは `/login` でAPIキーを使って認証する必要があります
- APIキーは暗号化されてセキュアなCookieに保存されます
- プロファイル切り替えUIは非表示になります
- ログアウト機能がトップバーに表示されます

**重要**: シングルプロファイルモードを使用する場合は、必ず `COOKIE_ENCRYPTION_SECRET` に安全な暗号化キーを設定してください。

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
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

3. **設定画面で有効化**:
- `/settings` ページのプッシュ通知セクションから設定
- 通知許可を取得してサブスクリプションを有効化
- テスト通知で動作確認

**セキュリティ**: プライベートキーは環境変数で管理し、公開しないでください。
