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
  AgentListParams,
  ToolStatusResponseBody,
  PendingAction,
  ActionRequest,
  ActionResponse
} from '../types/agentapi';
import {
  Schedule,
  ScheduleListParams,
  ScheduleListResponse,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  TriggerScheduleResponse
} from '../types/schedule';
import {
  Webhook,
  WebhookListParams,
  WebhookListResponse,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  RegenerateSecretResponse,
  TriggerWebhookRequest,
  TriggerWebhookResponse
} from '../types/webhook';
import {
  CreateShareResponse,
  ShareStatus,
  RevokeShareResponse
} from '../types/share';
import {
  Task,
  TaskStatus,
  TaskListResponse,
  TaskListParams
} from '../types/task';
import { loadFullGlobalSettings, getDefaultProxySettings, addRepositoryToHistory, SettingsData, getSendGithubTokenOnSessionStart } from '../types/settings';
import { ProxyUserInfo } from '../types/user';

// GitHubUser type (moved from profile.ts)
export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

// Define local AgentStatus type
interface AgentStatus {
  status: 'stable' | 'running' | 'error';
  last_activity?: string;
  current_task?: string;
  agent_type?: string;
}

export interface AgentAPIProxyClientConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  maxSessions?: number;
  sessionTimeout?: number;
  debug?: boolean;
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

  constructor(config: AgentAPIProxyClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000;
    this.maxSessions = config.maxSessions || 10;
    this.sessionTimeout = config.sessionTimeout || 300000; // 5 minutes
    this.debug = config.debug || false;

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
                message: `HTTP ${fallbackResponse.status}: ${fallbackResponse.statusText}`,
              }));

              // Support both Echo's simple format and structured error format
              const errorMessage = errorData.message || errorData.error?.message || `HTTP ${fallbackResponse.status}`;
              const errorCode = errorData.error?.code || 'HTTP_ERROR';
              const errorDetails = errorData.error?.details;

              throw new AgentAPIProxyError(
                fallbackResponse.status,
                errorCode,
                errorMessage,
                errorDetails
              );
            }

            const fallbackData = await fallbackResponse.json();
            
            if (this.debug) {
              console.log(`[AgentAPIProxy] Response (fallback):`, { data: fallbackData });
            }

            return fallbackData;
          }

          const errorData = await response.json().catch(() => ({
            message: `HTTP ${response.status}: ${response.statusText}`,
          }));

          // Support both Echo's simple format and structured error format
          const errorMessage = errorData.message || errorData.error?.message || `HTTP ${response.status}`;
          const errorCode = errorData.error?.code || 'HTTP_ERROR';
          const errorDetails = errorData.error?.details;

          throw new AgentAPIProxyError(
            response.status,
            errorCode,
            errorMessage,
            errorDetails
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
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));

        // Support both Echo's simple format and structured error format
        const errorMessage = errorData.message || errorData.error?.message || `HTTP ${response.status}`;
        const errorCode = errorData.error?.code || 'HTTP_ERROR';
        const errorDetails = errorData.error?.details;

        throw new AgentAPIProxyError(
          response.status,
          errorCode,
          errorMessage,
          errorDetails
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

    if (sessionData && (sessionData.environment || sessionData.tags || sessionData.metadata || sessionData.params || sessionData.scope || sessionData.team_id)) {
      // New format: sessionData contains environment, metadata, tags, params, scope, and/or team_id
      data = {
        environment: sessionData.environment as Record<string, string> | undefined,
        metadata: sessionData.metadata as Record<string, unknown> | undefined || { source: 'agentapi-ui' },
        tags: sessionData.tags as Record<string, string> | undefined,
        params: sessionData.params as { message?: string; github_token?: string; [key: string]: unknown } | undefined,
        scope: sessionData.scope as CreateSessionRequest['scope'],
        team_id: sessionData.team_id as string | undefined
      };
    } else {
      // Backward compatibility: sessionData is just metadata
      data = {
        metadata: (sessionData as Record<string, unknown>) || { source: 'agentapi-ui' }
      };
    }

    // Check if GitHub token injection is enabled
    const injectGithubToken = typeof window !== 'undefined' ? getSendGithubTokenOnSessionStart() : false;

    console.log('[AgentAPIProxy] Starting session with data:', JSON.stringify(data, null, 2));

    const session = await this.makeRequest<Session>('/start', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'X-Inject-Github-Token': injectGithubToken ? 'true' : 'false'
      }
    });

    console.log('[AgentAPIProxy] Session created:', JSON.stringify(session, null, 2));

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
    if (params?.scope) searchParams.set('scope', params.scope);
    if (params?.team_id) searchParams.set('team_id', params.team_id);

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

    // New API parameters (cursor-based pagination)
    if (params?.before !== undefined) searchParams.set('before', params.before.toString());
    if (params?.after !== undefined) searchParams.set('after', params.after.toString());

    // Limit and direction parameters
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.direction) searchParams.set('direction', params.direction);

    // Context-based pagination
    if (params?.around !== undefined) searchParams.set('around', params.around.toString());
    if (params?.context !== undefined) searchParams.set('context', params.context.toString());

    // Deprecated parameters (kept for backwards compatibility)
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);

    const endpoint = `/${sessionId}/messages${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    if (this.debug) {
      console.log(`[AgentAPIProxy] Fetching messages for session ${sessionId} with params:`, Object.fromEntries(searchParams));
    }

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

  /**
   * Get active tool execution status for a session
   * Returns null if the endpoint is not available (404)
   */
  async getToolStatus(sessionId: string): Promise<ToolStatusResponseBody | null> {
    try {
      return await this.makeRequest<ToolStatusResponseBody>(`/${sessionId}/tool_status`);
    } catch (error) {
      // If the endpoint doesn't exist (404), return null
      if (error instanceof AgentAPIProxyError && error.status === 404) {
        if (this.debug) {
          console.log(`[AgentAPIProxy] Tool status endpoint not available for session ${sessionId}`);
        }
        return null;
      }
      throw error;
    }
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
   * Get user info from agentapi-proxy
   * Returns username and teams the user belongs to
   */
  async getUserInfo(): Promise<ProxyUserInfo> {
    if (this.debug) {
      console.log('[AgentAPIProxy] Getting user info');
    }
    return await this.makeRequest<ProxyUserInfo>('/user/info');
  }

  /**
   * Get GitHub OAuth URL for authentication
   */
  async getGitHubAuthUrl(): Promise<string> {
    try {
      const response = await this.makeRequest<{ authUrl: string }>('/auth/github/url', {
        method: 'POST',
        body: JSON.stringify({})
      });
      return response.authUrl;
    } catch (error) {
      console.error('[AgentAPIProxy] Failed to get GitHub auth URL:', error);
      throw error;
    }
  }

  // Action operations (AskUserQuestion, etc.)

  /**
   * Get pending actions for a session (e.g., AskUserQuestion)
   */
  async getPendingActions(sessionId: string): Promise<PendingAction[]> {
    try {
      const response = await this.makeRequest<ActionResponse>(`/${sessionId}/action`);
      return response.pending_actions || [];
    } catch (error) {
      // If endpoint doesn't exist (404), return empty array
      if (error instanceof AgentAPIProxyError && error.status === 404) {
        if (this.debug) {
          console.log(`[AgentAPIProxy] Action endpoint not available for session ${sessionId}`);
        }
        return [];
      }
      throw error;
    }
  }

  /**
   * Send action response (e.g., answer to AskUserQuestion)
   */
  async sendAction(sessionId: string, action: ActionRequest): Promise<void> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Sending action to session ${sessionId}:`, action);
    }

    await this.makeRequest<void>(`/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify(action),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Successfully sent action to session ${sessionId}`);
    }
  }

  // Schedule operations

  /**
   * Create a new schedule
   */
  async createSchedule(data: CreateScheduleRequest): Promise<Schedule> {
    if (this.debug) {
      console.log('[AgentAPIProxy] Creating schedule:', data);
    }

    const schedule = await this.makeRequest<Schedule>('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Created schedule: ${schedule.id}`);
    }

    return schedule;
  }

  /**
   * Get list of schedules
   */
  async getSchedules(params?: ScheduleListParams): Promise<ScheduleListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.scope) searchParams.set('scope', params.scope);
    if (params?.team_id) searchParams.set('team_id', params.team_id);

    const endpoint = `/schedules${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<ScheduleListResponse>(endpoint);

    return {
      ...result,
      schedules: result.schedules || []
    };
  }

  /**
   * Get a specific schedule by ID
   */
  async getSchedule(scheduleId: string): Promise<Schedule> {
    return this.makeRequest<Schedule>(`/schedules/${scheduleId}`);
  }

  /**
   * Update a schedule
   */
  async updateSchedule(scheduleId: string, data: UpdateScheduleRequest): Promise<Schedule> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Updating schedule ${scheduleId}:`, data);
    }

    const schedule = await this.makeRequest<Schedule>(`/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Updated schedule: ${schedule.id}`);
    }

    return schedule;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleting schedule: ${scheduleId}`);
    }

    await this.makeRequest<void>(`/schedules/${scheduleId}`, {
      method: 'DELETE',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleted schedule: ${scheduleId}`);
    }
  }

  /**
   * Trigger a schedule immediately
   */
  async triggerSchedule(scheduleId: string): Promise<TriggerScheduleResponse> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Triggering schedule: ${scheduleId}`);
    }

    const result = await this.makeRequest<TriggerScheduleResponse>(`/schedules/${scheduleId}/trigger`, {
      method: 'POST',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Triggered schedule ${scheduleId}, session: ${result.session_id}`);
    }

    return result;
  }

  // Settings operations

  /**
   * Normalize name for settings API
   * Team names may contain '/' which should be replaced with '-'
   * @param name - User name or team name
   */
  private normalizeSettingsName(name: string): string {
    return name.replace(/\//g, '-');
  }

  /**
   * Get settings for a user or team
   * @param name - User name or team name
   */
  async getSettings(name: string): Promise<SettingsData> {
    const normalizedName = this.normalizeSettingsName(name);
    try {
      return await this.makeRequest<SettingsData>(`/settings/${encodeURIComponent(normalizedName)}`);
    } catch (error) {
      // If settings don't exist (404), return empty settings
      if (error instanceof AgentAPIProxyError && error.status === 404) {
        if (this.debug) {
          console.log(`[AgentAPIProxy] Settings not found for ${name}, returning empty settings`);
        }
        return {};
      }
      throw error;
    }
  }

  /**
   * Save settings for a user or team
   * @param name - User name or team name
   * @param data - Settings data to save
   */
  async saveSettings(name: string, data: SettingsData): Promise<void> {
    const normalizedName = this.normalizeSettingsName(name);
    if (this.debug) {
      console.log(`[AgentAPIProxy] Saving settings for: ${name} (normalized: ${normalizedName})`, data);
    }
    await this.makeRequest<void>(`/settings/${encodeURIComponent(normalizedName)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (this.debug) {
      console.log(`[AgentAPIProxy] Successfully saved settings for: ${name}`);
    }
  }

  /**
   * Delete settings for a user or team
   * @param name - User name or team name
   */
  async deleteSettings(name: string): Promise<void> {
    const normalizedName = this.normalizeSettingsName(name);
    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleting settings for: ${name} (normalized: ${normalizedName})`);
    }
    await this.makeRequest<void>(`/settings/${encodeURIComponent(normalizedName)}`, {
      method: 'DELETE',
    });
    if (this.debug) {
      console.log(`[AgentAPIProxy] Successfully deleted settings for: ${name}`);
    }
  }

  /**
   * Set debug mode
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }

  // Session sharing operations

  /**
   * Create a share URL for a session
   * POST /sessions/{sessionId}/share
   */
  async createShare(sessionId: string): Promise<CreateShareResponse> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Creating share for session: ${sessionId}`);
    }

    const result = await this.makeRequest<CreateShareResponse>(`/sessions/${sessionId}/share`, {
      method: 'POST',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Created share for session ${sessionId}:`, result);
    }

    return result;
  }

  /**
   * Get share status for a session
   * GET /sessions/{sessionId}/share
   */
  async getShareStatus(sessionId: string): Promise<ShareStatus | null> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Getting share status for session: ${sessionId}`);
    }

    try {
      const result = await this.makeRequest<ShareStatus>(`/sessions/${sessionId}/share`);

      if (this.debug) {
        console.log(`[AgentAPIProxy] Share status for session ${sessionId}:`, result);
      }

      return result;
    } catch (error) {
      // If share doesn't exist (404), return null
      if (error instanceof AgentAPIProxyError && error.status === 404) {
        if (this.debug) {
          console.log(`[AgentAPIProxy] No share found for session ${sessionId}`);
        }
        return null;
      }
      throw error;
    }
  }

  /**
   * Revoke share for a session
   * DELETE /sessions/{sessionId}/share
   */
  async revokeShare(sessionId: string): Promise<RevokeShareResponse> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Revoking share for session: ${sessionId}`);
    }

    const result = await this.makeRequest<RevokeShareResponse>(`/sessions/${sessionId}/share`, {
      method: 'DELETE',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Revoked share for session ${sessionId}:`, result);
    }

    return result;
  }

  // Webhook operations

  /**
   * Create a new webhook
   */
  async createWebhook(data: CreateWebhookRequest): Promise<Webhook> {
    if (this.debug) {
      console.log('[AgentAPIProxy] Creating webhook:', data);
    }

    const webhook = await this.makeRequest<Webhook>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Created webhook: ${webhook.id}`);
    }

    return webhook;
  }

  /**
   * Get list of webhooks
   */
  async getWebhooks(params?: WebhookListParams): Promise<WebhookListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.type) searchParams.set('type', params.type);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.scope) searchParams.set('scope', params.scope);
    if (params?.team_id) searchParams.set('team_id', params.team_id);

    const endpoint = `/webhooks${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<WebhookListResponse>(endpoint);

    return {
      ...result,
      webhooks: result.webhooks || []
    };
  }

  /**
   * Get a specific webhook by ID
   */
  async getWebhook(webhookId: string): Promise<Webhook> {
    return this.makeRequest<Webhook>(`/webhooks/${webhookId}`);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(webhookId: string, data: UpdateWebhookRequest): Promise<Webhook> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Updating webhook ${webhookId}:`, data);
    }

    const webhook = await this.makeRequest<Webhook>(`/webhooks/${webhookId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Updated webhook: ${webhook.id}`);
    }

    return webhook;
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleting webhook: ${webhookId}`);
    }

    await this.makeRequest<void>(`/webhooks/${webhookId}`, {
      method: 'DELETE',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleted webhook: ${webhookId}`);
    }
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateWebhookSecret(webhookId: string): Promise<RegenerateSecretResponse> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Regenerating secret for webhook: ${webhookId}`);
    }

    const result = await this.makeRequest<RegenerateSecretResponse>(`/webhooks/${webhookId}/regenerate-secret`, {
      method: 'POST',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Regenerated secret for webhook ${webhookId}`);
    }

    return result;
  }

  /**
   * Trigger a webhook with a test payload
   */
  async triggerWebhook(webhookId: string, data: TriggerWebhookRequest): Promise<TriggerWebhookResponse> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Triggering webhook ${webhookId} with payload:`, data);
    }

    const result = await this.makeRequest<TriggerWebhookResponse>(`/webhooks/${webhookId}/trigger`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Webhook ${webhookId} trigger result:`, result);
    }

    return result;
  }

  // Task operations

  /**
   * Get list of tasks
   */
  async getTasks(params?: TaskListParams): Promise<TaskListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.set('scope', params.scope);
    if (params?.team_id) searchParams.set('team_id', params.team_id);
    if (params?.group_id) searchParams.set('group_id', params.group_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.task_type) searchParams.set('task_type', params.task_type);

    const endpoint = `/tasks${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<TaskListResponse>(endpoint);
    return { ...result, tasks: result.tasks || [] };
  }

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<Task> {
    return this.makeRequest<Task>(`/tasks/${taskId}`);
  }

  /**
   * Update a task (e.g., mark as done/todo)
   */
  async updateTask(taskId: string, updates: { status?: TaskStatus; title?: string; description?: string }): Promise<Task> {
    return this.makeRequest<Task>(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
}


// Utility functions to get proxy settings from browser storage
export function getAgentAPIProxyConfigFromStorage(repoFullname?: string): AgentAPIProxyClientConfig {
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
    };
  }

  try {
    // Get settings from global settings
    const globalSettings = loadFullGlobalSettings();
    const proxySettings = globalSettings.agentApiProxy || getDefaultProxySettings();

    // Add repository to history if repoFullname is provided
    if (repoFullname) {
      addRepositoryToHistory(repoFullname);
    }

    // Use proxy configuration
    const baseURL = proxySettings.enabled
      ? proxySettings.endpoint
      : `${window.location.protocol}//${window.location.host}/api/proxy`;

    const timeout = proxySettings.enabled
      ? proxySettings.timeout
      : parseInt(process.env.AGENTAPI_TIMEOUT || '10000');

    return {
      baseURL,
      apiKey: proxySettings.apiKey || process.env.AGENTAPI_API_KEY,
      timeout,
      maxSessions: 10,
      sessionTimeout: 300000, // 5 minutes
      debug: true, // Enable debug logging to diagnose proxy issues
    };
  } catch (error) {
    console.warn('Failed to load proxy settings from storage, using fallback:', error);
    // Fallback if storage access fails
    return {
      baseURL: `${window.location.protocol}//${window.location.host}/api/proxy`,
      apiKey: process.env.AGENTAPI_API_KEY,
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      maxSessions: parseInt(process.env.AGENTAPI_PROXY_MAX_SESSIONS || '10'),
      sessionTimeout: parseInt(process.env.AGENTAPI_PROXY_SESSION_TIMEOUT || '300000'),
      debug: true, // Enable debug logging to diagnose proxy issues
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