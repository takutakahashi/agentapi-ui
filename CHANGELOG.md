# Changelog

## [v1.19.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.67.0...v1.19.0) - 2025-12-29

## [v1.67.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.66.0...v1.67.0) - 2025-12-28
- feat: tagprを設定 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/331
- feat: Marketplace設定機能を追加（Experimental） by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/333

## [v1.66.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.64.0...v1.66.0) - 2025-12-28
- feat: MCP Server設定機能を追加 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/330

## [v1.65.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.63.0...v1.65.0) - 2025-12-27
- refactor: Dockerイメージを一つに統一 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/327
- fix: 作成中セッションの表示をエラーではなく進行中として改善 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/328
- feat: 起動中のセッションがある場合にリスト更新間隔を5秒に短縮 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/329

## [v1.64.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.63.0...v1.64.0) - 2025-12-27
- refactor: Dockerイメージを一つに統一 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/327
- fix: 作成中セッションの表示をエラーではなく進行中として改善 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/328
- feat: 起動中のセッションがある場合にリスト更新間隔を5秒に短縮 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/329

## [v1.63.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.62.0...v1.63.0) - 2025-12-27
- feat: 作成中セッションの表示を目立つUIに改善 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/326

## [v1.62.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.61.0...v1.62.0) - 2025-12-27
- fix: helm-dev-build のイメージタグを docker-dev.yaml と統一 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/324
- feat: params.message を使用した初期メッセージ送信に変更 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/325

## [v1.61.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.60.0...v1.61.0) - 2025-12-26
- feat: スケジュール実行機能を追加 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/320
- feat: Helm chart 含む devbuild サポートを追加 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/321
- fix: helm-dev-build を workflow_dispatch のみに変更 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/322
- feat: 設定画面に実験的機能トグルを追加 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/323

## [v1.60.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.59.0...v1.60.0) - 2025-12-25
- feat: 設定ページにナビゲーションとログアウト機能を追加 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/319

## [v1.59.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.58.0...v1.59.0) - 2025-12-24
- feat: セッション開始時の GitHub トークン送信を設定可能に by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/318

## [v1.58.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.57.0...v1.58.0) - 2025-12-24
- feat: セッション開始時に params.github_token を自動注入 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/317

## [v1.57.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.56.0...v1.57.0) - 2025-12-23
- feat: Bedrock 設定に Claude Sonnet 4 推奨モデルボタンを追加 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/316

## [v1.56.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.55.0...v1.56.0) - 2025-12-23
- fix: Bedrock 設定から profile と role_arn を削除 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/315

## [v1.55.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.54.0...v1.55.0) - 2025-12-23
- feat: 設定画面を全ユーザーに公開し、Runbook設定をデバッグモード制限 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/314

## [v1.54.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.53.0...v1.54.0) - 2025-12-23
- fix: Bedrock 設定から region 項目を削除 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/313

## [v1.53.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.52.0...v1.53.0) - 2025-12-23
- fix: 設定画面の入力値処理を改善 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/312

## [v1.52.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.51.0...v1.52.0) - 2025-12-23
- feat: セッション作成時にプログレスバー付き進捗モーダルを表示 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/311

## [v1.51.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.50.0...v1.51.0) - 2025-12-23
- fix: Settings API のチーム名に含まれる / を - に置換 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/310

## [v1.50.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.49.0...v1.50.0) - 2025-12-22
- fix: 設定画面のユーザー情報取得を agentapi-proxy クライアント経由に修正 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/309

## [v1.49.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.48.0...v1.49.0) - 2025-12-22
- feat: agentapi-proxy /user/info API との連携でユーザー名を取得 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/308

## [v1.48.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.47.0...v1.48.0) - 2025-12-22
- feat: 設定画面にプッシュ通知設定を統合 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/306
- fix: リポジトリ履歴の文字列省略を削除 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/307

## [v1.47.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.46.0...v1.47.0) - 2025-12-22
- feat: Settings API に準拠した設定画面の実装 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/305
