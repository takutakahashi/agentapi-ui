# Go Template 条件の書き方

Go Template は、Go 言語の標準テンプレートエンジンを使用した強力なテンプレート言語です。Custom Webhook では、Go Template を使ってペイロードから値を抽出し、条件を評価します。

## Go Template の基礎

### 基本構文

Go Template では、`&#123;&#123;` と `}}` で囲まれた部分がテンプレート式として評価されます。

{% raw %}
{% raw %}
| 構文 | 説明 | 例 |
|------|------|-----|
| `&#123;&#123;.field&#125;&#125;` | フィールドへのアクセス | `&#123;&#123;.event&#125;&#125;` |
| `&#123;&#123;.field.subfield&#125;&#125;` | ネストされたフィールド | `&#123;&#123;.event.type&#125;&#125;` |
| `&#123;&#123;index .array 0&#125;&#125;` | 配列要素へのアクセス | `&#123;&#123;index .tags 0&#125;&#125;` |
| `&#123;&#123;eq .a .b&#125;&#125;` | 等価比較 | `&#123;&#123;eq .event.type "alert"&#125;&#125;` |
| `&#123;&#123;and .a .b&#125;&#125;` | AND 演算 | `&#123;&#123;and (eq .a 1) (eq .b 2)&#125;&#125;` |
| `&#123;&#123;or .a .b&#125;&#125;` | OR 演算 | `&#123;&#123;or (eq .a 1) (eq .b 2)&#125;&#125;` |
{% endraw %}
{% endraw %}

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

{% raw %}
{% raw %}
| Go Template | 取得される値 | 説明 |
|------------|------------|------|
| `&#123;&#123;.event.type&#125;&#125;` | `"alert"` | event オブジェクトの type フィールド |
| `&#123;&#123;.event.severity&#125;&#125;` | `"critical"` | event オブジェクトの severity フィールド |
| `&#123;&#123;.service.name&#125;&#125;` | `"api-server"` | service オブジェクトの name フィールド |
| `&#123;&#123;index .tags 0&#125;&#125;` | `"production"` | tags 配列の最初の要素 |
| `&#123;&#123;index .tags 1&#125;&#125;` | `"urgent"` | tags 配列の2番目の要素 |
{% endraw %}
{% endraw %}

## 条件の基本構造

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{eq .event.type \"alert\"}}"
  }
}
```
{% endraw %}
{% endraw %}

この条件式は、`event.type` が `"alert"` と等しい場合に `true` を返します。

## 比較関数

Go Template では、以下の比較関数が使用できます：

{% raw %}
| 関数 | 説明 | 使用例 |
|------|------|---------|
| `eq` | 等しい | `&#123;&#123;eq .status "active"&#125;&#125;` |
| `ne` | 等しくない | `&#123;&#123;ne .status "inactive"&#125;&#125;` |
| `lt` | より小さい | `&#123;&#123;lt .value 100&#125;&#125;` |
| `le` | 以下 | `&#123;&#123;le .value 100&#125;&#125;` |
| `gt` | より大きい | `&#123;&#123;gt .value 100&#125;&#125;` |
| `ge` | 以上 | `&#123;&#123;ge .value 100&#125;&#125;` |
{% endraw %}

## 論理演算

複数の条件を組み合わせる場合は、`and` や `or` を使用します：

{% raw %}
{% raw %}
```go
{{and (eq .event.type "alert") (eq .severity "critical")}}
```
{% endraw %}
{% endraw %}

{% raw %}
{% raw %}
```go
{{or (eq .environment "production") (eq .environment "staging")}}
```
{% endraw %}
{% endraw %}

## 実践例

### 例 1: 単純な等価チェック

**要件**: イベントタイプが `"alert"` の場合のみトリガー

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{eq .event.type \"alert\"}}"
  }
}
```
{% endraw %}
{% endraw %}

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

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{and (eq .severity \"critical\") (eq .environment \"production\")}}"
  }
}
```
{% endraw %}
{% endraw %}

**マッチするペイロード**:
```json
{
  "severity": "critical",
  "environment": "production"
}
```

