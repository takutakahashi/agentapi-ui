import {
  Agent,
  AgentListResponse,
  AgentListParams,
  CreateAgentRequest,
  UpdateAgentRequest,
  Metrics,
  AgentMetrics,
  MetricsHistoryParams,
  SystemConfig,
  AgentAPIClientConfig,
  APIErrorResponse,
  RateLimitInfo,
  WebSocketMessage,
  WebSocketOptions,
  Session,
  SessionListParams,
  SessionListResponse,
  CreateSessionRequest,
  SessionMessage,
  SessionMessageListResponse,
  SessionMessageListParams,
  SendSessionMessageRequest
} from '../types/agentapi';
import { loadGlobalSettings, loadRepositorySettings } from '../types/settings';

export class AgentAPIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentAPIError';
  }
}

export class AgentAPIClient {
  private baseURL: string;
  private apiKey?: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private debug: boolean;

  constructor(config: AgentAPIClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.debug = config.debug || false;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt = 1
  ): Promise<{ data: T; rateLimitInfo?: RateLimitInfo }> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      defaultHeaders['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    if (this.debug) {
      console.log(`[AgentAPI] ${options.method || 'GET'} ${url}`, {
        headers: requestOptions.headers,
        body: options.body,
        attempt,
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Extract rate limiting info
      const rateLimitInfo: RateLimitInfo | undefined = response.headers.get('X-RateLimit-Limit') ? {
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0'),
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
        reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0'),
      } : undefined;

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json().catch(() => ({
          error: {
            code: 'UNKNOWN_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
            timestamp: new Date().toISOString(),
          }
        }));

        // Retry on 5xx errors or rate limiting
        if ((response.status >= 500 || response.status === 429) && attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          if (this.debug) {
            console.log(`[AgentAPI] Retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryAttempts})`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(endpoint, options, attempt + 1);
        }

        throw new AgentAPIError(
          response.status,
          errorData.error.code,
          errorData.error.message,
          errorData.error.details
        );
      }

      const data = await response.json();
      
      if (this.debug) {
        console.log(`[AgentAPI] Response:`, { data, rateLimitInfo });
      }

      return { data, rateLimitInfo };
    } catch (error) {
      if (error instanceof AgentAPIError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AgentAPIError(0, 'TIMEOUT', 'Request timeout');
      }

      // Retry on network errors
      if (attempt < this.retryAttempts) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        if (this.debug) {
          console.log(`[AgentAPI] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryAttempts})`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, options, attempt + 1);
      }

      throw new AgentAPIError(
        0,
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unknown network error'
      );
    }
  }

  // Agent Management Methods
  async getAgents(params?: AgentListParams): Promise<AgentListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.name) searchParams.set('name', params.name);

    const endpoint = `/agents${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<AgentListResponse>(endpoint);
    return result.data;
  }

  async getAgent(id: string): Promise<Agent> {
    const result = await this.makeRequest<Agent>(`/agents/${id}`);
    return result.data;
  }

  async createAgent(data: CreateAgentRequest): Promise<Agent> {
    const result = await this.makeRequest<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async updateAgent(id: string, data: UpdateAgentRequest): Promise<Agent> {
    const result = await this.makeRequest<Agent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async deleteAgent(id: string): Promise<void> {
    await this.makeRequest<void>(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  // Metrics Methods
  async getMetrics(): Promise<Metrics> {
    const result = await this.makeRequest<Metrics>('/metrics');
    return result.data;
  }

  async getAgentMetrics(agentId: string): Promise<AgentMetrics> {
    const result = await this.makeRequest<AgentMetrics>(`/metrics/agents/${agentId}`);
    return result.data;
  }

  async getMetricsHistory(params: MetricsHistoryParams): Promise<Metrics[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('from', params.from);
    searchParams.set('to', params.to);
    if (params.interval) searchParams.set('interval', params.interval);
    if (params.agent_id) searchParams.set('agent_id', params.agent_id);

    const endpoint = `/metrics/history?${searchParams.toString()}`;
    const result = await this.makeRequest<Metrics[]>(endpoint);
    return result.data;
  }

  // Configuration Methods
  async getConfig(): Promise<SystemConfig> {
    const result = await this.makeRequest<SystemConfig>('/config');
    return result.data;
  }

  async updateConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
    const result = await this.makeRequest<SystemConfig>('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return result.data;
  }

  // WebSocket Methods
  createWebSocket(options?: WebSocketOptions): WebSocket {
    const wsUrl = this.baseURL.replace(/^http/, 'ws') + '/websocket';
    const ws = new WebSocket(wsUrl);

    if (options?.reconnect !== false) {
      const reconnectInterval = options?.reconnectInterval || 5000;
      const maxAttempts = options?.maxReconnectAttempts || 10;
      let attempts = 0;

      const reconnect = () => {
        if (attempts < maxAttempts && ws.readyState === WebSocket.CLOSED) {
          attempts++;
          if (this.debug) {
            console.log(`[AgentAPI] WebSocket reconnecting (attempt ${attempts}/${maxAttempts})`);
          }
          setTimeout(() => {
            const newWs = this.createWebSocket({ ...options, reconnect: false });
            Object.setPrototypeOf(ws, Object.getPrototypeOf(newWs));
          }, reconnectInterval);
        }
      };

      ws.addEventListener('close', reconnect);
      ws.addEventListener('error', reconnect);
    }

    return ws;
  }

  subscribeToAgents(ws: WebSocket, agentId?: string): void {
    const message: WebSocketMessage = {
      type: 'subscribe',
      channel: 'agents',
      agent_id: agentId,
    };
    ws.send(JSON.stringify(message));
  }

  subscribeToMetrics(ws: WebSocket, interval = 5000): void {
    const message: WebSocketMessage = {
      type: 'subscribe',
      channel: 'metrics',
      interval,
    };
    ws.send(JSON.stringify(message));
  }

  unsubscribeFromChannel(ws: WebSocket, channel: 'agents' | 'metrics'): void {
    const message: WebSocketMessage = {
      type: 'unsubscribe',
      channel,
    };
    ws.send(JSON.stringify(message));
  }

  // Session Management Methods (for agentapi-proxy)
  async getSessions(params?: SessionListParams): Promise<SessionListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.user_id) searchParams.set('user_id', params.user_id);

    const endpoint = `/search${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<SessionListResponse>(endpoint);
    return result.data;
  }

  async createSession(data: CreateSessionRequest): Promise<Session> {
    const result = await this.makeRequest<Session>('/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async getSessionAgentAPI(sessionId: string): Promise<AgentAPIClient> {
    // Create a new client that routes through the session
    const sessionConfig: AgentAPIClientConfig = {
      ...this,
      baseURL: `${this.baseURL}/${sessionId}/api/v1`
    };
    return new AgentAPIClient(sessionConfig);
  }

  // Session Message Methods
  async getSessionMessages(sessionId: string, params?: SessionMessageListParams): Promise<SessionMessageListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);

    const endpoint = `/${sessionId}/messages${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<SessionMessageListResponse>(endpoint);
    return result.data;
  }

  async sendSessionMessage(sessionId: string, data: SendSessionMessageRequest): Promise<SessionMessage> {
    const result = await this.makeRequest<SessionMessage>(`/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  // Utility Methods
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/health');
      return true;
    } catch {
      return false;
    }
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setDebug(debug: boolean): void {
    this.debug = debug;
  }
}

