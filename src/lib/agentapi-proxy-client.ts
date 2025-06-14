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
  SessionEventsOptions
} from '../types/agentapi';
import { AgentStatus } from '../types/real-agentapi';
import { AgentAPIClient, createAgentAPIClient } from './agentapi-client';
import { AgentAPIClientConfig } from '../types/agentapi';
import { loadGlobalSettings, loadRepositorySettings } from '../types/settings';

export interface AgentAPIProxyClientConfig {
  agentApiConfig: AgentAPIClientConfig;
  maxSessions?: number;
  sessionTimeout?: number;
  debug?: boolean;
  basicAuth?: {
    username: string;
    password: string;
  };
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
 * AgentAPIProxyClient handles session management and high-level operations
 * on top of the AgentAPIClient. This is inspired by agentapi-proxy implementation.
 */
export class AgentAPIProxyClient {
  private baseURL: string;
  private agentApiClient: AgentAPIClient;
  private sessions: Map<string, AgentAPIClient> = new Map();
  private maxSessions: number;
  private sessionTimeout: number;
  private debug: boolean;
  private basicAuth?: { username: string; password: string };

  constructor(config: AgentAPIProxyClientConfig) {
    this.agentApiClient = createAgentAPIClient(config.agentApiConfig);
    this.baseURL = config.agentApiConfig.baseURL;
    this.maxSessions = config.maxSessions || 10;
    this.sessionTimeout = config.sessionTimeout || 300000; // 5 minutes
    this.debug = config.debug || false;
    this.basicAuth = config.basicAuth;

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

    // Add Basic Auth header if configured
    if (this.basicAuth) {
      const credentials = btoa(`${this.basicAuth.username}:${this.basicAuth.password}`);
      defaultHeaders['Authorization'] = `Basic ${credentials}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    if (this.debug) {
      console.log(`[AgentAPIProxy] ${options.method || 'GET'} ${url}`, {
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
   * Start a new session for a user
   */
  async start(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const data: CreateSessionRequest = {
      user_id: userId,
      metadata: metadata || { source: 'agentapi-ui' }
    };

    const session = await this.makeRequest<Session>('/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Create a session-specific client
    const baseConfig = this.agentApiClient.getClientConfig();
    const sessionConfig: AgentAPIClientConfig = {
      ...baseConfig,
      baseURL: `${this.baseURL}/${session.session_id}/api/v1`
    };
    
    const sessionClient = createAgentAPIClient(sessionConfig);
    this.sessions.set(session.session_id, sessionClient);

    // Cleanup sessions if we exceed the maximum
    if (this.sessions.size > this.maxSessions) {
      const oldestSessionId = this.sessions.keys().next().value;
      if (oldestSessionId) {
        this.sessions.delete(oldestSessionId);
        
        if (this.debug) {
          console.log(`[AgentAPIProxy] Cleaned up old session: ${oldestSessionId}`);
        }
      }
    }

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

    // Remove from local session cache
    this.sessions.delete(sessionId);

    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleted session: ${sessionId}`);
    }
  }

