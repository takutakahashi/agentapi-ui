# GitHub Webhook

GitHub Webhook 機能を使うと、GitHub からのイベント（プルリクエスト、Issue、プッシュなど）を受け取り、AI エージェントと連携できます。

## 初期メッセージテンプレートで使える変数

GitHub Webhook の初期メッセージテンプレートは、Go Template 形式を使用しています。`{{` と `}}` で囲まれた変数名を使用して、webhook ペイロードから値を取得できます。

### 基本構文

{% raw %}
```
{{.フィールド名}}
{{.オブジェクト名.フィールド名}}
```
{% endraw %}

### 共通フィールド（すべてのイベントで利用可能）

{% raw %}
| 変数 | 説明 | 例 |
|------|------|-----|
| `{{.action}}` | イベントのアクション | `opened`, `closed`, `synchronize` |
| `{{.repository.Name}}` | リポジトリ名 | `agentapi-ui` |
| `{{.repository.FullName}}` | オーナー/リポジトリ名 | `coder/agentapi-ui` |
| `{{.repository.HTMLURL}}` | リポジトリのURL | `https://github.com/coder/agentapi-ui` |
| `{{.sender.Login}}` | イベント送信者のユーザー名 | `octocat` |
| `{{.sender.HTMLURL}}` | 送信者のプロフィールURL | `https://github.com/octocat` |
{% endraw %}

### Pull Request イベント

`pull_request` イベントで使える変数：

{% raw %}
| 変数 | 説明 | 例 |
|------|------|-----|
| `{{.pull_request.Number}}` | プルリクエスト番号 | `123` |
| `{{.pull_request.Title}}` | プルリクエストのタイトル | `Fix: Update user validation` |
| `{{.pull_request.Body}}` | プルリクエストの説明 | `This PR fixes...` |
| `{{.pull_request.State}}` | プルリクエストの状態 | `open`, `closed` |
| `{{.pull_request.HTMLURL}}` | プルリクエストのURL | `https://github.com/org/repo/pull/123` |
| `{{.pull_request.User.Login}}` | プルリクエスト作成者 | `octocat` |
| `{{.pull_request.Head.Ref}}` | ソースブランチ名 | `feature/new-feature` |
| `{{.pull_request.Head.SHA}}` | ソースブランチのコミットSHA | `abc123def456...` |
| `{{.pull_request.Base.Ref}}` | ターゲットブランチ名 | `main` |
| `{{.pull_request.Base.SHA}}` | ターゲットブランチのコミットSHA | `def456abc123...` |
| `{{.pull_request.Draft}}` | ドラフトかどうか | `true`, `false` |
| `{{.pull_request.Merged}}` | マージ済みかどうか | `true`, `false` |
| `{{.pull_request.Mergeable}}` | マージ可能かどうか | `true`, `false` |
{% endraw %}

### Issues イベント

`issues` イベントで使える変数：

{% raw %}
| 変数 | 説明 | 例 |
|------|------|-----|
| `{{.issue.Number}}` | Issue 番号 | `456` |
| `{{.issue.Title}}` | Issue のタイトル | `Bug: Login fails` |
| `{{.issue.Body}}` | Issue の本文 | `Steps to reproduce...` |
| `{{.issue.State}}` | Issue の状態 | `open`, `closed` |
| `{{.issue.HTMLURL}}` | Issue のURL | `https://github.com/org/repo/issues/456` |
| `{{.issue.User.Login}}` | Issue 作成者 | `octocat` |
| `{{.issue.Assignee.Login}}` | アサインされたユーザー | `reviewer1` |
{% endraw %}

### Issue Comment イベント

`issue_comment` イベントで使える変数：

{% raw %}
| 変数 | 説明 | 例 |
|------|------|-----|
| `{{.comment.Body}}` | コメントの本文 | `Looks good to me!` |
| `{{.comment.HTMLURL}}` | コメントのURL | `https://github.com/org/repo/issues/456#comment-123` |
| `{{.comment.User.Login}}` | コメント投稿者 | `octocat` |
| `{{.issue.Number}}` | Issue/PR 番号 | `456` |
| `{{.issue.Title}}` | Issue/PR のタイトル | `Bug: Login fails` |
{% endraw %}

