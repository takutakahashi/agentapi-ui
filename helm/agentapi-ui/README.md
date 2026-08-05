# agentapi-ui Helm Chart

このHelm ChartはAgentAPI UIアプリケーションをKubernetesにデプロイするためのものです。

## インストール

```bash
helm install agentapi-ui ./helm/agentapi-ui
```

デフォルトの `values.yaml` が1 replicaの最小構成です。認証Cookie用Secretは
事前作成し、backendのService名がデフォルトと異なる場合だけ
`config.proxyUrl`を指定してください。

## 設定

### 暗号化キーの設定

このアプリケーションは、Cookie内のAPIキーを暗号化するために
**COOKIE_ENCRYPTION_SECRET**（64文字の16進数文字列）を必要とします。
暗号化キーはKubernetesシークレットから取得するように設定されています。

#### 1. シークレットの作成

まず、Cookie暗号化キーを含むKubernetesシークレットを作成します：

```bash
# Cookie暗号化用の32バイト（64文字の16進数）キーを生成
COOKIE_ENCRYPTION_SECRET=$(openssl rand -hex 32)

# シークレットを作成
kubectl create secret generic agentapi-ui-encryption \
  --from-literal=cookie-encryption-secret=$COOKIE_ENCRYPTION_SECRET
```

#### 2. Helmの設定

`values.yaml`で暗号化キーの設定をカスタマイズできます：

```yaml
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
  --set cookieEncryptionSecret.secretName=my-custom-secret \
  --set cookieEncryptionSecret.secretKey=my-cookie-key
```

### OAuth Only Mode の設定

OAuth Only Modeを有効にすると、APIキーログインが無効になり、GitHub OAuth認証のみが表示されます。

公開URLは通常hostnameとIngress TLS設定から自動生成されます。リバースプロキシなどで
外部URLが異なる場合は `config.publicUrl` に完全なURLを指定してください。

#### 1. OAuth Only Mode の有効化

```yaml
oauthOnlyMode:
  enabled: true  # OAuth Only Mode を有効化
  proxyUrl: "http://agentapi-proxy:8080"  # AgentAPI Proxy の URL
```

#### 2. カスタム設定でのインストール

```bash
helm install agentapi-ui ./helm/agentapi-ui \
  --set oauthOnlyMode.enabled=true \
  --set oauthOnlyMode.proxyUrl=http://my-proxy:8080 \
  --set config.publicUrl=https://agentapi.example.com
```

#### 3. OAuth Only Mode で必要なシークレット

OAuth Only Mode を使用する場合は、Cookie暗号化シークレットが必要です：

```bash
# Cookie暗号化用の32バイト（64文字の16進数）キーを生成
COOKIE_ENCRYPTION_SECRET=$(openssl rand -hex 32)

# シークレットを作成
kubectl create secret generic agentapi-ui-encryption \
  --from-literal=cookie-encryption-secret=$COOKIE_ENCRYPTION_SECRET
```

#### 4. 注意事項

- OAuth Only Mode を使用するには、agentapi-proxy側でGitHub OAuthが設定されている必要があります。

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
