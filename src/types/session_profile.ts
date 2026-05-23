import { ResourceScope, SandboxConfig } from './agentapi';

// Session profile params
export interface SessionProfileParams {
  initial_message?: string;
  github_token?: string;
  sandbox?: SandboxConfig;
}

// Session profile config
export interface SessionProfileConfig {
  environment?: Record<string, string>;
  tags?: Record<string, string>;
  initial_message_template?: string;
  reuse_message_template?: string;
  reuse_session?: boolean;
  memory_key?: Record<string, string>;
  params?: SessionProfileParams;
}

// SessionProfile entity
export interface SessionProfile {
  id: string;
  name: string;
  description?: string;
  user_id?: string;
  scope?: ResourceScope;
  team_id?: string;
  is_default?: boolean;
  config?: SessionProfileConfig;
  created_at: string;
  updated_at: string;
}

// Create SessionProfile request
export interface CreateSessionProfileRequest {
  name: string;
  description?: string;
  scope?: ResourceScope;
  team_id?: string;
  is_default?: boolean;
  config?: SessionProfileConfig;
}

// Update SessionProfile request
export interface UpdateSessionProfileRequest {
  name?: string;
  description?: string;
  is_default?: boolean;
  config?: SessionProfileConfig;
}

// SessionProfile list parameters
export interface SessionProfileListParams {
  scope?: ResourceScope;
  team_id?: string;
}

// SessionProfile list response
export interface SessionProfileListResponse {
  session_profiles: SessionProfile[];
  total?: number;
  page?: number;
  limit?: number;
}
