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
import { loadGlobalSettings, getDefaultProxySettings } from '../types/settings';
import { ProfileManager } from '../utils/profileManager';
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
 * AgentAPIProxyClient handles session management and communicates directly with agentapi-proxy.
 */
export class AgentAPIProxyClient {
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
      console.log('[AgentAPIProxy] Initialized with config:', {
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

      if (this.debug) {
        console.log(`[AgentAPIProxy] ${options.method || 'GET'} ${url} (Bearer token)`, {
          headers: bearerRequestOptions.headers,
          body: options.body,
          attempt,
        });
      }

      try {
        const response = await fetch(url, bearerRequestOptions);

        if (!response.ok) {
          // If Bearer token fails with 401/403, try X-API-Key fallback
          if (response.status === 401 || response.status === 403) {
            const fallbackHeaders = { ...defaultHeaders, 'X-API-Key': this.apiKey };
            const fallbackRequestOptions: RequestInit = {
              ...options,
              headers: {
                ...fallbackHeaders,
                ...options.headers,
              },
            };

            if (this.debug) {
              console.log(`[AgentAPIProxy] ${options.method || 'GET'} ${url} (X-API-Key fallback)`, {
                headers: fallbackRequestOptions.headers,
                body: options.body,
                attempt,
              });
            }

            const fallbackResponse = await fetch(url, fallbackRequestOptions);

            if (!fallbackResponse.ok) {
              const errorData = await fallbackResponse.json().catch(() => ({
                error: {
                  code: 'UNKNOWN_ERROR',
                  message: `HTTP ${fallbackResponse.status}: ${fallbackResponse.statusText}`,
                  timestamp: new Date().toISOString(),
                }
              }));

              throw new AgentAPIProxyError(
                fallbackResponse.status,
                errorData.error?.code || 'UNKNOWN_ERROR',
                errorData.error?.message || `HTTP ${fallbackResponse.status}`,
                errorData.error?.details
              );
            }

            const fallbackData = await fallbackResponse.json();
            
            if (this.debug) {
              console.log(`[AgentAPIProxy] Response (fallback):`, { data: fallbackData });
            }

            return fallbackData;
          }

          const errorData = await response.json().catch(() => ({
            error: {
              code: 'UNKNOWN_ERROR',
              message: `HTTP ${response.status}: ${response.statusText}`,
              timestamp: new Date().toISOString(),
            }
          }));

          throw new AgentAPIProxyError(
            response.status,
            errorData.error?.code || 'UNKNOWN_ERROR',
            errorData.error?.message || `HTTP ${response.status}`,
            errorData.error?.details
          );
        }

        const data = await response.json();
        
        if (this.debug) {
          console.log(`[AgentAPIProxy] Response:`, { data });
        }

        return data;
      } catch (error) {
        if (error instanceof AgentAPIProxyError) {
          throw error;
        }

        throw new AgentAPIProxyError(
          0,
          'NETWORK_ERROR',
          error instanceof Error ? error.message : 'Unknown network error'
        );
      }
    }

    // No API key case
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    if (this.debug) {
      console.log(`[AgentAPIProxy] ${options.method || 'GET'} ${url} (no auth)`, {
        headers: requestOptions.headers,
        body: options.body,
        attempt,
      });
    }

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: {
            code: 'UNKNOWN_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
            timestamp: new Date().toISOString(),
          }
        }));

        throw new AgentAPIProxyError(
          response.status,
          errorData.error?.code || 'UNKNOWN_ERROR',
          errorData.error?.message || `HTTP ${response.status}`,
          errorData.error?.details
        );
      }

      const data = await response.json();
      
      if (this.debug) {
        console.log(`[AgentAPIProxy] Response:`, { data });
      }

      return data;
    } catch (error) {
      if (error instanceof AgentAPIProxyError) {
        throw error;
      }

      throw new AgentAPIProxyError(
        0,
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unknown network error'
      );
    }
  }

  // High-level operations based on agentapi-proxy
  
  /**
   * Start a new session
   */
  async start(sessionData?: Partial<CreateSessionRequest> | Record<string, unknown>): Promise<Session> {
    // Handle backward compatibility and new format
    let data: Partial<CreateSessionRequest>;
    
    if (sessionData && (sessionData.environment || sessionData.tags || sessionData.metadata)) {
      // New format: sessionData contains environment, metadata, and/or tags
      data = {
        environment: sessionData.environment as Record<string, string> | undefined,
        metadata: sessionData.metadata as Record<string, unknown> | undefined || { source: 'agentapi-ui' },
        tags: sessionData.tags as Record<string, string> | undefined
      };
    } else {
      // Backward compatibility: sessionData is just metadata
      data = {
        metadata: (sessionData as Record<string, unknown>) || { source: 'agentapi-ui' }
      };
    }

    // Collect profile environment variables if profile is specified
    if (this.profileId) {
      try {
        const profile = ProfileManager.getProfile(this.profileId);
        if (profile && profile.environmentVariables) {
          const profileEnvironment: Record<string, string> = {};
          profile.environmentVariables.forEach(envVar => {
            if (envVar.key && envVar.value) {
              profileEnvironment[envVar.key] = envVar.value;
            }
          });
          
          if (Object.keys(profileEnvironment).length > 0) {
            // Merge profile environment variables with session-specific ones
            // Session-specific environment variables take precedence
            data.environment = {
              ...profileEnvironment,
              ...(data.environment || {})
            };
            
            if (this.debug) {
              console.log(`[AgentAPIProxy] Merged ${Object.keys(profileEnvironment).length} environment variables from profile ${this.profileId}`);
            }
          }
        }
      } catch (error) {
        console.error('[AgentAPIProxy] Failed to collect profile environment variables:', error);
        // Continue with session creation even if profile env collection fails
      }
    }

    // Collect MCP server configurations and add to tags
    try {
      const mcpConfigs = collectMCPConfigurations(this.profileId);
      if (mcpConfigs.length > 0) {
        // Ensure tags object exists
        if (!data.tags) {
          data.tags = {};
        }
        
        // Encode MCP configurations as base64 JSON and add to tags
        const mcpConfigsJson = JSON.stringify(mcpConfigs);
        const mcpConfigsBase64 = Buffer.from(mcpConfigsJson, 'utf-8').toString('base64');
        data.tags['claude.mcp_configs'] = mcpConfigsBase64;
        
        if (this.debug) {
          console.log(`[AgentAPIProxy] Added ${mcpConfigs.length} MCP server configurations to session`);
        }
      }
    } catch (error) {
      console.error('[AgentAPIProxy] Failed to collect MCP configurations:', error);
      // Continue with session creation even if MCP config collection fails
    }

    const session = await this.makeRequest<Session>('/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Started session: ${session.session_id}`);
    }

    return session;
  }

  /**
   * Search for sessions
   */
  async search(params?: SessionListParams): Promise<SessionListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.user_id) searchParams.set('user_id', params.user_id);

    const endpoint = `/search${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<SessionListResponse>(endpoint);
    
    return {
      ...result,
      sessions: result.sessions || []
    };
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    await this.makeRequest<void>(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleted session: ${sessionId}`);
    }
  }


  // Session message operations

  async getSessionMessages(sessionId: string, params?: SessionMessageListParams): Promise<SessionMessageListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);

    const endpoint = `/${sessionId}/messages${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<SessionMessageListResponse>(endpoint);
    
    return {
      ...result,
      messages: result.messages || []
    };
  }

  async sendSessionMessage(sessionId: string, data: SendSessionMessageRequest): Promise<SessionMessage> {
    const result = await this.makeRequest<SessionMessage>(`/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Sent message to session ${sessionId}:`, data.content);
    }

    return result;
  }

  async getSessionStatus(sessionId: string): Promise<AgentStatus> {
    return this.makeRequest<AgentStatus>(`/${sessionId}/status`);
  }

  // Session events using Server-Sent Events
  subscribeToSessionEvents(
    sessionId: string,
    onMessage: (message: SessionMessage) => void,
    onStatus?: (status: AgentStatus) => void,
    onError?: (error: Error) => void,
    options?: SessionEventsOptions
  ): EventSource {
    const eventSourceUrl = `${this.baseURL}/${sessionId}/events`;
    
    if (this.debug) {
      console.log(`[AgentAPIProxy] Creating EventSource for session ${sessionId}:`, eventSourceUrl);
    }

    const eventSource = new EventSource(eventSourceUrl);

    eventSource.onmessage = (event) => {
      try {
        const eventData: SessionEventData = JSON.parse(event.data);
        
        if (this.debug) {
          console.log(`[AgentAPIProxy] Session event received:`, eventData);
        }

        switch (eventData.type) {
          case 'message':
            onMessage(eventData.data as SessionMessage);
            break;
          case 'status':
            if (onStatus) {
              onStatus(eventData.data as AgentStatus);
            }
            break;
          case 'error':
            if (onError) {
              const errorData = eventData.data as { error: string };
              onError(new Error(errorData.error));
            }
            break;
          default:
            if (this.debug) {
              console.warn(`[AgentAPIProxy] Unknown event type: ${eventData.type}`);
            }
        }
      } catch (err) {
        console.error('[AgentAPIProxy] Failed to parse session event:', err);
        if (onError) {
          onError(err instanceof Error ? err : new Error('Failed to parse event data'));
        }
      }
    };

    eventSource.onerror = (event) => {
      console.error('[AgentAPIProxy] Session EventSource error:', event);
      if (onError) {
        onError(new Error('Session EventSource connection error'));
      }

      // Handle reconnection if enabled
      if (options?.reconnect !== false) {
        const reconnectInterval = options?.reconnectInterval || 5000;
        
        if (this.debug) {
          console.log(`[AgentAPIProxy] Session EventSource will attempt to reconnect in ${reconnectInterval}ms`);
        }
      }
    };

    return eventSource;
  }

  // Bulk operations

  /**
   * Start multiple sessions in parallel
   */
  async startBatch(count: number, sessionData?: Partial<CreateSessionRequest> | Record<string, unknown>): Promise<Session[]> {
    const promises = Array.from({ length: count }, () => this.start(sessionData));
    return Promise.all(promises);
  }

  /**
   * Delete multiple sessions in parallel
   */
  async deleteBatch(sessionIds: string[]): Promise<void> {
    const promises = sessionIds.map(sessionId => this.delete(sessionId));
    await Promise.all(promises);
  }

  // Session management utilities

  // Agent operations

  /**
   * Get list of agents
   */
  async getAgents(params?: AgentListParams): Promise<AgentListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.name) searchParams.set('name', params.name);

    const endpoint = `/agents${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<AgentListResponse>(endpoint);
    
    return {
      ...result,
      agents: result.agents || []
    };
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<Agent> {
    return this.makeRequest<Agent>(`/agents/${agentId}`);
  }

  /**
   * Health check for the proxy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/health');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get authentication info for the current session
   */
  async getAuthInfo(): Promise<{ type: 'github' | 'none'; authenticated: boolean; user?: GitHubUser }> {
    try {
      return await this.makeRequest<{ type: 'github' | 'none'; authenticated: boolean; user?: GitHubUser }>('/auth/info');
    } catch (error) {
      // If the endpoint doesn't exist (404) or returns an error, assume no auth (older agentapi-proxy)
      if (this.debug) {
        console.log('[AgentAPIProxy] Auth info not available (likely older proxy version):', error);
      }
      return { type: 'none', authenticated: false };
    }
  }

  /**
   * Get GitHub OAuth URL for authentication
   */
  async getGitHubAuthUrl(profileId: string): Promise<string> {
    try {
      const response = await this.makeRequest<{ authUrl: string }>('/auth/github/url', {
        method: 'POST',
        body: JSON.stringify({ profileId })
      });
      return response.authUrl;
    } catch (error) {
      console.error('[AgentAPIProxy] Failed to get GitHub auth URL:', error);
      throw error;
    }
  }

  /**
   * Set debug mode
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }
}

// Utility function to collect MCP server configurations
function collectMCPConfigurations(profileId?: string): MCPServerConfig[] {
  const mcpConfigs: MCPServerConfig[] = [];
  
  try {
    // Get global MCP configurations
    const globalSettings = loadGlobalSettings();
    if (globalSettings.mcpServers) {
      mcpConfigs.push(...globalSettings.mcpServers.filter(server => server.enabled));
    }
    
    // Get profile-specific MCP configurations (overrides global)
    if (profileId) {
      const profile = ProfileManager.getProfile(profileId);
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
      const currentProfileId = ProfileManager.getCurrentProfileId();
      if (currentProfileId) {
        const profile = ProfileManager.getProfile(currentProfileId);
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
      const defaultProfile = ProfileManager.getDefaultProfile();
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

// Utility functions to get proxy settings from browser storage
export function getAgentAPIProxyConfigFromStorage(repoFullname?: string, profileId?: string): AgentAPIProxyClientConfig {
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
      const profile = ProfileManager.getProfile(profileId);
      if (profile) {
        settings = {
          agentApiProxy: profile.agentApiProxy,
          environmentVariables: profile.environmentVariables
        };
        
        // Mark profile as used (debounced to prevent excessive calls)
        // ProfileManager.markProfileUsed(profileId);
        
        // Note: addRepositoryToProfile is now async and should be called from components
      }
    }
    
    // Note: ProfileManager async methods removed - profiles should be loaded explicitly in components
    
    // If still no settings, fall back to default proxy settings
    if (!settings) {
      const defaultProxySettings = getDefaultProxySettings();
      const globalSettings = loadGlobalSettings();
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
    console.warn('Failed to load proxy settings from storage, using environment variables:', error);
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
export function createAgentAPIProxyClient(config: AgentAPIProxyClientConfig): AgentAPIProxyClient {
  return new AgentAPIProxyClient(config);
}

// Factory function to create client using stored settings
export function createAgentAPIProxyClientFromStorage(repoFullname?: string, profileId?: string): AgentAPIProxyClient {
  const config = getAgentAPIProxyConfigFromStorage(repoFullname, profileId);
  return new AgentAPIProxyClient(config);
}

// Default proxy client instance for convenience (uses global settings from storage)
export const agentAPIProxy = createAgentAPIProxyClientFromStorage();