### 例 3: ネストされたオブジェクト

**要件**: service.status が `"down"` の場合のみトリガー

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{eq .service.status \"down\"}}"
  }
}
```
{% endraw %}
{% endraw %}

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

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{gt .metrics.cpu_usage 90}}"
  }
}
```
{% endraw %}
{% endraw %}

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

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{or (eq .environment \"production\") (eq .environment \"staging\")}}"
  }
}
```
{% endraw %}
{% endraw %}

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

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{ne .status \"resolved\"}}"
  }
}
```
{% endraw %}
{% endraw %}

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

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{and (or (eq .severity \"critical\") (eq .severity \"high\")) (eq .environment \"production\") (eq .status \"triggered\")}}"
  }
}
```
{% endraw %}
{% endraw %}

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

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{and (eq .alert_type \"metric_alert\") (gt .current_value 90)}}"
  }
}
```
{% endraw %}
{% endraw %}

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

{% raw %}
{% raw %}
```json
{
  "conditions": {
    "go_template": "{{and (eq .event.type \"incident\") (or (eq .event.severity \"critical\") (eq .event.severity \"high\")) (eq .event.environment \"production\")}}"
  }
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .event.type \"alert\") (ne .event.id \"\") (ne .event.timestamp \"\") (ne .user \"\")}}"
}
```
{% endraw %}
{% endraw %}

✅ **良い例**: 必要な条件のみ
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .event.type \"alert\"}}"
}
```
{% endraw %}
{% endraw %}

### 2. 括弧を適切に使う

複雑な条件では、括弧を使って明確にしましょう。

❌ **悪い例**: 読みにくい
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and eq .a 1 eq .b 2 eq .c 3}}"
}
```
{% endraw %}
{% endraw %}

✅ **良い例**: 括弧で明確に
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .a 1) (and (eq .b 2) (eq .c 3))}}"
}
```
{% endraw %}
{% endraw %}

### 3. 文字列のエスケープに注意

JSON 内で文字列を記述する場合は、ダブルクォートをエスケープする必要があります。

{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .status \"active\"}}"
}
```
{% endraw %}
{% endraw %}

### 4. 優先度を活用

複数のトリガーを設定する場合は、優先度を使って評価順序を制御しましょう。

{% raw %}
{% raw %}
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
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{"go_template": "{{eq .event.type \"alert\"}}"}
```
{% endraw %}
{% endraw %}

**ステップ 2**: 条件を追加
{% raw %}
{% raw %}
```json
{"go_template": "{{and (eq .event.type \"alert\") (eq .severity \"critical\")}}"}
```
{% endraw %}
{% endraw %}

## よくあるエラー

### エラー 1: クォートのエスケープ忘れ

❌ **間違い**:
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .status "active"}}"
}
```
{% endraw %}
{% endraw %}

✅ **正しい**:
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .status \"active\"}}"
}
```
{% endraw %}
{% endraw %}

### エラー 2: 存在しないフィールドへのアクセス

存在しないフィールドにアクセスすると、エラーになる可能性があります。フィールドの存在を確認してからアクセスしましょう。

### エラー 3: 型の不一致

数値と文字列を比較する場合は、型に注意しましょう。

{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .count 10}}"
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .event.type \"app_mention\"}}"
}
```
{% endraw %}
{% endraw %}

2. **"incident" という単語を含む mention のみ:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .event.type \"app_mention\") (eq .type \"event_callback\")}}"
}
```
{% endraw %}
{% endraw %}

3. **特定のチャンネルからの mention のみ:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .event.type \"app_mention\") (eq .event.channel \"C11111\")}}"
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .event_type \"triggered\"}}"
}
```
{% endraw %}
{% endraw %}

2. **CPU使用率が90%以上の時:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .alert_metric \"system.cpu.user\") (gt .current_value 90)}}"
}
```
{% endraw %}
{% endraw %}

3. **本番環境のメトリクスアラートのみ（簡易チェック）:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .alert_type \"metric_alert\") (eq .event_type \"triggered\")}}"
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .event.event_type \"incident.triggered\"}}"
}
```
{% endraw %}
{% endraw %}

