# コンテナデプロイメントガイド

## VAPID キーの設定方法

このアプリケーションは2つの方式でVAPIDキーを設定できます：

### 1. Runtime Configuration（推奨：コンテナ対応）

```bash
# コンテナ起動時に環境変数を渡す
docker run -e VAPID_PUBLIC_KEY="your-public-key-here" -p 3000:3000 your-app:latest
```

### 2. Build-time Configuration（従来方式）

```bash
# ビルド時に環境変数を設定
docker build --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-key-here" .
```

## Docker Compose例

```yaml
version: '3.8'
services:
  agentapi-ui:
    image: your-registry/agentapi-ui:latest
    ports:
      - "3000:3000"
    environment:
      - VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
      - VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
      - VAPID_SUBJECT=${VAPID_SUBJECT}
    volumes:
      # 設定ファイルを外部マウントする場合（オプション）
      - ./config.js:/app/public/config.js:ro
```

## Kubernetes例

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agentapi-ui-config
data:
  VAPID_PUBLIC_KEY: "your-public-key-here"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentapi-ui
spec:
  template:
    spec:
      containers:
      - name: agentapi-ui
        image: your-registry/agentapi-ui:latest
        envFrom:
        - configMapRef:
            name: agentapi-ui-config
```

## VAPIDキーの生成

```bash
npx web-push generate-vapid-keys
```