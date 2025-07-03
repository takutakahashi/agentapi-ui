import { AgentApiProxySettings, EnvironmentVariable } from './settings';
import { RepositoryHistoryItem } from '../utils/organizationHistory';
import { MessageTemplate } from './messageTemplate';
import {
  ProfileId,
  ProfileName,
  ProfileDescription,
  SystemPrompt,
  ISODateString,
  HexColor,
  EmojiIcon,
  ValidUrl,
  UUID,
  OrganizationName
} from './typeUtils';

export interface MCPServerConfig {
  id: UUID;
  name: string;
  endpoint: ValidUrl;
  enabled: boolean;
  transport: 'stdio' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

export interface Profile {
  id: ProfileId;
  name: ProfileName;
  description?: ProfileDescription;
  icon?: EmojiIcon;
  mainColor?: HexColor;
  systemPrompt?: SystemPrompt;
  fixedOrganizations: OrganizationName[];
  agentApiProxy: AgentApiProxySettings;
  repositoryHistory: RepositoryHistoryItem[];
  environmentVariables: EnvironmentVariable[];
  messageTemplates: MessageTemplate[];
  isDefault: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
  githubAuth?: GitHubAuthSettings;
  mcpServers?: MCPServerConfig[];
}

export interface GitHubAuthSettings {
  enabled: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: ISODateString;
  user?: GitHubUser;
  scopes: string[];
  organizations?: OrganizationName[];
  repositories?: string[];
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: ValidUrl;
}

export interface ProfileListItem {
  id: ProfileId;
  name: ProfileName;
  description?: ProfileDescription;
  icon?: EmojiIcon;
  mainColor?: HexColor;
  isDefault: boolean;
  lastUsed?: ISODateString;
  repositoryCount: number;
}

export interface CreateProfileRequest {
  name: ProfileName;
  description?: ProfileDescription;
  icon?: EmojiIcon;
  mainColor?: HexColor;
  systemPrompt?: SystemPrompt;
  fixedOrganizations: OrganizationName[];
  agentApiProxy: AgentApiProxySettings;
  environmentVariables: EnvironmentVariable[];
  isDefault?: boolean;
}

export interface UpdateProfileRequest {
  name?: ProfileName;
  description?: ProfileDescription;
  icon?: EmojiIcon;
  mainColor?: HexColor;
  systemPrompt?: SystemPrompt;
  fixedOrganizations?: OrganizationName[];
  agentApiProxy?: Partial<AgentApiProxySettings>;
  environmentVariables?: EnvironmentVariable[];
  messageTemplates?: MessageTemplate[];
  isDefault?: boolean;
  githubAuth?: GitHubAuthSettings;
  mcpServers?: MCPServerConfig[];
}