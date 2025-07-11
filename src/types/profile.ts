import { AgentApiProxySettings, EnvironmentVariable } from './settings';
import { RepositoryHistoryItem } from '../utils/organizationHistory';
import { MessageTemplate } from './messageTemplate';

export interface MCPServerConfig {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  transport: 'stdio' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  mainColor?: string;
  systemPrompt?: string;
  fixedOrganizations: string[];
  agentApiProxy: AgentApiProxySettings;
  repositoryHistory: RepositoryHistoryItem[];
  environmentVariables: EnvironmentVariable[];
  messageTemplates: MessageTemplate[];
  isDefault: boolean;
  created_at: string;
  updated_at: string;
  githubAuth?: GitHubAuthSettings;
  mcpServers?: MCPServerConfig[];
}

export interface GitHubAuthSettings {
  enabled: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  sessionId?: string;
  expiresAt?: string;
  user?: GitHubUser;
  scopes: string[];
  organizations?: string[];
  repositories?: string[];
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface ProfileListItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  mainColor?: string;
  isDefault: boolean;
  lastUsed?: string;
  repositoryCount: number;
}

export interface CreateProfileRequest {
  name: string;
  description?: string;
  icon?: string;
  mainColor?: string;
  systemPrompt?: string;
  fixedOrganizations: string[];
  agentApiProxy: AgentApiProxySettings;
  environmentVariables: EnvironmentVariable[];
  isDefault?: boolean;
}

export interface UpdateProfileRequest {
  name?: string;
  description?: string;
  icon?: string;
  mainColor?: string;
  systemPrompt?: string;
  fixedOrganizations?: string[];
  agentApiProxy?: Partial<AgentApiProxySettings>;
  environmentVariables?: EnvironmentVariable[];
  messageTemplates?: MessageTemplate[];
  isDefault?: boolean;
  githubAuth?: GitHubAuthSettings;
  mcpServers?: MCPServerConfig[];
}