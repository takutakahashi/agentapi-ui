# agentapi-ui Helm Chart

このHelm ChartはAgentAPI UIアプリケーションをKubernetesにデプロイするためのものです。

## インストール

```bash
helm install agentapi-ui ./helm/agentapi-ui
```

## 設定

### 暗号化キーの設定

このアプリケーションは、セキュアなデータの暗号化のために2つの暗号化キーを必要とします：
- **ENCRYPTION_KEY**: 一般的なデータ暗号化用
- **COOKIE_ENCRYPTION_SECRET**: Cookie内のAPIキー暗号化用（64文字の16進数文字列）

両方の暗号化キーはKubernetesシークレットから取得するように設定されています。

#### 1. シークレットの作成

まず、両方の暗号化キーを含むKubernetesシークレットを作成します：

```bash
# ランダムな32バイト（256ビット）のキーを生成
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Cookie暗号化用の32バイト（64文字の16進数）キーを生成
COOKIE_ENCRYPTION_SECRET=$(openssl rand -hex 32)

# シークレットを作成
kubectl create secret generic agentapi-ui-encryption \
  --from-literal=encryption-key=$ENCRYPTION_KEY \
  --from-literal=cookie-encryption-secret=$COOKIE_ENCRYPTION_SECRET
```

#### 2. Helmの設定

`values.yaml`で暗号化キーの設定をカスタマイズできます：

```yaml
# 一般的な暗号化キーの設定
encryptionKey:
  enabled: true  # 暗号化キーをシークレットから取得する機能を有効化
  secretName: "agentapi-ui-encryption"  # シークレット名
  secretKey: "encryption-key"  # シークレット内のキー名

# Cookie暗号化キーの設定
cookieEncryptionSecret:
  enabled: true  # Cookie暗号化キーをシークレットから取得する機能を有効化
  secretName: "agentapi-ui-encryption"  # シークレット名
  secretKey: "cookie-encryption-secret"  # シークレット内のキー名
```

#### 3. カスタム値でのインストール

異なるシークレット名やキー名を使用する場合は、インストール時に値を指定できます：

```bash
helm install agentapi-ui ./helm/agentapi-ui \
  --set encryptionKey.secretName=my-custom-secret \
  --set encryptionKey.secretKey=my-encryption-key \
  --set cookieEncryptionSecret.secretName=my-custom-secret \
  --set cookieEncryptionSecret.secretKey=my-cookie-key
```

### その他の設定

その他の設定オプションについては、`values.yaml`ファイルを参照してください。

## アップグレード

```bash
helm upgrade agentapi-ui ./helm/agentapi-ui
```

## アンインストール

```bash
helm uninstall agentapi-ui
```