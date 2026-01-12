# Summary

## はじめに

* [Webhook とは](introduction/README.md)
  * [概要と基本概念](introduction/overview.md)
  * [agentapi-proxy における Webhook](introduction/agentapi-proxy.md)

## セットアップ

* [Webhook の作成](setup/README.md)
  * [基本的な作成フロー](setup/basic-flow.md)
  * [設定項目の説明](setup/configuration.md)
  * [URL と Secret の管理](setup/url-secret.md)

## GitHub Webhook

* [GitHub との連携](github/README.md)
  * [クイックスタート](github/quickstart.md)
  * [イベントとトリガー](github/events-triggers.md)
  * [条件設定の詳細](github/conditions.md)
  * [実用例集](github/examples.md)

## Custom Webhook

* [カスタム Webhook](custom/README.md)
  * [概要と仕組み](custom/overview.md)
  * [JSONPath 条件の書き方](custom/jsonpath.md)
  * [演算子リファレンス](custom/operators.md)
  * [署名検証の設定](custom/signature.md)

## サービス連携例

* [外部サービスとの連携](integrations/README.md)
  * [Slack](integrations/slack.md)
  * [Datadog](integrations/datadog.md)
  * [PagerDuty](integrations/pagerduty.md)
  * [その他のサービス](integrations/others.md)

## 高度な設定

* [詳細設定](advanced/README.md)
  * [初期メッセージテンプレート](advanced/message-templates.md)
  * [セッション設定](advanced/session-config.md)
  * [優先度とマッチング](advanced/priority-matching.md)
  * [タグとフィルタリング](advanced/tags-filtering.md)

## トラブルシューティング

* [問題解決](troubleshooting/README.md)
  * [よくある問題](troubleshooting/common-issues.md)
  * [署名検証エラー](troubleshooting/signature-errors.md)
  * [トリガーが動作しない](troubleshooting/trigger-not-working.md)
  * [デバッグ方法](troubleshooting/debugging.md)

## リファレンス

* [API リファレンス](reference/README.md)
  * [Webhook API](reference/api.md)
  * [条件演算子一覧](reference/operators.md)
  * [イベントタイプ一覧](reference/event-types.md)

## 付録

* [付録](appendix/README.md)
  * [用語集](appendix/glossary.md)
  * [移行ガイド](appendix/migration.md)
