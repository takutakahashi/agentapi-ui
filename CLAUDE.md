# agentapi-ui

このリポジトリは、[agentapi](https://github.com/coder/agentapi) の UI リポジトリです。

## 前提条件

作業を開始する前に、以下の前提条件を必ず確認してください：

### API 仕様の参照

- **作業開始前に [agentapi の OpenAPI 仕様](https://github.com/coder/agentapi/blob/main/openapi.json) を必ず参照する**
  - API エンドポイント、リクエスト/レスポンス形式、認証方法などを確認
  - UI 実装時に正確な API 仕様に基づいて開発を行う

### 参考資料

- **必要に応じて [agentapi のコード](https://github.com/coder/agentapi) を参考にする**
  - バックエンドの実装詳細を理解する際に参照
  - API の動作を理解するためのリファレンスとして活用

### 開発ワークフロー

- **main ブランチに直接プッシュしない**
  - main ブランチへの直接的な変更は禁止
  - 必ずブランチを切って作業を行う

- **ブランチの命名規則**
  - ブランチ名は `claude/[session_id]` 形式とする
  - session_id は作業セッションごとに一意の識別子を使用

- **変更を行った際は忘れずにブランチにプッシュする**
  - コードの変更、新機能の追加、バグ修正などを行った場合は必ずコミットしてブランチにプッシュする
  - プルリクエストを作成して変更内容をレビューしてもらう
  - チーム内での作業状況を共有し、進捗を可視化する

- **PR (プルリクエスト) の作成**
  - 変更があった場合は、必ず PR を作成するところまでケアする
  - PR タイトルと説明には変更内容を明確に記載
  - レビュアーへの適切な情報提供を心がける

## プロジェクトの技術仕様と開発環境

### パッケージマネージャー

- **Bun を使用**
  - `bun.lockb` ファイルが存在
  - `npm install` ではなく `bun install` を使用
  - ビルドコマンド: `bun run build`
  - lint コマンド: `bun run lint`
  - TypeScript チェック: `npx tsc --noEmit`

### 開発環境セットアップ

- **mise を活用**
  - `.rtx.toml` ファイルで Node.js バージョン管理
  - `mise trust` で設定ファイルを信頼
  - `mise install` で依存関係をインストール
  - `mise exec -- <command>` でコマンド実行

### アーキテクチャの理解

#### セッション作成のフロー

1. **NewSessionModal** (`src/app/components/NewSessionModal.tsx`)
   - ユーザー向けの簡単なセッション作成UI
   - Profile 設定から環境変数とシステムプロンプトを自動取得
   - `createAgentAPIClient()` でクライアントを初期化
   - `client.start()` でセッション作成

2. **NewConversationModal** (`src/app/components/NewConversationModal.tsx`)
   - 詳細な設定が可能なセッション作成UI
   - 環境変数、メタデータを手動で設定可能
   - Profile の環境変数をフォームの初期値として使用

3. **AgentAPIProxyClient** (`src/lib/agentapi-proxy-client.ts`)
   - 実際のAPI通信を担当
   - Profile の環境変数を自動的にマージ
   - MCP サーバー設定も自動で含める

#### Profile 管理システム

- **ProfileManager** (`src/utils/profileManager.ts`)
  - ローカルストレージベースの Profile 管理
  - 環境変数、組織設定、MCP サーバー設定を含む
  - `getCurrentProfileId()`, `getProfile()`, `getDefaultProfile()` などのメソッド

- **Profile 型定義** (`src/types/profile.ts`)
  - `environmentVariables: EnvironmentVariable[]` フィールド
  - `agentApiProxy: AgentApiProxySettings` でAPI設定
  - `mcpServers: MCPServerConfig[]` でMCPサーバー設定

### デバッグとトラブルシューティング

#### ビルドエラーの対処

- **Node.js/Next.js が見つからない場合**
  ```bash
  mise trust
  mise install
  mise exec -- bun install
  mise exec -- bun run build
  ```

- **型エラーのチェック**
  ```bash
  mise exec -- npx tsc --noEmit
  ```

- **変数名の衝突に注意**
  - 同一スコープ内での `const`/`let` 変数の重複宣言を避ける
  - 特に Profile 取得時の変数名に注意（`profile`, `selectedProfile`, `currentProfile` など）

#### 環境変数のデバッグ

- **AgentAPIProxyClient のデバッグログ**
  - `debug: true` を設定すると詳細なログが出力
  - 環境変数のマージ状況をコンソールで確認可能

- **ブラウザの開発者ツール**
  - Network タブで `/start` リクエストのペイロードを確認
  - `environment` フィールドに期待する環境変数が含まれているかチェック

### コード変更時の注意点

#### セッション作成の修正

- **環境変数の優先順位**
  1. セッション固有の環境変数（最優先）
  2. Profile の環境変数
  3. デフォルト値（REPOSITORY など）

- **Profile データの取得**
  - `ProfileManager.getCurrentProfileId()` → `ProfileManager.getProfile()` → `ProfileManager.getDefaultProfile()` の順で取得
  - プロファイルが取得できない場合のフォールバック処理を忘れずに

- **型安全性の確保**
  - `envVar.key && envVar.value` でundefined/空文字チェック
  - Optional chaining (`profile?.environmentVariables`) の活用

## 既知の問題と修正履歴

### Profile 環境変数のセッション連携

**問題 (2025-07-02 修正済み)**
- Profile で設定した環境変数がセッション作成時のリクエストペイロードに含まれていなかった
- 環境変数は UI 上で設定・表示できるが、実際のセッションで利用できない状態だった

**修正内容**
- `NewSessionModal.tsx`: セッション作成時に Profile の環境変数を自動的に含める
- `NewConversationModal.tsx`: Profile の環境変数を環境変数フォームの初期値として使用  
- `agentapi-proxy-client.ts`: profileId が指定されている場合、Profile の環境変数を自動マージ
  - セッション固有の環境変数（REPOSITORY等）が Profile の環境変数より優先
  - デバッグログで環境変数マージ情報を出力

**関連PR**: [#185](https://github.com/takutakahashi/agentapi-ui/pull/185)

### テスト手順

Profile 環境変数機能をテストする際は以下を確認：

1. **Profile 設定の確認**
   - `/profiles/[id]/edit` でProfile の環境変数を設定
   - 環境変数が正しく保存されることを確認

2. **セッション作成での環境変数確認**  
   - New Session Modal でセッション作成
   - ブラウザの開発者ツールのネットワークタブで `/start` リクエストを確認
   - `environment` フィールドに Profile の環境変数が含まれていることを確認

3. **優先順位の確認**
   - Profile に `TEST_VAR=profile_value` を設定
   - セッション作成時に `TEST_VAR=session_value` を明示的に指定
   - セッション固有の値 (`session_value`) が優先されることを確認