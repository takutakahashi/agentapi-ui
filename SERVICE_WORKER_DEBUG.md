# Service Worker デバッグガイド

## 問題の概要
Service Workerが正しく登録されない問題を調査・解決するためのガイドです。

## 実装した対策

### 1. 詳細なデバッグログの追加
`/src/components/ServiceWorkerRegistration.tsx` に以下のログを追加：
- コンポーネントのマウント確認
- Service Worker サポート状況
- 現在のURLとプロトコル情報
- sw.jsファイルのアクセシビリティテスト
- 既存の登録状況
- 登録プロセスの各ステップ

### 2. Content Security Policy (CSP) の更新
`next.config.js` のCSPヘッダーに `worker-src 'self'` を追加して、Service Workerの実行を許可

### 3. 手動Service Worker登録スクリプト
`/public/register-sw.js` を作成し、`layout.tsx` から読み込むように設定

### 4. 診断ツールの作成
- `/public/sw-test.html` - スタンドアロンのService Workerテストページ
- `/src/components/ServiceWorkerDiagnostics.tsx` - React コンポーネントベースの診断ツール
- `/sw-diagnostics` - 診断ページ（アプリ内で利用可能）

## デバッグ手順

### 1. ブラウザコンソールで確認
```javascript
// Service Worker のサポート状況を確認
console.log('SW Support:', 'serviceWorker' in navigator);

// 現在の登録を確認
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registrations:', regs);
});

// sw.jsファイルのアクセシビリティを確認
fetch('/sw.js').then(res => {
  console.log('sw.js status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
});
```

### 2. 診断ページの利用
1. アプリケーションで `/sw-diagnostics` にアクセス
2. または `/sw-test.html` に直接アクセス
3. 表示される情報を確認：
   - Service Workerサポート状況
   - セキュアコンテキストの確認
   - sw.jsファイルのアクセシビリティ
   - 現在の登録状況
   - ページコントローラー情報

### 3. ネットワークタブでの確認
1. DevTools > Network タブを開く
2. ページをリロード
3. `sw.js` のリクエストを確認
4. ステータスコードとレスポンスヘッダーを確認

### 4. Application タブでの確認
1. DevTools > Application > Service Workers
2. 登録されているService Workerの一覧を確認
3. Status、Source、Clients を確認

## よくある問題と解決方法

### 問題1: Service Workerが登録されない
**原因と解決方法:**
- HTTPSまたはlocalhostでアクセスしているか確認
- ブラウザのService Worker設定が有効か確認
- 拡張機能が干渉していないか確認（プライベートウィンドウで試す）

### 問題2: sw.jsが404エラー
**原因と解決方法:**
- `bun run build` でビルドを実行
- `/public/sw.js` が生成されているか確認
- Next.jsの開発サーバーを再起動

### 問題3: CSPエラー
**原因と解決方法:**
- ブラウザコンソールでCSP違反を確認
- `next.config.js` の CSP設定に `worker-src 'self'` が含まれているか確認

### 問題4: 開発環境で動作しない
**原因と解決方法:**
- `next.config.js` で `disable: false` が設定されているか確認
- next-pwa の設定で開発環境が明示的に有効化されているか確認

## next-pwaの設定確認
現在の設定（`next.config.js`）:
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // 自前で登録するため無効化
  skipWaiting: true,
  disable: false, // 開発環境でも有効
  fallbacks: {
    document: '/offline',
  },
})
```

## 推奨される次のステップ

1. **開発環境での確認**
   ```bash
   mise exec -- bun run dev
   ```
   その後、http://localhost:3000/sw-diagnostics にアクセス

2. **本番ビルドでの確認**
   ```bash
   mise exec -- bun run build
   mise exec -- bun run start
   ```

3. **Service Workerの手動登録テスト**
   ブラウザコンソールで：
   ```javascript
   navigator.serviceWorker.register('/sw.js', { scope: '/' })
     .then(reg => console.log('Success:', reg))
     .catch(err => console.error('Failed:', err));
   ```

4. **既存のService Workerをクリア**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => {
     regs.forEach(reg => reg.unregister());
   });
   ```

## 注意事項
- Service Worker は HTTPS または localhost でのみ動作します
- ブラウザの拡張機能が干渉する可能性があります
- キャッシュやCookieをクリアすると問題が解決することがあります
- Next.js 15 と next-pwa 5.6.0 の組み合わせで互換性の問題がある可能性があります