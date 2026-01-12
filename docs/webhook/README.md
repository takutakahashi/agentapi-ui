# Webhook ガイド

agentapi-proxy を使った Webhook の完全ガイドへようこそ。

## このガイドについて

このドキュメントでは、agentapi-proxy の Webhook 機能を最大限に活用するための情報を提供します。GitHub Webhook からカスタム Webhook まで、様々なユースケースに対応した設定方法を学べます。

## 主な内容

- **はじめに**: Webhook の基本概念と agentapi-proxy での役割
- **セットアップ**: Webhook の作成と設定方法
- **GitHub Webhook**: GitHub イベントとの連携
- **Custom Webhook**: JSONPath を使ったカスタム条件設定
- **サービス連携例**: Slack、Datadog、PagerDuty などとの統合
- **高度な設定**: テンプレートやセッション設定
- **トラブルシューティング**: よくある問題と解決方法

## 対象読者

- agentapi-proxy を使い始める方
- Webhook 機能を使って外部サービスと連携したい方
- 既存の設定を最適化したい方

## 前提知識

このガイドを読むにあたって、以下の知識があると理解がスムーズです：

- 基本的な HTTP の知識
- JSON の読み書き
- GitHub の基本的な使い方（GitHub Webhook を使う場合）

## サポート

質問や問題がある場合は、以下をご利用ください：

- [GitHub Issues](https://github.com/takutakahashi/agentapi-ui/issues)
- [agentapi-proxy リポジトリ](https://github.com/takutakahashi/agentapi-proxy)

それでは、始めましょう！
