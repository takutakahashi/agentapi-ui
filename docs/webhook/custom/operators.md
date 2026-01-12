# 演算子リファレンス

Custom Webhook の JSONPath 条件では、様々な演算子を使ってペイロードの値を評価できます。このページでは、すべての演算子の詳細と使用例を説明します。

## 演算子一覧

| 演算子 | 説明 | 対象型 | 使用例 |
|--------|------|---------|---------|
| [`eq`](#eq-等価) | 等しい | すべて | severity が "critical" |
| [`ne`](#ne-非等価) | 等しくない | すべて | status が "resolved" でない |
| [`gt`](#gt-より大きい) | より大きい | 数値 | cpu_usage が 90 より大きい |
| [`gte`](#gte-以上) | 以上 | 数値 | memory_usage が 80 以上 |
| [`lt`](#lt-より小さい) | より小さい | 数値 | latency が 100 より小さい |
| [`lte`](#lte-以下) | 以下 | 数値 | error_rate が 5 以下 |
| [`contains`](#contains-含む) | 含む | 文字列, 配列 | tags に "production" が含まれる |
| [`matches`](#matches-正規表現マッチ) | 正規表現マッチ | 文字列 | service 名が "api-" で始まる |
| [`in`](#in-いずれかに一致) | いずれかに一致 | すべて | env が ["prod", "stage"] のいずれか |
| [`exists`](#exists-存在チェック) | 存在する | すべて | error フィールドが存在する |

## eq (等価)

値が指定した値と等しいかをチェックします。

### 文字列の等価

```json
{
  "path": "$.event.type",
  "operator": "eq",
  "value": "alert"
}
```

**マッチ**:
```json
{"event": {"type": "alert"}}
```

**マッチしない**:
```json
{"event": {"type": "warning"}}
```

### 数値の等価

```json
{
  "path": "$.status_code",
  "operator": "eq",
  "value": 200
}
```

**マッチ**:
```json
{"status_code": 200}
```

### ブール値の等価

```json
{
  "path": "$.is_critical",
  "operator": "eq",
  "value": true
}
```

**マッチ**:
```json
{"is_critical": true}
```

## ne (非等価)

値が指定した値と等しくないかをチェックします。

```json
{
  "path": "$.status",
  "operator": "ne",
  "value": "resolved"
}
```

**マッチ**:
```json
{"status": "triggered"}
{"status": "acknowledged"}
```

**マッチしない**:
```json
{"status": "resolved"}
```

### ユースケース

**「エラー以外を除外」**:
```json
{
  "path": "$.log_level",
  "operator": "ne",
  "value": "DEBUG"
}
```

## gt (より大きい)

数値が指定した値より大きいかをチェックします。

```json
{
  "path": "$.metrics.cpu_usage",
  "operator": "gt",
  "value": 90
}
```

**マッチ**:
```json
{"metrics": {"cpu_usage": 95}}
{"metrics": {"cpu_usage": 90.1}}
```

**マッチしない**:
```json
{"metrics": {"cpu_usage": 90}}
{"metrics": {"cpu_usage": 85}}
```

### 浮動小数点数

```json
{
  "path": "$.response_time",
  "operator": "gt",
  "value": 0.5
}
```

**マッチ**:
```json
{"response_time": 1.2}
{"response_time": 0.51}
```

## gte (以上)

数値が指定した値以上かをチェックします。

```json
{
  "path": "$.metrics.memory_usage",
  "operator": "gte",
  "value": 80
}
```

**マッチ**:
```json
{"metrics": {"memory_usage": 80}}
{"metrics": {"memory_usage": 85}}
```

**マッチしない**:
```json
{"metrics": {"memory_usage": 79}}
```

## lt (より小さい)

数値が指定した値より小さいかをチェックします。

```json
{
  "path": "$.latency_ms",
  "operator": "lt",
  "value": 100
}
```

**マッチ**:
```json
{"latency_ms": 50}
{"latency_ms": 99}
```

**マッチしない**:
```json
{"latency_ms": 100}
{"latency_ms": 150}
```

## lte (以下)

数値が指定した値以下かをチェックします。

```json
{
  "path": "$.error_count",
  "operator": "lte",
  "value": 5
}
```

**マッチ**:
```json
{"error_count": 5}
{"error_count": 3}
{"error_count": 0}
```

**マッチしない**:
```json
{"error_count": 6}
```

## contains (含む)

文字列または配列に指定した値が含まれるかをチェックします。

### 配列に文字列が含まれる

```json
{
  "path": "$.tags",
  "operator": "contains",
  "value": "production"
}
```

**マッチ**:
```json
{"tags": ["production", "critical"]}
{"tags": ["production"]}
```

**マッチしない**:
```json
{"tags": ["development"]}
{"tags": []}
```

### 文字列に部分文字列が含まれる

```json
{
  "path": "$.message",
  "operator": "contains",
  "value": "error"
}
```

**マッチ**:
```json
{"message": "An error occurred"}
{"message": "error: connection failed"}
```

**マッチしない**:
```json
{"message": "Success"}
```

### ケーススタディ: タグフィルタリング

Datadog のタグをフィルタリングする場合：

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.tags",
        "operator": "contains",
        "value": "env:production"
      },
      {
        "path": "$.tags",
        "operator": "contains",
        "value": "service:api"
      }
    ]
  }
}
```

**マッチ**:
```json
{
  "tags": ["env:production", "service:api", "region:us-east-1"]
}
```

## matches (正規表現マッチ)

文字列が指定した正規表現パターンにマッチするかをチェックします。

### 基本的な使い方

```json
{
  "path": "$.service.name",
  "operator": "matches",
  "value": "^api-.*"
}
```

**マッチ**:
```json
{"service": {"name": "api-server"}}
{"service": {"name": "api-gateway"}}
```

**マッチしない**:
```json
{"service": {"name": "web-server"}}
```

### よく使うパターン

**プレフィックスマッチ** (`^` で始まる):
```json
{"operator": "matches", "value": "^api-"}
```

**サフィックスマッチ** (`$` で終わる):
```json
{"operator": "matches", "value": "-prod$"}
```

**いずれかの単語**:
```json
{"operator": "matches", "value": "^(api|web|db)-server$"}
```

**メールアドレス**:
```json
{"operator": "matches", "value": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"}
```

**バージョン番号** (v1.2.3 形式):
```json
{"operator": "matches", "value": "^v\\d+\\.\\d+\\.\\d+$"}
```

### 実践例: ブランチ名のフィルタリング

```json
{
  "path": "$.ref",
  "operator": "matches",
  "value": "^refs/heads/(main|master|develop)$"
}
```

**マッチ**:
```json
{"ref": "refs/heads/main"}
{"ref": "refs/heads/develop"}
```

**マッチしない**:
```json
{"ref": "refs/heads/feature/new-feature"}
```

## in (いずれかに一致)

値が指定した配列のいずれかに含まれるかをチェックします。

### 文字列のチェック

```json
{
  "path": "$.environment",
  "operator": "in",
  "value": ["production", "staging"]
}
```

**マッチ**:
```json
{"environment": "production"}
{"environment": "staging"}
```

**マッチしない**:
```json
{"environment": "development"}
```

### 数値のチェック

```json
{
  "path": "$.http_status",
  "operator": "in",
  "value": [500, 502, 503, 504]
}
```

**マッチ**:
```json
{"http_status": 500}
{"http_status": 503}
```

**マッチしない**:
```json
{"http_status": 200}
{"http_status": 404}
```

### ユースケース: 複数の severity レベル

```json
{
  "path": "$.severity",
  "operator": "in",
  "value": ["critical", "high", "urgent"]
}
```

**マッチ**:
```json
{"severity": "critical"}
{"severity": "high"}
```

## exists (存在チェック)

指定したパスが存在するかをチェックします。

### フィールドが存在する

```json
{
  "path": "$.error",
  "operator": "exists",
  "value": true
}
```

**マッチ**:
```json
{"error": {"code": 500}}
{"error": null}
{"error": ""}
```

**マッチしない**:
```json
{}
{"message": "success"}
```

### フィールドが存在しない

```json
{
  "path": "$.error",
  "operator": "exists",
  "value": false
}
```

**マッチ**:
```json
{}
{"message": "success"}
```

**マッチしない**:
```json
{"error": {"code": 500}}
```

### ユースケース: エラーハンドリング

エラーが存在する場合のみトリガー：

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.error",
        "operator": "exists",
        "value": true
      },
      {
        "path": "$.error.code",
        "operator": "eq",
        "value": "CRITICAL"
      }
    ]
  }
}
```

## 組み合わせ例

### 例 1: 重大なアラートのフィルタリング

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.alert_type",
        "operator": "eq",
        "value": "metric_alert"
      },
      {
        "path": "$.severity",
        "operator": "in",
        "value": ["critical", "high"]
      },
      {
        "path": "$.current_value",
        "operator": "gt",
        "value": 90
      },
      {
        "path": "$.tags",
        "operator": "contains",
        "value": "env:production"
      }
    ]
  }
}
```

### 例 2: デプロイメント通知

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.event.type",
        "operator": "eq",
        "value": "deployment"
      },
      {
        "path": "$.deployment.status",
        "operator": "in",
        "value": ["succeeded", "failed"]
      },
      {
        "path": "$.deployment.environment",
        "operator": "matches",
        "value": "^(production|staging)$"
      }
    ]
  }
}
```

### 例 3: エラー率の監視

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.metric.name",
        "operator": "eq",
        "value": "error_rate"
      },
      {
        "path": "$.current_value",
        "operator": "gte",
        "value": 5.0
      },
      {
        "path": "$.duration",
        "operator": "gte",
        "value": 300
      }
    ]
  }
}
```

## パフォーマンスのヒント

### 1. 早期終了を活用

最も制限的な条件を最初に配置すると、不要な評価を避けられます。

✅ **良い例**:
```json
[
  {"path": "$.severity", "operator": "eq", "value": "critical"},
  {"path": "$.tags", "operator": "contains", "value": "production"}
]
```

❌ **悪い例**:
```json
[
  {"path": "$.tags", "operator": "contains", "value": "production"},
  {"path": "$.severity", "operator": "eq", "value": "critical"}
]
```

### 2. 簡単な演算子を優先

`eq` や `in` は `matches` より高速です。可能な限り単純な演算子を使いましょう。

✅ **良い例**:
```json
{"path": "$.env", "operator": "in", "value": ["prod", "stage"]}
```

❌ **悪い例**:
```json
{"path": "$.env", "operator": "matches", "value": "^(prod|stage)$"}
```

## トラブルシューティング

### 問題 1: 条件がマッチしない

**チェックポイント**:
1. JSONPath が正しいか（`$.path.to.field`）
2. 型が一致しているか（文字列 vs 数値）
3. 大文字小文字が一致しているか

### 問題 2: 正規表現がマッチしない

**チェックポイント**:
1. エスケープが正しいか（`\.` や `\\d`）
2. アンカー（`^` と `$`）が適切か
3. オンラインツールでテスト（regex101.com など）

### 問題 3: 配列チェックが動作しない

**チェックポイント**:
1. `contains` を使っているか（`eq` ではなく）
2. 配列要素の型が一致しているか
3. 空配列を考慮しているか

## まとめ

演算子を適切に使い分けることで、様々なペイロード構造に柔軟に対応できます。基本的な `eq` から始めて、必要に応じて `matches` や `in` などの高度な演算子を使いましょう。

## 関連ページ

- [JSONPath 条件の書き方](jsonpath.md) - JSONPath の基礎
- [署名検証の設定](signature.md) - セキュリティ設定
- [実用例集](../integrations/README.md) - サービスごとの設定例
