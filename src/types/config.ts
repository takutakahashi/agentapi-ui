/**
 * アプリケーション設定の型定義
 * /api/config エンドポイントから取得される設定
 */

export type AuthMode = 'oauth_only' | 'api_key' | 'both';

export interface AppConfig {
  /** 認証モード: oauth_only, api_key, both */
  authMode: AuthMode;
  /** ログインページのタイトル */
  loginTitle: string;
  /** ログインページの説明文 */
  loginDescription: string;
  /** ログインページのサブ説明文 */
  loginSubDescription: string;
  /** 有効なOAuthプロバイダー */
  oauthProviders: string[];
}

/** デフォルト設定 */
export const DEFAULT_CONFIG: AppConfig = {
  authMode: 'both',
  loginTitle: 'AgentAPI UI',
  loginDescription: 'Enter your API key or sign in with GitHub to continue.',
  loginSubDescription: 'API key can be any valid authentication token for your AgentAPI service.',
  oauthProviders: ['github'],
};
