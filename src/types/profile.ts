import { AgentApiProxySettings, EnvironmentVariable } from './settings';
import { RepositoryHistoryItem } from '../utils/repositoryHistory';

export interface Profile {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  agentApiProxy: AgentApiProxySettings;
  repositoryHistory: RepositoryHistoryItem[];
  environmentVariables: EnvironmentVariable[];
  isDefault: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileListItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isDefault: boolean;
  lastUsed?: string;
  repositoryCount: number;
}

export interface CreateProfileRequest {
  name: string;
  description?: string;
  icon?: string;
  agentApiProxy: AgentApiProxySettings;
  environmentVariables: EnvironmentVariable[];
  isDefault?: boolean;
}

export interface UpdateProfileRequest {
  name?: string;
  description?: string;
  icon?: string;
  agentApiProxy?: Partial<AgentApiProxySettings>;
  environmentVariables?: EnvironmentVariable[];
  isDefault?: boolean;
}