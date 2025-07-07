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

### Single Profile Mode の設定

Single Profile Modeを有効にすると、プロファイル切り替えUIが無効になり、単一のプロファイルとして動作します。

#### 1. Single Profile Mode の有効化

```yaml
singleProfileMode:
  enabled: true  # Single Profile Mode を有効化
  proxyUrl: "http://agentapi-proxy:8080"  # AgentAPI Proxy の URL
  publicProxyUrl: ""  # クライアントサイド用URL（省略可能、proxyUrlが使用される）
```

#### 2. カスタム設定でのインストール

```bash
helm install agentapi-ui ./helm/agentapi-ui \
  --set singleProfileMode.enabled=true \
  --set singleProfileMode.proxyUrl=http://my-proxy:8080 \
  --set singleProfileMode.publicProxyUrl=http://my-public-proxy:8080
```

#### 3. Single Profile Mode で必要なシークレット

Single Profile Mode を使用する場合は、Cookie暗号化シークレットも必要です：

```bash
# Cookie暗号化用の32バイト（64文字の16進数）キーを生成
COOKIE_ENCRYPTION_SECRET=$(openssl rand -hex 32)

# 暗号化キーと一緒にシークレットを作成
kubectl create secret generic agentapi-ui-encryption \
  --from-literal=encryption-key=$(openssl rand -base64 32) \
  --from-literal=cookie-encryption-secret=$COOKIE_ENCRYPTION_SECRET
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