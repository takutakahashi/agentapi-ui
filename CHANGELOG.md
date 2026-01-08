# Changelog

## [v1.19.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.72.0...v1.19.0) - 2026-01-08

## [v1.72.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.71.0...v1.72.0) - 2026-01-06
- feat: Bedrock のデフォルトモデルを変更 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/351

## [v1.71.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.70.0...v1.71.0) - 2026-01-04
- feat: チームスコープ機能を追加 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/349

## [v1.70.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.69.0...v1.70.0) - 2026-01-02
- feat: 共有セッション閲覧機能を追加 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/340
- refactor: セッションタイプ選択UIを削除しリポジトリ有無で判断する方式に変更 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/344
- feat: OAuth トークンをセッショントークンとして使用する設定をデフォルト有効に変更 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/347

## [v1.69.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.68.0...v1.69.0) - 2025-12-29
- feat: MarketplaceのキーをURLからリポジトリ名を自動抽出する方式に変更 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/336
- feat: Official Plugins設定機能を追加（Experimental） by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/338
- refactor: Marketplace設定とPlugin設定を分離 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/339

## [v1.68.0](https://github.com/takutakahashi/agentapi-ui/compare/v1.67.0...v1.68.0) - 2025-12-29
- fix: マーケットプレイスが空になった場合に空オブジェクトを送信するように修正 by @takutakahashi in https://github.com/takutakahashi/agentapi-ui/pull/334

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
