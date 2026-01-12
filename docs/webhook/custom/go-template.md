# Go Template 条件の書き方

Go Template は、Go 言語の標準テンプレートエンジンを使用した強力なテンプレート言語です。Custom Webhook では、Go Template を使ってペイロードから値を抽出し、条件を評価します。

## Go Template の基礎

### 基本構文

Go Template では、`{{` と `}}` で囲まれた部分がテンプレート式として評価されます。

| 構文 | 説明 | 例 |
|------|------|-----|
| `{{.field}}` | フィールドへのアクセス | `{{.event}}` |
| `{{.field.subfield}}` | ネストされたフィールド | `{{.event.type}}` |
| `{{index .array 0}}` | 配列要素へのアクセス | `{{index .tags 0}}` |
| `{{eq .a .b}}` | 等価比較 | `{{eq .event.type "alert"}}` |
| `{{and .a .b}}` | AND 演算 | `{{and (eq .a 1) (eq .b 2)}}` |
| `{{or .a .b}}` | OR 演算 | `{{or (eq .a 1) (eq .b 2)}}` |

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

| Go Template | 取得される値 | 説明 |
|------------|------------|------|
| `{{.event.type}}` | `"alert"` | event オブジェクトの type フィールド |
| `{{.event.severity}}` | `"critical"` | event オブジェクトの severity フィールド |
| `{{.service.name}}` | `"api-server"` | service オブジェクトの name フィールド |
| `{{index .tags 0}}` | `"production"` | tags 配列の最初の要素 |
| `{{index .tags 1}}` | `"urgent"` | tags 配列の2番目の要素 |

## 条件の基本構造

```json
{
  "conditions": {
    "go_template": "{{eq .event.type \"alert\"}}"
  }
}
```

この条件式は、`event.type` が `"alert"` と等しい場合に `true` を返します。

## 比較関数

Go Template では、以下の比較関数が使用できます：

| 関数 | 説明 | 使用例 |
|------|------|---------|
| `eq` | 等しい | `{{eq .status "active"}}` |
| `ne` | 等しくない | `{{ne .status "inactive"}}` |
| `lt` | より小さい | `{{lt .value 100}}` |
| `le` | 以下 | `{{le .value 100}}` |
| `gt` | より大きい | `{{gt .value 100}}` |
| `ge` | 以上 | `{{ge .value 100}}` |

## 論理演算

複数の条件を組み合わせる場合は、`and` や `or` を使用します：

```go
{{and (eq .event.type "alert") (eq .severity "critical")}}
```

```go
{{or (eq .environment "production") (eq .environment "staging")}}
```

## 実践例

### 例 1: 単純な等価チェック

**要件**: イベントタイプが `"alert"` の場合のみトリガー

