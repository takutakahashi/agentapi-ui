# JSONPath 条件の書き方

JSONPath は、JSON ドキュメント内の値にアクセスするためのクエリ言語です。Custom Webhook では、JSONPath を使ってペイロードから値を抽出し、条件を評価します。

## JSONPath の基礎

### 基本構文

| 構文 | 説明 | 例 |
|------|------|-----|
| `$` | ルート要素 | `$` |
| `.` | 子要素へのアクセス | `$.event` |
| `[]` | 配列要素へのアクセス | `$.items[0]` |
| `*` | ワイルドカード | `$.items[*].name` |

### 例: 基本的なペイロード

```json
{
  "event": {
    "type": "alert",
    "severity": "critical",
    "message": "High CPU usage"
  },
  "service": {
    "name": "api-server",
    "version": "v1.0.0"
  },
  "tags": ["production", "urgent"]
}
```

**アクセス例**:

| JSONPath | 取得される値 | 説明 |
|----------|------------|------|
| `$.event.type` | `"alert"` | event オブジェクトの type フィールド |
| `$.event.severity` | `"critical"` | event オブジェクトの severity フィールド |
| `$.service.name` | `"api-server"` | service オブジェクトの name フィールド |
| `$.tags[0]` | `"production"` | tags 配列の最初の要素 |
| `$.tags[1]` | `"urgent"` | tags 配列の2番目の要素 |

## 条件の基本構造

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.event.type",
        "operator": "eq",
        "value": "alert"
      }
    ]
  }
}
```

### フィールドの説明

| フィールド | 型 | 説明 |
|----------|-----|------|
| `path` | string | JSONPath 式 |
| `operator` | string | 演算子（`eq`, `ne`, `contains` など） |
| `value` | any | 比較対象の値 |

## 実践例

### 例 1: 単純な等価チェック

**要件**: イベントタイプが `"alert"` の場合のみトリガー

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.event.type",
        "operator": "eq",
        "value": "alert"
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "event": {
    "type": "alert"
  }
}
```

### 例 2: 複数の条件（AND）

**要件**: severity が `"critical"` かつ environment が `"production"` の場合のみトリガー

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.severity",
        "operator": "eq",
        "value": "critical"
      },
      {
        "path": "$.environment",
        "operator": "eq",
        "value": "production"
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "severity": "critical",
  "environment": "production"
}
```

### 例 3: ネストされたオブジェクト

**要件**: service.status が `"down"` の場合のみトリガー

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.service.status",
        "operator": "eq",
        "value": "down"
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "service": {
    "name": "api-server",
    "status": "down"
  }
}
```

### 例 4: 配列の要素チェック

**要件**: tags に `"production"` が含まれる場合のみトリガー

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.tags",
        "operator": "contains",
        "value": "production"
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "tags": ["production", "urgent", "critical"]
}
```

### 例 5: 数値の比較

**要件**: CPU 使用率が 90 より大きい場合のみトリガー

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.metrics.cpu_usage",
        "operator": "gt",
        "value": 90
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "metrics": {
    "cpu_usage": 95.5
  }
}
```

### 例 6: 正規表現マッチ

**要件**: service 名が `"api-"` で始まる場合のみトリガー

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.service.name",
        "operator": "matches",
        "value": "^api-.*"
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "service": {
    "name": "api-server"
  }
}
```

### 例 7: 複数値のチェック（in 演算子）

**要件**: environment が `"production"` または `"staging"` の場合のみトリガー

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.environment",
        "operator": "in",
        "value": ["production", "staging"]
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "environment": "production"
}
```

または

```json
{
  "environment": "staging"
}
```

### 例 8: フィールドの存在チェック