### Pull Request Review イベント

`pull_request_review` イベントで使える変数：

{% raw %}
| 変数 | 説明 | 例 |
|------|------|-----|
| `{{.review.Body}}` | レビューコメント | `Overall looks good...` |
| `{{.review.State}}` | レビューの状態 | `approved`, `changes_requested`, `commented` |
| `{{.review.HTMLURL}}` | レビューのURL | `https://github.com/org/repo/pull/123#review-456` |
| `{{.review.User.Login}}` | レビュアー | `reviewer1` |
| `{{.pull_request.Number}}` | プルリクエスト番号 | `123` |
| `{{.pull_request.Title}}` | プルリクエストのタイトル | `Fix: Update user validation` |
{% endraw %}

### Push イベント

`push` イベントで使える変数：

{% raw %}
| 変数 | 説明 | 例 |
|------|------|-----|
| `{{.ref}}` | ブランチ参照 | `refs/heads/main` |
| `{{.before}}` | プッシュ前のコミットSHA | `abc123...` |
| `{{.after}}` | プッシュ後のコミットSHA | `def456...` |
| `{{.commits}}` | コミットの配列 | `[...]` |
| `{{.head_commit.Message}}` | 最新コミットメッセージ | `Fix bug in user service` |
| `{{.head_commit.Author.Name}}` | コミット作成者名 | `John Doe` |
| `{{.pusher.Name}}` | プッシュしたユーザー名 | `octocat` |
{% endraw %}

## 実用例

{% raw %}

### 例 1: Pull Request のレビュー依頼

```
Review PR #{{.pull_request.Number}}: "{{.pull_request.Title}}" in {{.repository.FullName}}

Created by: @{{.pull_request.User.Login}}
Branch: {{.pull_request.Head.Ref}} → {{.pull_request.Base.Ref}}
URL: {{.pull_request.HTMLURL}}
```
{% endraw %}

**出力例:**
```
Review PR #123: "Fix: Update user validation" in coder/agentapi-ui

Created by: @octocat
Branch: feature/validation → main
URL: https://github.com/coder/agentapi-ui/pull/123
```

### 例 2: Issue のトリアージ

{% raw %}
```
New issue #{{.issue.Number}}: {{.issue.Title}}

Reporter: @{{.issue.User.Login}}
Repository: {{.repository.FullName}}
URL: {{.issue.HTMLURL}}

Please review and add appropriate labels.
```
{% endraw %}

**出力例:**
```
New issue #456: Bug: Login fails

Reporter: @octocat
Repository: coder/agentapi-ui
URL: https://github.com/coder/agentapi-ui/issues/456

Please review and add appropriate labels.
```

### 例 3: Pull Request Review コメント

{% raw %}
```
@{{.review.User.Login}} reviewed PR #{{.pull_request.Number}}: {{.review.State}}

PR: "{{.pull_request.Title}}"
Review: {{.review.HTMLURL}}

Please address the feedback and update the PR.
```
{% endraw %}

**出力例:**
```
@reviewer1 reviewed PR #123: changes_requested

PR: "Fix: Update user validation"
Review: https://github.com/coder/agentapi-ui/pull/123#review-456

Please address the feedback and update the PR.
```

### 例 4: 条件分岐を含むテンプレート

Go Template では条件分岐も使用できます：

{% raw %}
```
{{if .pull_request.Draft}}
Draft PR #{{.pull_request.Number}} by @{{.pull_request.User.Login}}
This is a work-in-progress PR. Do not merge yet.
{{else}}
PR #{{.pull_request.Number}} is ready for review
Review "{{.pull_request.Title}}" at {{.pull_request.HTMLURL}}
{{end}}
```
{% endraw %}

### 例 5: 配列要素へのアクセス

{% raw %}
```
Latest commit: {{.head_commit.Message}}
By: {{.head_commit.Author.Name}}
SHA: {{.after}}

Pushed to: {{.ref}}
Repository: {{.repository.FullName}}
```
{% endraw %}

## ベストプラクティス

### 1. 簡潔で明確なメッセージ

エージェントが理解しやすい、明確な指示を含めましょう。

