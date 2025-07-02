# プロファイル非同期処理設計提案

## 概要

GitHub issue #189 のWeb Crypto API実装に向けて、プロファイル作成/変更処理の非同期化について検討した設計提案です。

## 結論

**プロファイル操作は基本的に同期処理として維持し、暗号化処理のみ必要最小限で非同期化する**ことを推奨します。

## 設計方針

### 1. 基本原則

- **ユーザビリティ優先**: プロファイル操作は即座に反映されるべき
- **最小限の非同期化**: Web Crypto API使用部分のみ
- **エラーハンドリング**: 暗号化エラーは即座にユーザーに通知
- **後方互換性**: 既存の同期的なAPI設計を維持

### 2. 非同期が必要な処理

#### A. 暗号化/復号化処理
```typescript
class CryptoStorage {
  static async encrypt(data: string): Promise<string> {
    // Web Crypto API による暗号化（非同期必須）
  }
  
  static async decrypt(encryptedData: string): Promise<string> {
    // Web Crypto API による復号化（非同期必須）
  }
}
```

#### B. プロファイル保存（ハイブリッド設計）
```typescript
class ProfileManager {
  static async saveProfile(profile: Profile): Promise<void> {
    if (await CryptoStorage.isEncryptionEnabled()) {
      // 暗号化が有効な場合のみ非同期
      const encryptedData = await CryptoStorage.encrypt(JSON.stringify(profile));
      localStorage.setItem(key, encryptedData);
    } else {
      // 従来通りの同期処理
      localStorage.setItem(key, JSON.stringify(profile));
    }
  }
}
```

### 3. 非同期が不要な理由

#### A. Web Crypto API のパフォーマンス
- 暗号化/復号化は数十ms程度の処理時間
- ユーザー体験を阻害するほどの遅延ではない
- await で完了を待つ方が確実

#### B. localStorage の特性
- 同期操作で十分高速
- データサイズも小さい（プロファイル情報）
- ブラウザによる最適化が効いている

#### C. エラーハンドリング
- 暗号化エラーは即座に通知が必要
- ユーザーが操作結果を確認できる
- 非同期でのサイレント失敗を防ぐ

### 4. 推奨実装パターン

#### A. プロファイル作成（推奨）
```typescript
static async createProfile(data: CreateProfileRequest): Promise<Profile> {
  const profile = this.buildProfile(data);
  await this.saveProfile(profile); // 暗号化のみ非同期
  this.updateProfilesList(); // 同期処理
  
  if (profile.isDefault) {
    this.setDefaultProfile(profile.id);
  }
  
  return profile;
}
```

#### B. 一括移行処理（バックグラウンド実行）
```typescript
static migrateAllProfilesToEncryption(): void {
  // Fire-and-forget パターン
  this.doMigrationInBackground()
    .catch(error => {
      console.error('Migration failed:', error);
      // ユーザーに通知
    });
}

private static async doMigrationInBackground(): Promise<void> {
  const profiles = this.getProfiles();
  for (const profileItem of profiles) {
    const profile = this.getProfile(profileItem.id);
    if (profile) {
      await this.saveProfile(profile); // 暗号化して再保存
    }
  }
}
```

### 5. UI側での対応

#### A. コンポーネントでの async/await
```typescript
const handleCreateProfile = async () => {
  try {
    setLoading(true);
    const profile = await ProfileManager.createProfile(formData);
    onProfileCreated(profile);
  } catch (error) {
    setError('Profile creation failed: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

#### B. エラー状態の表示
- 暗号化エラー時の適切なメッセージ表示
- ロード状態の視覚的フィードバック
- 操作完了の確認メッセージ

### 6. メリット・デメリット

#### メリット
- ✅ 暗号化処理の確実な実行
- ✅ エラーハンドリングの明確性
- ✅ 既存コードとの互換性維持
- ✅ ユーザビリティの保持

#### デメリット
- ❌ 若干のUI応答遅延（数十ms）
- ❌ async/await の追加によるコード複雑化
- ❌ 全コンポーネントでの対応が必要

### 7. 代替案との比較

#### A. 完全非同期化
```typescript
// ❌ 推奨しない
static createProfileAsync(data: CreateProfileRequest): void {
  this.addToJobQueue({ type: 'CREATE_PROFILE', data });
}
```
**問題点**: ユーザーが作成結果を即座に確認できない

#### B. 完全同期化
```typescript
// ❌ セキュリティリスク
static createProfile(data: CreateProfileRequest): Profile {
  // 暗号化なしでの保存
}
```
**問題点**: セキュリティ要件を満たせない

## 実装優先度

1. **高**: 暗号化処理の非同期化
2. **中**: プロファイル操作の async 対応
3. **低**: バックグラウンド移行処理
4. **低**: 詳細なエラーハンドリング

## 結論

プロファイル操作における非同期処理は**必要最小限に留める**べきです。Web Crypto API の暗号化処理のみを非同期化し、ユーザー操作は同期的な体験を維持することで、セキュリティとユーザビリティを両立できます。