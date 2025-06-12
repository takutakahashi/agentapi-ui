# agentapi-ui

このリポジトリは、[agentapi](https://github.com/coder/agentapi) のUIクライアントです。
[agentapi-proxy](https://github.com/takutakahashi/agentapi-proxy) を通じたセッション管理機能も提供します。

## 機能

- **Direct AgentAPI Connection**: AgentAPIに直接接続してチャット
- **Session Management**: agentapi-proxyを通じたセッション管理
- **Settings Management**: グローバル・リポジトリ別設定管理
- **Real-time Communication**: WebSocketによるリアルタイム通信

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 環境変数の設定:
```bash
cp .env.example .env.local
```

3. `.env.local`を編集:
```bash
# AgentAPI Configuration (Direct connection)
NEXT_PUBLIC_AGENTAPI_URL=http://localhost:8080/api/v1

# AgentAPI Proxy Configuration (Session management)
NEXT_PUBLIC_AGENTAPI_PROXY_URL=http://localhost:8080
```

4. 開発サーバーの起動:
```bash
npm run dev
```

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