  /**
   * Get a session-specific AgentAPI client
   */
  getSession(sessionId: string): AgentAPIClient {
    let sessionClient = this.sessions.get(sessionId);
    
    if (!sessionClient) {
      // Create a new session client if not cached
      const baseConfig = this.agentApiClient.getClientConfig();
      const sessionConfig: AgentAPIClientConfig = {
        ...baseConfig,
        baseURL: `${this.baseURL}/${sessionId}/api/v1`
      };
      
      sessionClient = createAgentAPIClient(sessionConfig);
      this.sessions.set(sessionId, sessionClient);

      if (this.debug) {
        console.log(`[AgentAPIProxy] Created new session client: ${sessionId}`);
      }
    }

    return sessionClient;
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
  async startBatch(userIds: string[], metadata?: Record<string, unknown>): Promise<Session[]> {
    const promises = userIds.map(userId => this.start(userId, metadata));
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

  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(): Promise<void> {
    // This would typically query the proxy for inactive sessions
    // and remove them from the local cache
    const sessionsToRemove: string[] = [];

    // For now, just clean up old cached clients
    // In a real implementation, this would check session last activity
    if (this.sessions.size > this.maxSessions) {
      const sessionIds = Array.from(this.sessions.keys());
      const excessCount = this.sessions.size - this.maxSessions;
      
      for (let i = 0; i < excessCount; i++) {
        sessionsToRemove.push(sessionIds[i]);
      }
    }

    sessionsToRemove.forEach(sessionId => {
      this.sessions.delete(sessionId);
      if (this.debug) {
        console.log(`[AgentAPIProxy] Cleaned up session: ${sessionId}`);
      }
    });
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
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
   * Set debug mode
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
    this.agentApiClient.setDebug(debug);
  }
}

// Utility functions to get proxy settings from browser storage
export function getAgentAPIProxyConfigFromStorage(repoFullname?: string): AgentAPIProxyClientConfig {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side rendering or Node.js environment - use environment variables
    return {
      agentApiConfig: {
        baseURL: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
        apiKey: process.env.AGENTAPI_API_KEY,
        timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
        debug: process.env.NODE_ENV === 'development',
      },
      maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
      sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
      debug: process.env.NODE_ENV === 'development',
    };
  }
  
  let settings;
  
  try {
    if (repoFullname) {
      // Get repository-specific settings (which includes global settings as fallback)
      settings = loadRepositorySettings(repoFullname);
    } else {
      // Get global settings
      settings = loadGlobalSettings();
    }
    
    // Use proxy configuration
    const baseURL = settings.agentApiProxy.enabled 
      ? settings.agentApiProxy.endpoint 
      : (process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080');
    
    const timeout = settings.agentApiProxy.enabled 
      ? settings.agentApiProxy.timeout 
      : parseInt(process.env.AGENTAPI_TIMEOUT || '10000');
    
    return {
      agentApiConfig: {
        baseURL,
        apiKey: settings.agentApi.apiKey || process.env.AGENTAPI_API_KEY,
        timeout,
        debug: process.env.NODE_ENV === 'development',
      },
      maxSessions: 10,
      sessionTimeout: 300000, // 5 minutes
      debug: process.env.NODE_ENV === 'development',
      basicAuth: settings.agentApiProxy.basicAuth,
    };
  } catch (error) {
    console.warn('Failed to load proxy settings from storage, using environment variables:', error);
    // Fallback to environment variables if storage access fails
    return {
      agentApiConfig: {
        baseURL: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
        apiKey: process.env.AGENTAPI_API_KEY,
        timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
        debug: process.env.NODE_ENV === 'development',
      },
      maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
      sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
      debug: process.env.NODE_ENV === 'development',
      basicAuth: process.env.AGENTAPI_PROXY_BASIC_AUTH_USERNAME && process.env.AGENTAPI_PROXY_BASIC_AUTH_PASSWORD
        ? {
            username: process.env.AGENTAPI_PROXY_BASIC_AUTH_USERNAME,
            password: process.env.AGENTAPI_PROXY_BASIC_AUTH_PASSWORD
          }
        : undefined,
    };
  }
}

// Factory function for easier client creation
export function createAgentAPIProxyClient(config: AgentAPIProxyClientConfig): AgentAPIProxyClient {
  return new AgentAPIProxyClient(config);
}

// Factory function to create client using stored settings
export function createAgentAPIProxyClientFromStorage(repoFullname?: string): AgentAPIProxyClient {
  const config = getAgentAPIProxyConfigFromStorage(repoFullname);
  return new AgentAPIProxyClient(config);
}

// Default proxy client instance for convenience (uses global settings from storage)
export const agentAPIProxy = createAgentAPIProxyClientFromStorage();