2. **高緊急度のインシデントのみ:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .event.event_type \"incident.triggered\") (eq .event.data.urgency \"high\")}}"
}
```
{% endraw %}
{% endraw %}

3. **特定のサービスの高緊急度インシデント:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .event.event_type \"incident.triggered\") (eq .event.data.urgency \"high\") (eq .event.data.service.id \"SERVICE123\")}}"
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .action \"created\"}}"
}
```
{% endraw %}
{% endraw %}

2. **エラーレベルのイベントのみ:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .action \"created\") (eq .data.issue.level \"error\")}}"
}
```
{% endraw %}
{% endraw %}

3. **特定のプロジェクトのエラー:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .action \"created\") (eq .data.issue.project.slug \"production-web\") (eq .data.issue.level \"error\")}}"
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .type \"workflow-completed\"}}"
}
```
{% endraw %}
{% endraw %}

2. **ビルドが失敗した時:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .type \"workflow-completed\") (eq .workflow.status \"failed\")}}"
}
```
{% endraw %}
{% endraw %}

3. **mainブランチのビルドが失敗した時:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .type \"workflow-completed\") (eq .workflow.status \"failed\") (eq .pipeline.vcs.branch \"main\")}}"
}
```
{% endraw %}
{% endraw %}

4. **本番デプロイワークフローが成功した時:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .type \"workflow-completed\") (eq .workflow.name \"build-and-deploy\") (eq .workflow.status \"success\") (eq .pipeline.vcs.branch \"main\")}}"
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .type \"payment_intent.succeeded\"}}"
}
```
{% endraw %}
{% endraw %}

2. **$100以上の支払いが成功した時:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .type \"payment_intent.succeeded\") (ge .data.object.amount 10000)}}"
}
```
{% endraw %}
{% endraw %}

3. **本番環境のProプラン支払い:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .type \"payment_intent.succeeded\") (eq .livemode true) (eq .data.object.metadata.plan \"pro\")}}"
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .status \"failure\"}}"
}
```
{% endraw %}
{% endraw %}

2. **mainブランチのCIが失敗した時:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .workflow \"CI\") (eq .branch \"main\") (eq .status \"failure\")}}"
}
```
{% endraw %}
{% endraw %}

3. **特定のユーザーのコミットで失敗した時:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .status \"failure\") (eq .author \"john.doe\")}}"
}
```
{% endraw %}
{% endraw %}

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
{% raw %}
{% raw %}
```json
{
  "go_template": "{{eq .event_type \"order_created\"}}"
}
```
{% endraw %}
{% endraw %}

2. **10,000円以上の高額注文:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .event_type \"order_created\") (ge .data.total_amount 10000)}}"
}
```
{% endraw %}
{% endraw %}

3. **高優先度のWeb注文:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .event_type \"order_created\") (eq .data.priority \"high\") (eq .metadata.source \"web\")}}"
}
```
{% endraw %}
{% endraw %}

4. **特定キャンペーンの東京への配送:**
{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (eq .event_type \"order_created\") (eq .metadata.campaign \"summer-sale\") (eq .data.shipping_address.prefecture \"Tokyo\")}}"
}
```
{% endraw %}
{% endraw %}

## 複数条件の組み合わせパターン

実際の運用では、複数の条件を組み合わせることが多くあります。以下は実践的なパターン例です。

### パターン 1: 環境とステータスの組み合わせ

{% raw %}
{% raw %}
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
{% endraw %}
{% endraw %}

### パターン 2: 数値の範囲チェック

{% raw %}
{% raw %}
```json
{
  "go_template": "{{and (gt .value 80) (le .value 100)}}"
}
```
{% endraw %}
{% endraw %}

### パターン 3: 複数のイベントタイプ

{% raw %}
{% raw %}
```json
{
  "go_template": "{{or (eq .event_type \"error\") (eq .event_type \"critical\") (eq .event_type \"emergency\")}}"
}
```
{% endraw %}
{% endraw %}

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