// Utility functions to get settings from browser storage
export function getAgentAPIConfigFromStorage(repoFullname?: string): AgentAPIClientConfig {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side rendering or Node.js environment - use environment variables
    return {
      baseURL: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || process.env.NEXT_PUBLIC_AGENTAPI_URL || 'http://localhost:8081',
      apiKey: process.env.AGENTAPI_API_KEY,
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
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
    
    // Use proxy if enabled, otherwise use direct AgentAPI endpoint
    const baseURL = settings.agentApiProxy.enabled 
      ? settings.agentApiProxy.endpoint 
      : settings.agentApi.endpoint;
    
    const timeout = settings.agentApiProxy.enabled 
      ? settings.agentApiProxy.timeout 
      : settings.agentApi.timeout;
    
    return {
      baseURL: baseURL || process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || process.env.NEXT_PUBLIC_AGENTAPI_URL || 'http://localhost:8081',
      apiKey: settings.agentApi.apiKey || process.env.AGENTAPI_API_KEY,
      timeout: timeout || parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      debug: process.env.NODE_ENV === 'development',
    };
  } catch (error) {
    console.warn('Failed to load settings from storage, using environment variables:', error);
    // Fallback to environment variables if storage access fails
    return {
      baseURL: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || process.env.NEXT_PUBLIC_AGENTAPI_URL || 'http://localhost:8081',
      apiKey: process.env.AGENTAPI_API_KEY,
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      debug: process.env.NODE_ENV === 'development',
    };
  }
}

// Factory function for easier client creation
export function createAgentAPIClient(config: AgentAPIClientConfig): AgentAPIClient {
  return new AgentAPIClient(config);
}

// Factory function to create client using stored settings
export function createAgentAPIClientFromStorage(repoFullname?: string): AgentAPIClient {
  const config = getAgentAPIConfigFromStorage(repoFullname);
  return new AgentAPIClient(config);
}

// Default client instance for convenience (uses global settings from storage)
export const agentAPI = createAgentAPIClientFromStorage();