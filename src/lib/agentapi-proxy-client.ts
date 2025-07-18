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
import { loadGlobalSettings, getDefaultProxySettings, isSingleProfileModeEnabled } from '../types/settings';
import { ProfileManager } from '../utils/profileManager';
import { GitHubUser } from '../types/profile';
import type { EncryptedData } from './encryption';

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
  private encryptedConfig?: EncryptedData | string;
  
  constructor(config: AgentAPIProxyClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000;
    this.maxSessions = config.maxSessions || 10;
    this.sessionTimeout = config.sessionTimeout || 300000; // 5 minutes
    this.debug = config.debug || false;
    this.profileId = config.profileId;

    // Load encrypted config if in single profile mode
    if (isSingleProfileModeEnabled() && typeof window !== 'undefined') {
      const storedEncrypted = localStorage.getItem('agentapi-encrypted-config');
      console.log('[AgentAPIProxy] Single profile mode enabled, checking for encrypted config:', !!storedEncrypted);
      if (storedEncrypted) {
        try {
          // Validate that the stored data is a valid string
          if (typeof storedEncrypted !== 'string' || storedEncrypted.trim().length === 0) {
            throw new Error('Encrypted config is not a valid string');
          }
          
          // For encrypted config, we expect a base64 encoded string or JSON
          const trimmedConfig = storedEncrypted.trim();
          
          // Try to parse as JSON first (for backward compatibility)
          try {
            this.encryptedConfig = JSON.parse(trimmedConfig);
          } catch {
            // If JSON parsing fails, it might be a base64 encoded encrypted string
            // which is valid for encrypted config, so we store it as is
            this.encryptedConfig = trimmedConfig;
          }
          
          if (this.debug) {
            console.log('[AgentAPIProxy] Successfully loaded encrypted config');
          }
        } catch (err) {
          console.error('Failed to load encrypted config:', err);
          
          // Only clear the config if it's clearly invalid (not just a parsing error)
          // Encrypted config can be a base64 string which is not JSON
          if (typeof storedEncrypted !== 'string' || storedEncrypted.trim().length === 0) {
            console.warn('Clearing invalid encrypted config from localStorage');
            localStorage.removeItem('agentapi-encrypted-config');
            this.encryptedConfig = undefined;
          } else {
            // Store as is - it might be valid encrypted data
            this.encryptedConfig = storedEncrypted.trim();
            console.log('[AgentAPIProxy] Stored encrypted config as string (possibly base64 encoded)');
          }
        }
      }
    } else if (isSingleProfileModeEnabled()) {
      console.log('[AgentAPIProxy] Single profile mode enabled but no window (server-side)');
    } else {
      console.log('[AgentAPIProxy] Single profile mode not enabled');
    }

    if (this.debug) {
      console.log('[AgentAPIProxy] Initialized with config:', {
        baseURL: this.baseURL,
        maxSessions: this.maxSessions,
        sessionTimeout: this.sessionTimeout,
        hasEncryptedConfig: !!this.encryptedConfig
      });
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt = 1
  ): Promise<T> {
    // Check if we're in single profile mode and should use the proxy API
    const isSingleProfile = isSingleProfileModeEnabled();
    
    if (isSingleProfile && typeof window !== 'undefined') {
      // Use the Next.js proxy API for single profile mode
      return this.makeProxyRequest<T>(endpoint, options);
    }
    
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

  private async makeProxyRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    includeEncryptedConfig = false
  ): Promise<T> {
    // Prepare the request body with encrypted config only when explicitly requested
    let body = options.body;
    
    // Only add encrypted config for specific endpoints that require authentication
    if (this.encryptedConfig && includeEncryptedConfig && options.method && 
        options.method.toUpperCase() !== 'GET' && options.method.toUpperCase() !== 'HEAD') {
      try {
        const existingBody = body ? JSON.parse(body as string) : {};
        body = JSON.stringify({
          ...existingBody,
          encryptedConfig: this.encryptedConfig
        });
      } catch (err) {
        console.error('Failed to add encrypted config to request:', err);
      }
    }
    
    const proxyUrl = `/api/proxy${endpoint}`;
    
    if (this.debug) {
      console.log(`[AgentAPIProxy] Proxy ${options.method || 'GET'} ${proxyUrl}`, {
        hasEncryptedConfig: !!this.encryptedConfig,
        bodyLength: typeof body === 'string' ? body.length : 0
      });
    }
    
    try {
      const response = await fetch(proxyUrl, {
        ...options,
        body,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      });
      
      // Get content type to determine how to handle response
      const contentType = response.headers.get('content-type');
      const isJsonResponse = contentType?.includes('application/json');
      
      if (!response.ok) {
        let errorData: Record<string, unknown>;
        
        try {
          if (isJsonResponse) {
            errorData = await response.json();
          } else {
            const textData = await response.text();
            errorData = {
              error: 'Proxy request failed',
              status: response.status,
              details: textData
            };
          }
        } catch (parseError) {
          // If we can't parse the response at all, create a generic error
          errorData = {
            error: 'Proxy request failed',
            status: response.status,
            details: `Response parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
          };
        }
        
        if (this.debug) {
          console.error(`[AgentAPIProxy] Request failed:`, {
            status: response.status,
            statusText: response.statusText,
            errorData,
            url: proxyUrl,
            contentType
          });
        }
        
        const errorObj = errorData as Record<string, unknown>;
        const errorNested = errorObj.error as Record<string, unknown> | undefined;
        
        const errorCode = errorNested?.code || errorObj.code || 'PROXY_ERROR';
        const errorMessage = errorNested?.message || errorObj.message || errorObj.error || `HTTP ${response.status}`;
        const errorDetails = errorNested?.details || errorData;
        
        throw new AgentAPIProxyError(
          response.status,
          typeof errorCode === 'string' ? errorCode : 'PROXY_ERROR',
          typeof errorMessage === 'string' ? errorMessage : `HTTP ${response.status}`,
          errorDetails as Record<string, unknown>
        );
      }
      
      // Handle successful response
      let data: unknown;
      
      try {
        if (isJsonResponse) {
          data = await response.json();
        } else {
          // If it's not JSON, try to parse as text and then JSON
          const textData = await response.text();
          try {
            data = JSON.parse(textData);
          } catch {
            // If we can't parse as JSON, return the text as is
            data = textData;
          }
        }
      } catch (parseError) {
        // If we can't parse the response, throw a meaningful error
        throw new AgentAPIProxyError(
          500,
          'RESPONSE_PARSE_ERROR',
          `Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          { originalError: parseError }
        );
      }
      
      if (this.debug) {
        console.log(`[AgentAPIProxy] Proxy Response:`, { 
          status: response.status,
          statusText: response.statusText,
          contentType,
          dataKeys: typeof data === 'object' && data ? Object.keys(data) : 'not an object',
          dataType: typeof data
        });
      }
      
      return data as T;
    } catch (error) {
      if (error instanceof AgentAPIProxyError) {
        throw error;
      }
      
      if (this.debug) {
        console.error(`[AgentAPIProxy] Network error:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          url: proxyUrl,
          errorType: error instanceof Error ? error.constructor.name : typeof error
        });
      }
      
      throw new AgentAPIProxyError(
        0,
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unknown proxy error'
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
    if (this.debug) {
      console.log(`[AgentAPIProxy] Attempting to delete session: ${sessionId}`);
    }

    // Use the correct agentapi-proxy endpoint: DELETE /sessions/{sessionId}
    await this.makeRequest<void>(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Successfully deleted session: ${sessionId}`);
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

  async sendSessionMessage(sessionId: string, data: SendSessionMessageRequest, retryCount = 0): Promise<SessionMessage> {
    const maxRetries = 2;
    
    try {
      if (this.debug) {
        console.log(`[AgentAPIProxy] Sending message to session ${sessionId} (attempt ${retryCount + 1}):`, data.content);
      }

      const result = await this.makeRequest<SessionMessage>(`/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (this.debug) {
        console.log(`[AgentAPIProxy] Successfully sent message to session ${sessionId}`);
      }

      return result;
    } catch (error) {
      if (this.debug) {
        console.error(`[AgentAPIProxy] Failed to send message to session ${sessionId} (attempt ${retryCount + 1}):`, error);
      }

      // Check if this is a timeout or screen stabilization error
      const isTimeoutError = error instanceof AgentAPIProxyError && 
        (error.message.includes('timeout') || 
         error.message.includes('screen to stabilize') ||
         error.message.includes('wait for condition'));

      // Retry for timeout errors
      if (isTimeoutError && retryCount < maxRetries) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s delay
        if (this.debug) {
          console.log(`[AgentAPIProxy] Retrying message send in ${delay}ms...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendSessionMessage(sessionId, data, retryCount + 1);
      }

      // Enhance error message for timeout errors
      if (isTimeoutError) {
        throw new AgentAPIProxyError(
          error instanceof AgentAPIProxyError ? error.status : 500,
          'TIMEOUT_ERROR',
          'メッセージ送信がタイムアウトしました。画面の操作に時間がかかっている可能性があります。しばらく待ってからもう一度お試しください。',
          error instanceof AgentAPIProxyError ? error.details : undefined
        );
      }

      throw error;
    }
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
    // For SSE, we need to construct the full URL - check if we're using proxy
    const isUsingProxy = this.baseURL.includes('/api/proxy');
    const eventSourceUrl = isUsingProxy 
      ? `/api/proxy/${sessionId}/events`
      : `${this.baseURL}/${sessionId}/events`;
    
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
   * Reload encrypted config from localStorage
   */
  reloadEncryptedConfig(): void {
    if (!isSingleProfileModeEnabled() || typeof window === 'undefined') {
      return;
    }

    const storedEncrypted = localStorage.getItem('agentapi-encrypted-config');
    console.log('[AgentAPIProxy] Reloading encrypted config:', !!storedEncrypted);
    
    if (storedEncrypted) {
      try {
        // Validate that the stored data is a valid string
        if (typeof storedEncrypted !== 'string' || storedEncrypted.trim().length === 0) {
          throw new Error('Encrypted config is not a valid string');
        }
        
        // For encrypted config, we expect a base64 encoded string or JSON
        const trimmedConfig = storedEncrypted.trim();
        
        // Try to parse as JSON first (for backward compatibility)
        try {
          this.encryptedConfig = JSON.parse(trimmedConfig);
        } catch {
          // If JSON parsing fails, it might be a base64 encoded encrypted string
          // which is valid for encrypted config, so we store it as is
          this.encryptedConfig = trimmedConfig;
        }
        
        if (this.debug) {
          console.log('[AgentAPIProxy] Successfully reloaded encrypted config');
        }
      } catch (err) {
        console.error('Failed to reload encrypted config:', err);
        
        // Only clear the config if it's clearly invalid (not just a parsing error)
        // Encrypted config can be a base64 string which is not JSON
        if (typeof storedEncrypted !== 'string' || storedEncrypted.trim().length === 0) {
          console.warn('Clearing invalid encrypted config from localStorage');
          localStorage.removeItem('agentapi-encrypted-config');
          this.encryptedConfig = undefined;
        } else {
          // Store as is - it might be valid encrypted data
          this.encryptedConfig = storedEncrypted.trim();
          console.log('[AgentAPIProxy] Stored encrypted config as string (possibly base64 encoded)');
        }
      }
    } else {
      this.encryptedConfig = undefined;
    }
  }

  /**
   * Set debug mode
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }
}


// Utility functions to get proxy settings from browser storage
export function getAgentAPIProxyConfigFromStorage(repoFullname?: string, profileId?: string): AgentAPIProxyClientConfig {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side rendering or Node.js environment - use environment variables
    return {
      baseURL: process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080',
      apiKey: process.env.AGENTAPI_API_KEY,
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
      sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
      debug: true, // Enable debug logging to diagnose proxy issues
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
        
        // Add repository to profile history if repoFullname is provided
        if (repoFullname) {
          ProfileManager.addRepositoryToProfile(profileId, repoFullname);
        }
      }
    }
    
    // If no profile settings found, check for current profile (including URL parameters)
    if (!settings) {
      const currentProfileId = ProfileManager.getCurrentProfileId();
      if (currentProfileId) {
        const profile = ProfileManager.getProfile(currentProfileId);
        if (profile) {
          settings = {
            agentApiProxy: profile.agentApiProxy,
            environmentVariables: profile.environmentVariables
          };
          
          // Mark profile as used (debounced to prevent excessive calls)
          // ProfileManager.markProfileUsed(currentProfileId);
          
          // Add repository to profile history if repoFullname is provided
          if (repoFullname) {
            ProfileManager.addRepositoryToProfile(currentProfileId, repoFullname);
          }
        }
      }
    }
    
    // If still no profile settings found, fall back to default profile
    if (!settings) {
      const defaultProfile = ProfileManager.getDefaultProfile();
      if (defaultProfile) {
        settings = {
          agentApiProxy: defaultProfile.agentApiProxy,
          environmentVariables: defaultProfile.environmentVariables
        };
        
        // Mark default profile as used (debounced to prevent excessive calls)
        // ProfileManager.markProfileUsed(defaultProfile.id);
        
        // Add repository to default profile history if repoFullname is provided
        if (repoFullname) {
          ProfileManager.addRepositoryToProfile(defaultProfile.id, repoFullname);
        }
      }
    }
    
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
      : (typeof window !== 'undefined' 
          ? `${window.location.protocol}//${window.location.host}/api/proxy`
          : 'http://localhost:3000/api/proxy');
    
    const timeout = settings.agentApiProxy.enabled 
      ? settings.agentApiProxy.timeout 
      : parseInt(process.env.AGENTAPI_TIMEOUT || '10000');
    
    return {
      baseURL,
      apiKey: settings.agentApiProxy.apiKey || process.env.AGENTAPI_API_KEY,
      timeout,
      maxSessions: 10,
      sessionTimeout: 300000, // 5 minutes
      debug: true, // Enable debug logging to diagnose proxy issues
      profileId,
    };
  } catch (error) {
    console.warn('Failed to load proxy settings from storage, using fallback:', error);
    // Fallback if storage access fails
    return {
      baseURL: typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.host}/api/proxy`
        : 'http://localhost:3000/api/proxy',
      apiKey: process.env.AGENTAPI_API_KEY,
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
      sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
      debug: true, // Enable debug logging to diagnose proxy issues
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
// Synchronous version for backward compatibility
export function createDefaultAgentAPIProxyClient(): AgentAPIProxyClient {
  if (typeof window === 'undefined') {
    // Server-side - use environment variables directly
    const config = {
      baseURL: process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080',
      apiKey: process.env.AGENTAPI_API_KEY,
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
      sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
      debug: true,
    };
    return new AgentAPIProxyClient(config);
  }
  
  // Client-side - use stored settings
  const defaultProxySettings = getDefaultProxySettings();
  const config = {
    baseURL: defaultProxySettings.endpoint,
    apiKey: defaultProxySettings.apiKey,
    timeout: defaultProxySettings.timeout,
    maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
    sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
    debug: true,
  };
  return new AgentAPIProxyClient(config);
}

// Default proxy client instance for convenience
export const agentAPIProxy = createDefaultAgentAPIProxyClient();