```json
{
  "conditions": {
    "go_template": "{{eq .event.type \"alert\"}}"
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
    "go_template": "{{and (eq .severity \"critical\") (eq .environment \"production\")}}"
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
    "go_template": "{{eq .service.status \"down\"}}"
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

### 例 4: 数値の比較

**要件**: CPU 使用率が 90 より大きい場合のみトリガー

```json
{
  "conditions": {
    "go_template": "{{gt .metrics.cpu_usage 90}}"
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

### 例 5: OR 条件

**要件**: environment が `"production"` または `"staging"` の場合のみトリガー

```json
{
  "conditions": {
    "go_template": "{{or (eq .environment \"production\") (eq .environment \"staging\")}}"
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

### 例 6: NOT 条件

**要件**: status が `"resolved"` でない場合のみトリガー

```json
{
  "conditions": {
    "go_template": "{{ne .status \"resolved\"}}"
  }
}
```

**マッチするペイロード**:
```json
{"status": "triggered"}
{"status": "acknowledged"}
```

**マッチしない**:
```json
{"status": "resolved"}
```

### 例 7: 複雑な条件の組み合わせ

**要件**:
- severity が `"critical"` または `"high"` である
- environment が `"production"` である
- status が `"triggered"` である

```json
{
  "conditions": {
    "go_template": "{{and (or (eq .severity \"critical\") (eq .severity \"high\")) (eq .environment \"production\") (eq .status \"triggered\")}}"
  }
}
```

**マッチするペイロード**:
```json
{
  "severity": "critical",
  "environment": "production",
  "status": "triggered"
}
```

## 実践的な例

### 例 8: Datadog アラート

**要件**:
- アラートタイプが `"metric_alert"` である
- 現在の値が 90 より大きい
- タグに `"env:production"` が含まれる（簡易チェック）

```json
{
  "conditions": {
    "go_template": "{{and (eq .alert_type \"metric_alert\") (gt .current_value 90)}}"
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
  "host": "web-server-01"
}
```

### 例 9: Slack インシデント通知

**要件**:
- イベントタイプが `"incident"` である
- severity が `"critical"` または `"high"` である
- environment が `"production"` である

```json
{
  "conditions": {
    "go_template": "{{and (eq .event.type \"incident\") (or (eq .event.severity \"critical\") (eq .event.severity \"high\")) (eq .event.environment \"production\")}}"
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
  }
}
```

## ベストプラクティス

### 1. 必要最小限の条件を設定

条件が複雑すぎると、読みづらくなります。本当に必要な条件だけを設定しましょう。

❌ **悪い例**: 過剰な条件
```json
{
  "go_template": "{{and (eq .event.type \"alert\") (ne .event.id \"\") (ne .event.timestamp \"\") (ne .user \"\")}}"
}
```

✅ **良い例**: 必要な条件のみ
```json
{
  "go_template": "{{eq .event.type \"alert\"}}"
}
```

### 2. 括弧を適切に使う

複雑な条件では、括弧を使って明確にしましょう。

❌ **悪い例**: 読みにくい
```json
{
  "go_template": "{{and eq .a 1 eq .b 2 eq .c 3}}"
}
```

✅ **良い例**: 括弧で明確に
```json
{
  "go_template": "{{and (eq .a 1) (and (eq .b 2) (eq .c 3))}}"
}
```

### 3. 文字列のエスケープに注意

JSON 内で文字列を記述する場合は、ダブルクォートをエスケープする必要があります。

```json
{
  "go_template": "{{eq .status \"active\"}}"
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
        "go_template": "{{eq .severity \"critical\"}}"
      }
    },
    {
      "name": "All Alerts",
      "priority": 10,
      "conditions": {
        "go_template": "{{eq .event.type \"alert\"}}"
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
{"go_template": "{{eq .event.type \"alert\"}}"}
```

**ステップ 2**: 条件を追加
```json
{"go_template": "{{and (eq .event.type \"alert\") (eq .severity \"critical\")}}"}
```

## よくあるエラー

### エラー 1: クォートのエスケープ忘れ

❌ **間違い**:
```json
{
  "go_template": "{{eq .status "active"}}"
}
```

✅ **正しい**:
```json
{
  "go_template": "{{eq .status \"active\"}}"
}
```

### エラー 2: 存在しないフィールドへのアクセス

存在しないフィールドにアクセスすると、エラーになる可能性があります。フィールドの存在を確認してからアクセスしましょう。

### エラー 3: 型の不一致

数値と文字列を比較する場合は、型に注意しましょう。

```json
{
  "go_template": "{{eq .count 10}}"
}
```

## 実際のサービスからのWebhook例

このセクションでは、実際のサービスから送信されるWebhookペイロードと、それに対応する条件式の例を紹介します。

### Slack - インシデント通知

**Slackから送信されるペイロード例:**
```json
{
  "type": "event_callback",
  "event": {
    "type": "app_mention",
    "text": "<@U12345> incident in production",
    "user": "U67890",
    "channel": "C11111",
    "ts": "1234567890.123456"
  },
  "team_id": "T12345"
}
```

**条件式の例:**

1. **app_mention イベントのみ受け取る:**
```json
{
  "go_template": "{{eq .event.type \"app_mention\"}}"
}
```

2. **"incident" という単語を含む mention のみ:**
```json
{
  "go_template": "{{and (eq .event.type \"app_mention\") (eq .type \"event_callback\")}}"
}
```

3. **特定のチャンネルからの mention のみ:**
```json
{
  "go_template": "{{and (eq .event.type \"app_mention\") (eq .event.channel \"C11111\")}}"
}
```

### Datadog - メトリクスアラート

**Datadogから送信されるペイロード例:**
```json
{
  "id": "1234567890",
  "alert_type": "metric_alert",
  "title": "High CPU usage on web-server-01",
  "body": "CPU usage is above 90%",
  "priority": "normal",
  "last_updated": "2026-01-12T10:30:00+00:00",
  "event_type": "triggered",
  "tags": ["env:production", "service:web", "host:web-server-01"],
  "alert_metric": "system.cpu.user",
  "alert_status": "alert",
  "alert_transition": "Triggered",
  "current_value": 95.3,
  "alert_threshold": 90
}
```

**条件式の例:**

1. **アラートがトリガーされた時のみ:**
```json
{
  "go_template": "{{eq .event_type \"triggered\"}}"
}
```

2. **CPU使用率が90%以上の時:**
```json
{
  "go_template": "{{and (eq .alert_metric \"system.cpu.user\") (gt .current_value 90)}}"
}
```

3. **本番環境のメトリクスアラートのみ（簡易チェック）:**
```json
{
  "go_template": "{{and (eq .alert_type \"metric_alert\") (eq .event_type \"triggered\")}}"
}
```

### PagerDuty - インシデント

**PagerDutyから送信されるペイロード例:**
```json
{
  "event": {
    "id": "INCIDENT123",
    "event_type": "incident.triggered",
    "resource_type": "incident",
    "occurred_at": "2026-01-12T10:30:00Z",
    "agent": {
      "html_url": "https://example.pagerduty.com/users/USER123",
      "id": "USER123",
      "summary": "John Doe",
      "type": "user_reference"
    },
    "data": {
      "id": "INC-123",
      "type": "incident",
      "self": "https://api.pagerduty.com/incidents/INC-123",
      "html_url": "https://example.pagerduty.com/incidents/INC-123",
      "number": 123,
      "status": "triggered",
      "title": "Database connection pool exhausted",
      "urgency": "high",
      "service": {
        "id": "SERVICE123",
        "summary": "Production Database"
      }
    }
  }
}
```

**条件式の例:**

1. **インシデントがトリガーされた時:**
```json
{
  "go_template": "{{eq .event.event_type \"incident.triggered\"}}"
}
```

2. **高緊急度のインシデントのみ:**
```json
{
  "go_template": "{{and (eq .event.event_type \"incident.triggered\") (eq .event.data.urgency \"high\")}}"
}
```

3. **特定のサービスの高緊急度インシデント:**
```json
{
  "go_template": "{{and (eq .event.event_type \"incident.triggered\") (eq .event.data.urgency \"high\") (eq .event.data.service.id \"SERVICE123\")}}"
}
```

### Sentry - エラートラッキング

**Sentryから送信されるペイロード例:**
```json
{
  "action": "created",
  "installation": {
    "uuid": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "issue": {
      "id": "123456789",
      "title": "TypeError: Cannot read property 'map' of undefined",
      "culprit": "app/components/UserList.tsx in UserList",
      "level": "error",
      "status": "unresolved",
      "type": "error",
      "metadata": {
        "type": "TypeError",
        "value": "Cannot read property 'map' of undefined"
      },
      "project": {
        "id": "987654",
        "name": "production-web",
        "slug": "production-web"
      }
    }
  },
  "actor": {
    "type": "application",
    "id": "sentry",
    "name": "Sentry"
  }
}
```

**条件式の例:**

1. **新しいエラーが作成された時:**
```json
{
  "go_template": "{{eq .action \"created\"}}"
}
```

2. **エラーレベルのイベントのみ:**
```json
{
  "go_template": "{{and (eq .action \"created\") (eq .data.issue.level \"error\")}}"
}
```

3. **特定のプロジェクトのエラー:**
```json
{
  "go_template": "{{and (eq .action \"created\") (eq .data.issue.project.slug \"production-web\") (eq .data.issue.level \"error\")}}"
}
```

### CircleCI - ビルド完了

**CircleCIから送信されるペイロード例:**
```json
{
  "type": "workflow-completed",
  "id": "12345678-1234-1234-1234-123456789012",
  "happened_at": "2026-01-12T10:30:00.000Z",
  "webhook": {
    "id": "webhook-123",
    "name": "Production Deployment"
  },
  "workflow": {
    "id": "workflow-123",
    "name": "build-and-deploy",
    "status": "success",
    "created_at": "2026-01-12T10:20:00.000Z",
    "stopped_at": "2026-01-12T10:30:00.000Z",
    "url": "https://app.circleci.com/pipelines/github/org/repo/123/workflows/workflow-123"
  },
  "pipeline": {
    "id": "pipeline-123",
    "number": 456,
    "vcs": {
      "origin_repository_url": "https://github.com/org/repo",
      "target_repository_url": "https://github.com/org/repo",
      "revision": "abc123def456",
      "branch": "main"
    }
  },
  "project": {
    "id": "project-123",
    "name": "repo",
    "slug": "github/org/repo"
  },
  "organization": {
    "id": "org-123",
    "name": "org"
  }
}
```

**条件式の例:**

1. **ワークフローが完了した時:**
```json
{
  "go_template": "{{eq .type \"workflow-completed\"}}"
}
```

2. **ビルドが失敗した時:**
```json
{
  "go_template": "{{and (eq .type \"workflow-completed\") (eq .workflow.status \"failed\")}}"
}
```

3. **mainブランチのビルドが失敗した時:**
```json
{
  "go_template": "{{and (eq .type \"workflow-completed\") (eq .workflow.status \"failed\") (eq .pipeline.vcs.branch \"main\")}}"
}
```

4. **本番デプロイワークフローが成功した時:**
```json
{
  "go_template": "{{and (eq .type \"workflow-completed\") (eq .workflow.name \"build-and-deploy\") (eq .workflow.status \"success\") (eq .pipeline.vcs.branch \"main\")}}"
}
```

### Stripe - 支払いイベント

**Stripeから送信されるペイロード例:**
```json
{
  "id": "evt_1234567890",
  "object": "event",
  "api_version": "2023-10-16",
  "created": 1704715200,
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "object": "payment_intent",
      "amount": 5000,
      "currency": "usd",
      "status": "succeeded",
      "customer": "cus_1234567890",
      "description": "Monthly subscription",
      "metadata": {
        "subscription_id": "sub_1234567890",
        "plan": "pro"
      }
    }
  },
  "livemode": true
}
```

**条件式の例:**

1. **支払いが成功した時:**
```json
{
  "go_template": "{{eq .type \"payment_intent.succeeded\"}}"
}
```

2. **$100以上の支払いが成功した時:**
```json
{
  "go_template": "{{and (eq .type \"payment_intent.succeeded\") (ge .data.object.amount 10000)}}"
}
```

3. **本番環境のProプラン支払い:**
```json
{
  "go_template": "{{and (eq .type \"payment_intent.succeeded\") (eq .livemode true) (eq .data.object.metadata.plan \"pro\")}}"
}
```

### GitHub Actions - ワークフロー実行

**GitHub Actionsから送信されるペイロード例（カスタムWebhook）:**
```json
{
  "workflow": "CI",
  "repository": "org/repo",
  "status": "failure",
  "conclusion": "failure",
  "branch": "main",
  "commit_sha": "abc123def456",
  "commit_message": "Fix: Update user validation",
  "author": "john.doe",
  "workflow_url": "https://github.com/org/repo/actions/runs/123456",
  "run_id": 123456,
  "run_number": 789
}
```

**条件式の例:**

1. **ワークフローが失敗した時:**
```json
{
  "go_template": "{{eq .status \"failure\"}}"
}
```

2. **mainブランチのCIが失敗した時:**
```json
{
  "go_template": "{{and (eq .workflow \"CI\") (eq .branch \"main\") (eq .status \"failure\")}}"
}
```

3. **特定のユーザーのコミットで失敗した時:**
```json
{
  "go_template": "{{and (eq .status \"failure\") (eq .author \"john.doe\")}}"
}
```

### 汎用的なWebhook - カスタムアプリケーション

**カスタムアプリケーションのペイロード例:**
```json
{
  "event_type": "order_created",
  "timestamp": "2026-01-12T10:30:00Z",
  "data": {
    "order_id": "ORD-12345",
    "customer_id": "CUST-67890",
    "total_amount": 15000,
    "currency": "JPY",
    "status": "pending",
    "items_count": 3,
    "shipping_address": {
      "country": "JP",
      "prefecture": "Tokyo"
    },
    "priority": "high"
  },
  "metadata": {
    "source": "web",
    "campaign": "summer-sale"
  }
}
```

**条件式の例:**

1. **注文が作成された時:**
```json
{
  "go_template": "{{eq .event_type \"order_created\"}}"
}
```

2. **10,000円以上の高額注文:**
```json
{
  "go_template": "{{and (eq .event_type \"order_created\") (ge .data.total_amount 10000)}}"
}
```

3. **高優先度のWeb注文:**
```json
{
  "go_template": "{{and (eq .event_type \"order_created\") (eq .data.priority \"high\") (eq .metadata.source \"web\")}}"
}
```

4. **特定キャンペーンの東京への配送:**
```json
{
  "go_template": "{{and (eq .event_type \"order_created\") (eq .metadata.campaign \"summer-sale\") (eq .data.shipping_address.prefecture \"Tokyo\")}}"
}
```

## 複数条件の組み合わせパターン

実際の運用では、複数の条件を組み合わせることが多くあります。以下は実践的なパターン例です。

### パターン 1: 環境とステータスの組み合わせ

```json
{
  "triggers": [
    {
      "name": "Production Critical Alerts",
      "priority": 100,
      "conditions": {
        "go_template": "{{and (eq .environment \"production\") (or (eq .severity \"critical\") (eq .severity \"high\"))}}"
      }
    },
    {
      "name": "Staging Alerts",
      "priority": 50,
      "conditions": {
        "go_template": "{{and (eq .environment \"staging\") (eq .severity \"critical\")}}"
      }
    },
    {
      "name": "All Other Alerts",
      "priority": 10,
      "conditions": {
        "go_template": "{{eq .event_type \"alert\"}}"
      }
    }
  ]
}
```

### パターン 2: 数値の範囲チェック

```json
{
  "go_template": "{{and (gt .value 80) (le .value 100)}}"
}
```

### パターン 3: 複数のイベントタイプ

```json
{
  "go_template": "{{or (eq .event_type \"error\") (eq .event_type \"critical\") (eq .event_type \"emergency\")}}"
}
```

## まとめ

Go Template を使った条件設定は、Custom Webhook の最も強力な機能です。基本的な構文を理解し、比較関数と論理演算を適切に使うことで、様々なペイロード構造に対応できます。

実際のサービスからのWebhookを設定する際は：
1. まずペイロードの構造を確認
2. 必要な条件を明確にする
3. 段階的に条件を追加してテスト
4. Delivery Recordで動作を確認

## 関連ページ

- [署名検証の設定](signature.md) - セキュリティ設定
- [実用例集](../integrations/README.md) - サービスごとの設定例