✅ **良い例:**
{% raw %}
```
Review PR #{{.pull_request.Number}}: "{{.pull_request.Title}}"
Check code quality, test coverage, and documentation.
URL: {{.pull_request.HTMLURL}}
```
{% endraw %}

❌ **悪い例:**
{% raw %}
```
PR {{.pull_request.Number}}
```
{% endraw %}

### 2. 必要な情報を含める

エージェントが作業を完了するために必要な情報をすべて含めましょう。

{% raw %}
```
PR #{{.pull_request.Number}} by @{{.pull_request.User.Login}}
Title: {{.pull_request.Title}}
Branch: {{.pull_request.Head.Ref}} → {{.pull_request.Base.Ref}}
URL: {{.pull_request.HTMLURL}}

Tasks:
1. Review code changes
2. Check test coverage
3. Verify documentation updates
4. Add review comments if needed
```
{% endraw %}

### 3. URLを含める

エージェントが直接アクセスできるよう、関連するURLを含めましょう。

{% raw %}
```
{{.pull_request.HTMLURL}}
{{.issue.HTMLURL}}
{{.repository.HTMLURL}}
```
{% endraw %}

### 4. コンテキストを提供

リポジトリ名やユーザー名など、コンテキスト情報を含めましょう。

{% raw %}
```
Repository: {{.repository.FullName}}
Author: @{{.sender.Login}}
Action: {{.action}}
```
{% endraw %}

## デバッグのコツ

### 1. シンプルなテンプレートから始める

最初は基本的な変数だけを使い、徐々に複雑にしていきましょう。

**ステップ 1:**
{% raw %}
```
PR #{{.pull_request.Number}}
```
{% endraw %}

**ステップ 2:**
{% raw %}
```
PR #{{.pull_request.Number}}: {{.pull_request.Title}}
```
{% endraw %}

**ステップ 3:**
{% raw %}
```
Review PR #{{.pull_request.Number}}: "{{.pull_request.Title}}" in {{.repository.FullName}}
```
{% endraw %}

### 2. Delivery Record を確認

Webhook の Delivery Record 機能を使って、実際に受信したペイロードと生成されたメッセージを確認できます。

### 3. 存在しないフィールドに注意

すべてのフィールドが常に存在するわけではありません。オプショナルなフィールドを使う場合は、条件分岐を使用することを検討してください。

{% raw %}
```
{{if .issue.Assignee}}
Assigned to: @{{.issue.Assignee.Login}}
{{else}}
Not assigned yet
{{end}}
```
{% endraw %}

## よくあるエラー

### エラー 1: 大文字小文字の間違い

Go の構造体フィールドは**大文字で始まる**必要があります。

❌ **間違い:**
{% raw %}
```
{{.pull_request.number}}  // 小文字
{{.repository.fullName}}  // キャメルケースの最初は小文字
```
{% endraw %}

✅ **正しい:**
{% raw %}
```
{{.pull_request.Number}}  // 大文字で始まる
{{.repository.FullName}}  // 大文字で始まる
```
{% endraw %}

### エラー 2: 存在しないフィールドへのアクセス

指定したイベントに存在しないフィールドにアクセスするとエラーになります。

❌ **間違い:**
{% raw %}
```
// push イベントで pull_request フィールドにアクセス
{{.pull_request.Number}}
```
{% endraw %}

✅ **正しい:**
{% raw %}
```
// pull_request イベントでのみ使用
{{if .pull_request}}
PR #{{.pull_request.Number}}
{{end}}
```
{% endraw %}

## 関連情報

- [Custom Webhook のテンプレート構文](../custom/go-template.md) - Go Template の詳細な説明
- [GitHub Webhook Events - GitHub Docs](https://docs.github.com/en/webhooks/webhook-events-and-payloads) - 公式ドキュメント
- [Webhook のトラブルシューティング](../troubleshooting/README.md) - 問題解決ガイド

## まとめ

GitHub Webhook の初期メッセージテンプレートを使うことで、各イベントに応じたカスタマイズされたメッセージを AI エージェントに送信できます。適切な変数を使用することで、エージェントが必要な情報をすべて受け取り、効率的に作業を実行できるようになります。
