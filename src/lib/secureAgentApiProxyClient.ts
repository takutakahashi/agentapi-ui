import {
  Session,
  SessionListParams,
  SessionListResponse,
  CreateSessionRequest,
  SessionMessage,
  SessionMessageListResponse,
  SessionMessageListParams,
  SendSessionMessageRequest,
  SessionEventData,
  SessionEventsOptions,
  Agent,
  AgentListResponse,
  AgentListParams
} from '../types/agentapi';
import { getDefaultProxySettings } from '../types/settings';
import { SecureProfileManager } from '../utils/secureProfileManager';
import { SecureSettings } from '../utils/secureSettings';
import { GitHubUser, MCPServerConfig } from '../types/profile';

// Define local AgentStatus type
interface AgentStatus {
  status: 'stable' | 'running' | 'error';
  last_activity?: string;
  current_task?: string;
}

export interface AgentAPIProxyClientConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  maxSessions?: number;
  sessionTimeout?: number;
  debug?: boolean;
  profileId?: string;
}

export class AgentAPIProxyError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentAPIProxyError';
  }
}

/**
 * セキュアなAgentAPIProxyClient
 * 暗号化されたプロファイル設定を使用
 */
export class SecureAgentAPIProxyClient {
  private baseURL: string;
  private apiKey?: string;
  private timeout: number;
  private maxSessions: number;
  private sessionTimeout: number;
  private debug: boolean;
  private profileId?: string;

