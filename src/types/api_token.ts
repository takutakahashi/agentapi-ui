/**
 * API Token types for the agentapi-proxy multi-token management API.
 *
 * Backend contract:
 *   GET    /api-tokens?scope=personal
 *   GET    /api-tokens?scope=team&team_id=org%2Fteam
 *   POST   /api-tokens            -> returns the plaintext token exactly once
 *   GET    /api-tokens/:id        -> metadata only (no plaintext)
 *   DELETE /api-tokens/:id
 *
 * The list endpoint returns `{ items: [...] }`.
 */

/** Token scope. Note that the API uses `personal` (not `user`) for user tokens. */
export type ApiTokenScope = 'personal' | 'team';

/** Permissions offered when creating a token. Mirrors the proxy RBAC model. */
export const API_TOKEN_PERMISSIONS = [
  'session:create',
  'session:list',
  'session:delete',
  'session:access',
  '*',
] as const;

export type ApiTokenPermission = (typeof API_TOKEN_PERMISSIONS)[number];

/** Human-readable labels for the permission checkboxes. */
export const API_TOKEN_PERMISSION_LABELS: Record<ApiTokenPermission, string> = {
  'session:create': 'セッション作成 (session:create)',
  'session:list': 'セッション一覧 (session:list)',
  'session:delete': 'セッション削除 (session:delete)',
  'session:access': 'セッションアクセス (session:access)',
  '*': 'すべての操作 (*)',
};

/** Token metadata returned by list / GET / DELETE. Never contains plaintext. */
export interface ApiToken {
  id: string;
  name: string;
  /** Safe prefix of the token, e.g. `ap_user_abc…`. Never the full token. */
  token_prefix?: string;
  scope: ApiTokenScope;
  team_id?: string;
  permissions?: string[];
  /** Creator of the token (team scope only). */
  created_by?: string;
  created_at: string;
  /** ISO 8601 expiry timestamp, or null/undefined for no expiration. */
  expires_at?: string | null;
}

export interface ApiTokenListParams {
  scope: ApiTokenScope;
  team_id?: string;
}

export interface ApiTokenListResponse {
  items: ApiToken[];
}

export interface CreateApiTokenRequest {
  name: string;
  scope: ApiTokenScope;
  team_id?: string;
  permissions?: string[];
  /** ISO 8601 expiry timestamp, or null/omitted for no expiration. */
  expires_at?: string | null;
}

/**
 * Response from POST /api-tokens. Contains the full plaintext token exactly
 * once. The UI must never persist this value (no localStorage, no logs).
 */
export interface CreateApiTokenResponse {
  token: ApiToken;
  /** Plaintext API token. Shown once, then discarded. */
  plaintext_token: string;
}