**要件**: error フィールドが存在する場合のみトリガー

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.error",
        "operator": "exists",
        "value": true
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "error": {
    "code": "500",
    "message": "Internal Server Error"
  }
}
```

## 複雑な例

### 例 9: 実践的な Datadog アラート

**要件**:
- アラートタイプが `"metric_alert"` である
- 現在の値が 90 より大きい
- タグに `"env:production"` が含まれる

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

**マッチするペイロード**:
```json
{
  "alert_type": "metric_alert",
  "current_value": 95.3,
  "threshold": 90,
  "metric": "system.cpu.user",
  "host": "web-server-01",
  "tags": ["env:production", "service:web", "region:us-east-1"]
}
```

### 例 10: Slack インシデント通知

**要件**:
- イベントタイプが `"incident"` である
- severity が `"critical"` または `"high"` である
- environment が `"production"` である
- status が `"triggered"` である

```json
{
  "conditions": {
    "jsonpath": [
      {
        "path": "$.event.type",
        "operator": "eq",
        "value": "incident"
      },
      {
        "path": "$.event.severity",
        "operator": "in",
        "value": ["critical", "high"]
      },
      {
        "path": "$.event.environment",
        "operator": "eq",
        "value": "production"
      },
      {
        "path": "$.event.status",
        "operator": "eq",
        "value": "triggered"
      }
    ]
  }
}
```

**マッチするペイロード**:
```json
{
  "event": {
    "type": "incident",
    "id": "INC-12345",
    "title": "Database connection pool exhausted",
    "severity": "critical",
    "environment": "production",
    "status": "triggered",
    "timestamp": "2026-01-12T10:30:00Z"
  },
  "user": {
    "id": "U12345",
    "name": "john.doe"
  }
}
```

## ベストプラクティス

### 1. 必要最小限の条件を設定

条件が多すぎると、マッチする確率が下がります。本当に必要な条件だけを設定しましょう。

❌ **悪い例**: 過剰な条件
```json
{
  "conditions": {
    "jsonpath": [
      {"path": "$.event.type", "operator": "eq", "value": "alert"},
      {"path": "$.event.id", "operator": "exists", "value": true},
      {"path": "$.event.timestamp", "operator": "exists", "value": true},
      {"path": "$.user", "operator": "exists", "value": true}
    ]
  }
}
```

✅ **良い例**: 必要な条件のみ
```json
{
  "conditions": {
    "jsonpath": [
      {"path": "$.event.type", "operator": "eq", "value": "alert"}
    ]
  }
}
```

### 2. 明示的な値を使う

ワイルドカードや曖昧なパターンは避け、明確な値を指定しましょう。

❌ **悪い例**: 曖昧なパターン
```json
{
  "path": "$.severity",
  "operator": "matches",
  "value": ".*"
}
```

✅ **良い例**: 明示的な値
```json
{
  "path": "$.severity",
  "operator": "in",
  "value": ["critical", "high", "medium"]
}
```

### 3. 存在チェックを活用

オプショナルなフィールドがある場合は、`exists` 演算子で存在を確認してからアクセスしましょう。

```json
{
  "conditions": {
    "jsonpath": [
      {"path": "$.error", "operator": "exists", "value": true},
      {"path": "$.error.code", "operator": "eq", "value": "500"}
    ]
  }
}
```

### 4. 優先度を活用

複数のトリガーを設定する場合は、優先度を使って評価順序を制御しましょう。

```json
{
  "triggers": [
    {
      "name": "Critical Alerts",
      "priority": 100,
      "conditions": {
        "jsonpath": [
          {"path": "$.severity", "operator": "eq", "value": "critical"}
        ]
      }
    },
    {
      "name": "All Alerts",
      "priority": 10,
      "conditions": {
        "jsonpath": [
          {"path": "$.event.type", "operator": "eq", "value": "alert"}
        ]
      }
    }
  ]
}
```

## デバッグのコツ

### 1. ペイロードを確認

まず、実際に送信されるペイロードの構造を確認しましょう。

```bash
curl -X POST https://your-webhook-url \
  -H "Content-Type: application/json" \
  -d @payload.json
```

### 2. Delivery Record を確認

agentapi-proxy の Delivery Record 機能を使って、受信したペイロードとマッチング結果を確認できます。

### 3. 段階的に条件を追加

最初は単純な条件から始めて、徐々に複雑にしていきましょう。

**ステップ 1**: 基本的な条件
```json
{"path": "$.event.type", "operator": "eq", "value": "alert"}
```

**ステップ 2**: 条件を追加
```json
[
  {"path": "$.event.type", "operator": "eq", "value": "alert"},
  {"path": "$.severity", "operator": "eq", "value": "critical"}
]
```

## まとめ

JSONPath を使った条件設定は、Custom Webhook の最も強力な機能です。基本的な構文を理解し、演算子を適切に使うことで、様々なペイロード構造に対応できます。

次のページでは、利用可能な演算子について詳しく見ていきましょう。

## 関連ページ

- [演算子リファレンス](operators.md) - すべての演算子の詳細
- [署名検証の設定](signature.md) - セキュリティ設定
- [実用例集](../integrations/README.md) - サービスごとの設定例