  constructor(config: AgentAPIProxyClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000;
    this.maxSessions = config.maxSessions || 10;
    this.sessionTimeout = config.sessionTimeout || 300000; // 5 minutes
    this.debug = config.debug || false;
    this.profileId = config.profileId;

    if (this.debug) {
      console.log('[SecureAgentAPIProxy] Initialized with config:', {
        baseURL: this.baseURL,
        maxSessions: this.maxSessions,
        sessionTimeout: this.sessionTimeout
      });
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt = 1
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, application/problem+json',
    };

    // Try Bearer token first, then fallback to X-API-Key
    if (this.apiKey) {
      // First attempt with Bearer token
      const bearerHeaders = { ...defaultHeaders, 'Authorization': `Bearer ${this.apiKey}` };
      const bearerRequestOptions: RequestInit = {
        ...options,
        headers: {
          ...bearerHeaders,
          ...options.headers,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          ...bearerRequestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // If Bearer token fails with 401/403, try X-API-Key fallback
          if (response.status === 401 || response.status === 403) {
            const fallbackHeaders = { ...defaultHeaders, 'X-API-Key': this.apiKey };
            const fallbackController = new AbortController();
            const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), this.timeout);

            try {
              const fallbackResponse = await fetch(url, {
                ...options,
                headers: {
                  ...fallbackHeaders,
                  ...options.headers,
                },
                signal: fallbackController.signal,
              });

              clearTimeout(fallbackTimeoutId);

              if (!fallbackResponse.ok) {
                const errorText = await fallbackResponse.text();
                let errorDetails: any = {};
                
                try {
                  errorDetails = JSON.parse(errorText);
                } catch {
                  errorDetails = { message: errorText };
                }

                throw new AgentAPIProxyError(
                  fallbackResponse.status,
                  errorDetails.code || `HTTP_${fallbackResponse.status}`,
                  errorDetails.message || `Request failed: ${fallbackResponse.status} ${fallbackResponse.statusText}`,
                  errorDetails
                );
              }

              const fallbackData = await fallbackResponse.json();
              return fallbackData;
            } catch (error) {
              clearTimeout(fallbackTimeoutId);
              if (error instanceof AgentAPIProxyError) {
                throw error;
              }
              throw new AgentAPIProxyError(
                0,
                'NETWORK_ERROR',
                `Network error on fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }

          const errorText = await response.text();
          let errorDetails: any = {};
          
          try {
            errorDetails = JSON.parse(errorText);
          } catch {
            errorDetails = { message: errorText };
          }

          throw new AgentAPIProxyError(
            response.status,
            errorDetails.code || `HTTP_${response.status}`,
            errorDetails.message || `Request failed: ${response.status} ${response.statusText}`,
            errorDetails
          );
        }

        const data = await response.json();
        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof AgentAPIProxyError) {
          throw error;
        }
        throw new AgentAPIProxyError(
          0,
          'NETWORK_ERROR',
          `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // No API key case
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails: any = {};
        
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { message: errorText };
        }

        throw new AgentAPIProxyError(
          response.status,
          errorDetails.code || `HTTP_${response.status}`,
          errorDetails.message || `Request failed: ${response.status} ${response.statusText}`,
          errorDetails
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof AgentAPIProxyError) {
        throw error;
      }
      throw new AgentAPIProxyError(
        0,
        'NETWORK_ERROR',
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Session management methods
  async getSessions(params?: SessionListParams): Promise<SessionListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page !== undefined) searchParams.set('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.user_id) searchParams.set('user_id', params.user_id);

    const endpoint = `/sessions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest<SessionListResponse>(endpoint);
  }

  async getSession(id: string): Promise<Session> {
    return this.makeRequest<Session>(`/sessions/${id}`);
  }

  async createSession(data: CreateSessionRequest): Promise<Session> {
    return this.makeRequest<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSession(id: string): Promise<void> {
    return this.makeRequest<void>(`/sessions/${id}`, {
      method: 'DELETE',
    });
  }

  // Session message methods
  async getSessionMessages(sessionId: string, params?: SessionMessageListParams): Promise<SessionMessageListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page !== undefined) searchParams.set('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());

    const endpoint = `/sessions/${sessionId}/messages${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest<SessionMessageListResponse>(endpoint);
  }

  async sendSessionMessage(sessionId: string, data: SendSessionMessageRequest): Promise<SessionMessage> {
    return this.makeRequest<SessionMessage>(`/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Agent methods
  async getAgents(params?: AgentListParams): Promise<AgentListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page !== undefined) searchParams.set('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);

    const endpoint = `/agents${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest<AgentListResponse>(endpoint);
  }

  async getAgent(id: string): Promise<Agent> {
    return this.makeRequest<Agent>(`/agents/${id}`);
  }

  // Session events (Server-Sent Events)
  async *streamSessionEvents(sessionId: string, options?: SessionEventsOptions): AsyncIterableIterator<SessionEventData> {
    const searchParams = new URLSearchParams();
    // Note: SessionEventsOptions doesn't have lastEventId in the type definition
    // This would need to be added to the type if required

    const url = `${this.baseURL}/sessions/${sessionId}/events${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    const headers: HeadersInit = {
      'Accept': 'text/event-stream',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AgentAPIProxyError(
        response.status,
        `HTTP_${response.status}`,
        `Failed to connect to event stream: ${response.status} ${response.statusText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new AgentAPIProxyError(0, 'STREAM_ERROR', 'Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              yield data;
            } catch (error) {
              console.warn('Failed to parse SSE data:', error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest<{ status: string; timestamp: string }>('/health');
  }

  // Agent status
  async getAgentStatus(agentId: string): Promise<AgentStatus> {
    return this.makeRequest<AgentStatus>(`/agents/${agentId}/status`);
  }
}

// Utility function to collect MCP configurations from settings and profiles
async function collectMCPConfigurations(repoFullname?: string, profileId?: string): Promise<MCPServerConfig[]> {
  const mcpConfigs: MCPServerConfig[] = [];
  
  try {
    // Get global settings first
    const globalSettings = await SecureSettings.loadGlobalSettings();
    if (globalSettings.mcpServers) {
      mcpConfigs.push(...globalSettings.mcpServers.filter(server => server.enabled));
    }
    
    // Get repository-specific settings
    if (repoFullname) {
      const repoSettings = await SecureSettings.loadRepositorySettings(repoFullname);
      if (repoSettings.mcpServers) {
        const repoMcpConfigs = repoSettings.mcpServers.filter(server => server.enabled);
        
        // Merge with global configs, repo configs take precedence
        for (const repoConfig of repoMcpConfigs) {
          const existingIndex = mcpConfigs.findIndex(config => config.id === repoConfig.id);
          if (existingIndex >= 0) {
            mcpConfigs[existingIndex] = repoConfig;
          } else {
            mcpConfigs.push(repoConfig);
          }
        }
      }
    }
    
    // Get profile-specific settings
    if (profileId) {
      const profile = await SecureProfileManager.getProfile(profileId);
      if (profile && profile.mcpServers) {
        const profileMcpConfigs = profile.mcpServers.filter(server => server.enabled);
        
        // Merge profile configs with global ones, profile takes precedence
        for (const profileConfig of profileMcpConfigs) {
          const existingIndex = mcpConfigs.findIndex(config => config.id === profileConfig.id);
          if (existingIndex >= 0) {
            mcpConfigs[existingIndex] = profileConfig;
          } else {
            mcpConfigs.push(profileConfig);
          }
        }
      }
    }
    
    // If no profile specified, try to get current profile
    if (!profileId) {
      const currentProfileId = SecureProfileManager.getCurrentProfileId();
      if (currentProfileId) {
        const profile = await SecureProfileManager.getProfile(currentProfileId);
        if (profile && profile.mcpServers) {
          const profileMcpConfigs = profile.mcpServers.filter(server => server.enabled);
          
          for (const profileConfig of profileMcpConfigs) {
            const existingIndex = mcpConfigs.findIndex(config => config.id === profileConfig.id);
            if (existingIndex >= 0) {
              mcpConfigs[existingIndex] = profileConfig;
            } else {
              mcpConfigs.push(profileConfig);
            }
          }
        }
      }
    }
    
    // If still no profile, try default profile
    if (!profileId) {
      const defaultProfile = await SecureProfileManager.getDefaultProfile();
      if (defaultProfile && defaultProfile.mcpServers) {
        const defaultMcpConfigs = defaultProfile.mcpServers.filter(server => server.enabled);
        
        for (const defaultConfig of defaultMcpConfigs) {
          const existingIndex = mcpConfigs.findIndex(config => config.id === defaultConfig.id);
          if (existingIndex >= 0) {
            mcpConfigs[existingIndex] = defaultConfig;
          } else {
            mcpConfigs.push(defaultConfig);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error collecting MCP configurations:', error);
  }
  
  return mcpConfigs;
}

// Utility functions to get proxy settings from secure browser storage
export async function getSecureAgentAPIProxyConfigFromStorage(repoFullname?: string, profileId?: string): Promise<AgentAPIProxyClientConfig> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side rendering or Node.js environment - use environment variables
    return {
      baseURL: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
      apiKey: process.env.AGENTAPI_API_KEY,
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
      sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
      debug: process.env.NODE_ENV === 'development',
      profileId,
    };
  }
  
  let settings;
  
  try {
    // First, try to get settings from profile if profileId is provided
    if (profileId) {
      const profile = await SecureProfileManager.getProfile(profileId);
      if (profile) {
        settings = {
          agentApiProxy: profile.agentApiProxy,
          environmentVariables: profile.environmentVariables
        };
        
        // Mark profile as used (debounced to prevent excessive calls)
        SecureProfileManager.markProfileUsed(profileId);
        
        // Add repository to profile history if repoFullname is provided
        if (repoFullname) {
          await SecureProfileManager.addRepositoryToProfile(profileId, repoFullname);
        }
      }
    }
    
    // If no profile settings found, check for current profile (including URL parameters)
    if (!settings) {
      const currentProfileId = SecureProfileManager.getCurrentProfileId();
      if (currentProfileId) {
        const profile = await SecureProfileManager.getProfile(currentProfileId);
        if (profile) {
          settings = {
            agentApiProxy: profile.agentApiProxy,
            environmentVariables: profile.environmentVariables
          };
          
          // Mark profile as used (debounced to prevent excessive calls)
          SecureProfileManager.markProfileUsed(currentProfileId);
          
          // Add repository to profile history if repoFullname is provided
          if (repoFullname) {
            await SecureProfileManager.addRepositoryToProfile(currentProfileId, repoFullname);
          }
        }
      }
    }
    
    // If still no profile settings found, fall back to default profile
    if (!settings) {
      const defaultProfile = await SecureProfileManager.getDefaultProfile();
      if (defaultProfile) {
        settings = {
          agentApiProxy: defaultProfile.agentApiProxy,
          environmentVariables: defaultProfile.environmentVariables
        };
        
        // Mark default profile as used (debounced to prevent excessive calls)
        SecureProfileManager.markProfileUsed(defaultProfile.id);
        
        // Add repository to default profile history if repoFullname is provided
        if (repoFullname) {
          await SecureProfileManager.addRepositoryToProfile(defaultProfile.id, repoFullname);
        }
      }
    }
    
    // If still no settings, fall back to default proxy settings
    if (!settings) {
      const defaultProxySettings = getDefaultProxySettings();
      const globalSettings = await SecureSettings.loadGlobalSettings();
      settings = {
        agentApiProxy: defaultProxySettings,
        environmentVariables: globalSettings.environmentVariables
      };
    }
    
    // Use proxy configuration
    const baseURL = settings.agentApiProxy.enabled 
      ? settings.agentApiProxy.endpoint 
      : (process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080');
    
    const timeout = settings.agentApiProxy.enabled 
      ? settings.agentApiProxy.timeout 
      : parseInt(process.env.AGENTAPI_TIMEOUT || '10000');
    
    return {
      baseURL,
      apiKey: settings.agentApiProxy.apiKey || process.env.AGENTAPI_API_KEY,
      timeout,
      maxSessions: 10,
      sessionTimeout: 300000, // 5 minutes
      debug: process.env.NODE_ENV === 'development',
      profileId,
    };
  } catch (error) {
    console.warn('Failed to load proxy settings from secure storage, using environment variables:', error);
    // Fallback to environment variables if storage access fails
    return {
      baseURL: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
      apiKey: process.env.AGENTAPI_API_KEY,
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
      sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
      debug: process.env.NODE_ENV === 'development',
      profileId,
    };
  }
}

// Factory function for easier client creation
export function createSecureAgentAPIProxyClient(config: AgentAPIProxyClientConfig): SecureAgentAPIProxyClient {
  return new SecureAgentAPIProxyClient(config);
}

// Factory function to create client using secure stored settings (async)
export async function createSecureAgentAPIProxyClientFromStorage(repoFullname?: string, profileId?: string): Promise<SecureAgentAPIProxyClient> {
  const config = await getSecureAgentAPIProxyConfigFromStorage(repoFullname, profileId);
  return new SecureAgentAPIProxyClient(config);
}

// Export for backward compatibility (will be async)
export async function createAgentAPIProxyClientFromSecureStorage(repoFullname?: string, profileId?: string): Promise<SecureAgentAPIProxyClient> {
  return createSecureAgentAPIProxyClientFromStorage(repoFullname, profileId);
}