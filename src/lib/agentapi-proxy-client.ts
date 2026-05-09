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
  SlackBot,
  SlackBotListParams,
  SlackBotListResponse,
  CreateSlackBotRequest,
  UpdateSlackBotRequest
} from '../types/slackbot';
import {
  Memory,
  MemoryListParams,
  MemoryListResponse,
  CreateMemoryRequest,
  UpdateMemoryRequest
} from '../types/memory';
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
import { loadFullGlobalSettings, getDefaultProxySettings, addRepositoryToHistory, SettingsData, getSendGithubTokenOnSessionStart, getMemoryEnabled, getMemorySummarizeDrafts, AvailableManager } from '../types/settings';
import { ProxyUserInfo } from '../types/user';
import { handleAuthenticationRequired, isAuthenticationRequiredError } from './auth-error-handler';

// CredentialsMetadata represents the metadata returned by the credentials API
export interface CredentialsMetadata {
  name: string;
  has_data: boolean;
  created_at: string;
  updated_at: string;
}

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
  /** Provisioner error message when status is 'error' */
  message?: string;
}

/**
 * Proxy-wide session status change event emitted by GET /sessions/status/stream
 */
export interface ProxySessionStatusEvent {
  session_id: string;
  status: string;
  timestamp: string;
}

/**
 * Response from GET /sessions/:sessionId/messages/wait (long-poll).
 * Returns updated: true with session_id and timestamp when a message_update event occurred,
 * or updated: false when the timeout elapsed with no update.
 */
export type WaitSessionMessagesResponse =
  | { updated: true; session_id: string; timestamp: string }
  | { updated: false };

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

// ──────────────────────────────────────────────────────────────────────────────
// ACP (Agent Client Protocol) types
// ──────────────────────────────────────────────────────────────────────────────

/** Response from GET /{sessionId}/session for ACP sessions. */
export interface ACPSessionInfo {
  sessionId: string;
  status: string;
}

/** Discriminated union for ACP session/update payloads. */
export interface ACPSessionUpdate {
  sessionUpdate: string;
  // agent_message_chunk / user_message_chunk
  content?: { type: string; text?: string } | null;
  messageId?: string;
  // tool_call / tool_call_update
  toolCallId?: string;
  kind?: string;
  /** Human-readable tool title (e.g. "Terminal", "Task", "Find …"). Takes precedence over kind. */
  title?: string;
  status?: string;
  rawInput?: unknown;
  rawOutput?: unknown;
  // plan
  entries?: Array<{ content: string; status: string; priority: string }>;
}

/**
 * Maps ACP tool `kind` values to human-readable tool names shown in the UI.
 * `kind` carries the semantic tool type (e.g. "execute", "read"), while
 * `title` often contains the full command/path text which is not suitable
 * as a short display name.
 */
const ACP_KIND_TO_NAME: Record<string, string> = {
  execute: 'Bash',
  read: 'Read',
  write: 'Write',
  search: 'Search',
  think: 'Think',
  browse: 'Browser',
};

/**
 * Returns a short human-readable tool name for display.
 * Prefers the kind→name mapping; falls back to title, then kind, then 'tool'.
 */
function acpToolDisplayName(kind: string | undefined, title: string | undefined): string {
  if (kind && ACP_KIND_TO_NAME[kind]) return ACP_KIND_TO_NAME[kind];
  return title || kind || 'tool';
}

/** A permission option offered by the ACP agent. */
export interface ACPPermissionOption {
  optionId: string;
  name: string;
  kind?: string;
}

/** Params for session/request_permission (agent → client). */
export interface ACPPermissionParams {
  sessionId: string;
  toolCall: { toolCallId: string; kind?: string };
  options: ACPPermissionOption[];
}

/** Raw JSON-RPC 2.0 message envelope received from the SSE stream. */
export interface ACPJSONRPCMessage {
  jsonrpc: '2.0';
  id?: number | string | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Callbacks for subscribeToACPSessionEvents. */
export interface ACPSessionCallbacks {
  /** Called for each complete or streaming agent message. */
  onMessage: (message: SessionMessage) => void;
  /** Called with additional text to append to an existing streaming message. */
  onChunk: (messageId: number, text: string) => void;
  /** Called when agent status changes (e.g. prompt turn finished). */
  onStatus: (status: AgentStatus) => void;
  /** Called when a permission request arrives from the agent. */
  onPermission: (action: PendingAction, rpcId: number) => void;
  /** Called on transport errors. */
  onError: (error: Error) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract text from an ACP ContentBlock. */
function acpExtractText(content: ACPSessionUpdate['content']): string {
  if (!content) return '';
  if (content.type === 'text' && typeof content.text === 'string') return content.text;
  return '';
}

/** Convert ACP plan entries to a Markdown task list. */
function acpPlanToMarkdown(entries: NonNullable<ACPSessionUpdate['entries']>): string {
  let md = '## Plan\n\n';
  for (const e of entries) {
    const marker =
      e.status === 'completed' ? '- [x]' :
      e.status === 'in_progress' ? '- [~]' :
      e.status === 'cancelled' ? '- [!]' : '- [ ]';
    const priority =
      e.priority === 'high' ? ' 🔴' :
      e.priority === 'low' ? ' 🔵' : '';
    md += `${marker} ${e.content}${priority}\n`;
  }
  return md;
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

              // Auto-logout when the proxy rejects the request due to missing/expired session cookie
              if (isAuthenticationRequiredError(fallbackResponse.status, errorData)) {
                handleAuthenticationRequired();
              }

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

            // Handle 204 No Content (empty body)
            if (fallbackResponse.status === 204) {
              return undefined as T;
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

        // Handle 204 No Content (empty body)
        if (response.status === 204) {
          return undefined as T;
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

        // Auto-logout when the proxy rejects the request due to missing/expired session cookie
        if (isAuthenticationRequiredError(response.status, errorData)) {
          handleAuthenticationRequired();
        }

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

      // Handle 204 No Content (empty body)
      if (response.status === 204) {
        return undefined as T;
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

    // Apply memory settings from global settings
    if (typeof window !== 'undefined') {
      const memoryEnabled = getMemoryEnabled();
      if (!memoryEnabled) {
        // メモリ機能が無効の場合: memory_key を空のオブジェクトに設定し、
        // かつ tags も空にすることでメモリ統合を無効化する
        data.memory_key = {};
        // memory_summarize_drafts も false に設定してドラフト集約を抑制する
        data.memory_summarize_drafts = false;
      } else {
        // メモリ機能が有効の場合: memory_summarize_drafts の設定を適用する
        const memorySummarizeDrafts = getMemorySummarizeDrafts();
        if (memorySummarizeDrafts !== undefined) {
          data.memory_summarize_drafts = memorySummarizeDrafts;
        }
      }
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
    try {
      return await this.makeRequest<AgentStatus>(`/${sessionId}/status`);
    } catch (err) {
      if (err instanceof AgentAPIProxyError && err.status === 500) {
        // Provisioner has permanently failed – return the error status so polling
        // continues for other data without throwing and surface the message.
        return { status: 'error', message: err.message };
      }
      throw err;
    }
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

  /**
   * Long-poll for message updates in a specific session (GET /sessions/:sessionId/messages/wait).
   *
   * Blocks on the server until a message_update event is received from the agentapi backend
   * for the given session, or until the timeout expires.
   *
   * Returns { updated: true, session_id, timestamp } on update, or { updated: false } on timeout.
   * Callers should immediately re-issue the request to maintain continuous notification.
   *
   * @param sessionId - The session to watch for message updates.
   * @param options.timeout - Max wait seconds (default: 30, max: 60).
   * @param options.signal - AbortSignal to cancel the request (e.g. on component unmount).
   * @param options.since - Unix timestamp in milliseconds of the last known message update.
   *   If the session received a message_update after this time the server returns immediately
   *   with updated=true, allowing the client to catch up after a period of inactivity.
   */
  async waitSessionMessages(
    sessionId: string,
    options: { timeout?: number; signal?: AbortSignal; since?: number } = {}
  ): Promise<WaitSessionMessagesResponse> {
    const { timeout = 30, signal, since } = options;
    let endpoint = `/sessions/${sessionId}/messages/wait?timeout=${timeout}`;
    if (since !== undefined) {
      endpoint += `&since=${since}`;
    }

    if (this.debug) {
      console.log(`[AgentAPIProxy] Long-polling for message updates in session ${sessionId} (timeout=${timeout}s, since=${since})`);
    }

    return this.makeRequest<WaitSessionMessagesResponse>(endpoint, { signal });
  }

  /**
   * Subscribe to proxy-wide session status changes via SSE (GET /sessions/status/stream).
   * Each event carries the session_id, new status, and timestamp for any session
   * accessible by the current user.
   *
   * @returns The EventSource — call `.close()` to unsubscribe.
   */
  subscribeToSessionsStatusEvents(
    onEvent: (event: ProxySessionStatusEvent) => void,
    onError?: (error: Error) => void
  ): EventSource {
    const isUsingProxy = this.baseURL.includes('/api/proxy');
    const eventSourceUrl = isUsingProxy
      ? `/api/proxy/sessions/status/stream`
      : `${this.baseURL}/sessions/status/stream`;

    if (this.debug) {
      console.log(`[AgentAPIProxy] Creating EventSource for proxy-wide session status:`, eventSourceUrl);
    }

    const eventSource = new EventSource(eventSourceUrl);

    eventSource.onmessage = (event) => {
      // Skip heartbeat comments (EventSource ignores comment lines automatically,
      // but guard against empty data just in case)
      if (!event.data) return;
      try {
        const data: ProxySessionStatusEvent = JSON.parse(event.data);
        if (this.debug) {
          console.log(`[AgentAPIProxy] Proxy session status event:`, data);
        }
        onEvent(data);
      } catch (err) {
        console.error('[AgentAPIProxy] Failed to parse proxy session status event:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('[AgentAPIProxy] Proxy status EventSource error');
      if (onError) {
        onError(new Error('Proxy session status EventSource connection error'));
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
  async saveSettings(name: string, data: SettingsData): Promise<SettingsData> {
    const normalizedName = this.normalizeSettingsName(name);
    if (this.debug) {
      console.log(`[AgentAPIProxy] Saving settings for: ${name} (normalized: ${normalizedName})`, data);
    }
    const result = await this.makeRequest<SettingsData>(`/settings/${encodeURIComponent(normalizedName)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (this.debug) {
      console.log(`[AgentAPIProxy] Successfully saved settings for: ${name}`, result);
    }
    return result;
  }

  /**
   * Get all external session managers available to the authenticated user
   * (from user's own settings + all team settings they belong to)
   * GET /settings/managers
   */
  async getAvailableManagers(): Promise<AvailableManager[]> {
    try {
      const result = await this.makeRequest<{ managers: AvailableManager[] }>('/settings/managers');
      return result.managers || [];
    } catch (error) {
      if (error instanceof AgentAPIProxyError && error.status === 404) {
        if (this.debug) {
          console.log('[AgentAPIProxy] /settings/managers not available, returning empty list');
        }
        return [];
      }
      throw error;
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

  // Credentials operations

  /**
   * Get credential metadata (does not return raw data)
   * GET /credentials/{name}
   */
  async getCredentials(name: string): Promise<CredentialsMetadata | null> {
    try {
      return await this.makeRequest<CredentialsMetadata>(`/credentials/${encodeURIComponent(name)}`);
    } catch (error) {
      if (error instanceof AgentAPIProxyError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Upload or replace credential JSON data
   * PUT /credentials/{name}
   */
  async uploadCredentials(name: string, data: Record<string, unknown>): Promise<CredentialsMetadata> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Uploading credentials: ${name}`);
    }
    return await this.makeRequest<CredentialsMetadata>(`/credentials/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete credentials
   * DELETE /credentials/{name}
   */
  async deleteCredentials(name: string): Promise<void> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleting credentials: ${name}`);
    }
    await this.makeRequest<void>(`/credentials/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
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

  // SlackBot operations

  /**
   * Create a new SlackBot
   */
  async createSlackBot(data: CreateSlackBotRequest): Promise<SlackBot> {
    if (this.debug) {
      console.log('[AgentAPIProxy] Creating slackbot:', data);
    }

    const slackbot = await this.makeRequest<SlackBot>('/slackbots', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Created slackbot: ${slackbot.id}`);
    }

    return slackbot;
  }

  /**
   * Get list of SlackBots
   */
  async getSlackBots(params?: SlackBotListParams): Promise<SlackBotListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.set('status', params.status);
    if (params?.scope) searchParams.set('scope', params.scope);
    if (params?.team_id) searchParams.set('team_id', params.team_id);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const endpoint = `/slackbots${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<SlackBot[] | SlackBotListResponse>(endpoint);

    // API returns array directly (not wrapped in object)
    if (Array.isArray(result)) {
      return { slackbots: result };
    }

    return {
      ...result,
      slackbots: result.slackbots || []
    };
  }

  /**
   * Get a specific SlackBot by ID
   */
  async getSlackBot(slackbotId: string): Promise<SlackBot> {
    return this.makeRequest<SlackBot>(`/slackbots/${slackbotId}`);
  }

  /**
   * Update a SlackBot
   */
  async updateSlackBot(slackbotId: string, data: UpdateSlackBotRequest): Promise<SlackBot> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Updating slackbot ${slackbotId}:`, data);
    }

    const slackbot = await this.makeRequest<SlackBot>(`/slackbots/${slackbotId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Updated slackbot: ${slackbot.id}`);
    }

    return slackbot;
  }

  /**
   * Delete a SlackBot
   */
  async deleteSlackBot(slackbotId: string): Promise<void> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleting slackbot: ${slackbotId}`);
    }

    await this.makeRequest<void>(`/slackbots/${slackbotId}`, {
      method: 'DELETE',
    });

    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleted slackbot: ${slackbotId}`);
    }
  }

  // ============================================================
  // Memory methods
  // ============================================================

  /**
   * List memory entries
   * includeTags is expanded to include_tag.{key}={value} query params
   */
  async listMemories(params?: MemoryListParams): Promise<MemoryListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.set('scope', params.scope);
    if (params?.team_id) searchParams.set('team_id', params.team_id);
    if (params?.includeTags) {
      for (const [key, value] of Object.entries(params.includeTags)) {
        searchParams.set(`include_tag.${key}`, value);
      }
    }
    const endpoint = `/memories${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.makeRequest<Memory[] | MemoryListResponse>(endpoint);
    if (Array.isArray(result)) {
      return { memories: result, total: result.length };
    }
    return {
      memories: result.memories || [],
      total: result.total ?? (result.memories?.length ?? 0),
    };
  }

  /**
   * Create a memory entry
   */
  async createMemory(data: CreateMemoryRequest): Promise<Memory> {
    if (this.debug) {
      console.log('[AgentAPIProxy] Creating memory:', data);
    }
    const memory = await this.makeRequest<Memory>('/memories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (this.debug) {
      console.log(`[AgentAPIProxy] Created memory: ${memory.id}`);
    }
    return memory;
  }

  /**
   * Get a specific memory entry by ID
   */
  async getMemory(memoryId: string): Promise<Memory> {
    return this.makeRequest<Memory>(`/memories/${memoryId}`);
  }

  /**
   * Update a memory entry
   */
  async updateMemory(memoryId: string, data: UpdateMemoryRequest): Promise<Memory> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Updating memory ${memoryId}:`, data);
    }
    const memory = await this.makeRequest<Memory>(`/memories/${memoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (this.debug) {
      console.log(`[AgentAPIProxy] Updated memory: ${memory.id}`);
    }
    return memory;
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(memoryId: string): Promise<{ success: boolean }> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleting memory: ${memoryId}`);
    }
    const result = await this.makeRequest<{ success: boolean }>(`/memories/${memoryId}`, {
      method: 'DELETE',
    });
    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleted memory: ${memoryId}`);
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // User-managed Files (/files)
  // ---------------------------------------------------------------------------

  /**
   * List all user-managed files
   * GET /files
   */
  async listFiles(): Promise<import('../types/user_file').FileListResponse> {
    if (this.debug) {
      console.log('[AgentAPIProxy] Listing user files');
    }
    return this.makeRequest<import('../types/user_file').FileListResponse>('/files');
  }

  /**
   * Get a single user-managed file
   * GET /files/{fileId}
   */
  async getFile(fileId: string): Promise<import('../types/user_file').UserFile> {
    return this.makeRequest<import('../types/user_file').UserFile>(`/files/${encodeURIComponent(fileId)}`);
  }

  /**
   * Create a user-managed file
   * POST /files
   */
  async createFile(data: import('../types/user_file').CreateFileRequest): Promise<import('../types/user_file').UserFile> {
    if (this.debug) {
      console.log('[AgentAPIProxy] Creating user file:', data.path);
    }
    return this.makeRequest<import('../types/user_file').UserFile>('/files', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a user-managed file
   * PUT /files/{fileId}
   */
  async updateFile(fileId: string, data: import('../types/user_file').UpdateFileRequest): Promise<import('../types/user_file').UserFile> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Updating user file: ${fileId}`);
    }
    return this.makeRequest<import('../types/user_file').UserFile>(`/files/${encodeURIComponent(fileId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a user-managed file
   * DELETE /files/{fileId}
   */
  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    if (this.debug) {
      console.log(`[AgentAPIProxy] Deleting user file: ${fileId}`);
    }
    return this.makeRequest<{ success: boolean }>(`/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ACP (Agent Client Protocol) HTTP transport
  //
  // ACP sessions expose a minimal 2-endpoint HTTP transport instead of the
  // agentapi-compatible REST API:
  //
  //   GET  /{sessionId}/session  – session info (acpSessionId, status)
  //   POST /{sessionId}/rpc      – JSON-RPC 2.0 messages (client → agent)
  //   GET  /{sessionId}/sse      – SSE stream of JSON-RPC 2.0 messages (agent → client)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns ACP session info if the session uses ACP transport, null otherwise.
   * Use this to detect whether a session is ACP-based.
   */
  async getACPSessionInfo(sessionId: string): Promise<ACPSessionInfo | null> {
    try {
      console.log(`[ACP] getACPSessionInfo called (proxySessionId=${sessionId})`);
      const info = await this.makeRequest<ACPSessionInfo>(`/${sessionId}/session`);
      console.log(`[ACP] getACPSessionInfo result:`, info);
      if (info?.sessionId) return info;
      return null;
    } catch (err) {
      console.warn(`[ACP] getACPSessionInfo failed (proxySessionId=${sessionId}):`, err);
      return null;
    }
  }

  /**
   * Fetch the full message history from the ACP bridge's in-memory store.
   * Returns parsed SessionMessage array reconstructed from the stored JSON-RPC messages.
   * Used on reconnect to replay events that arrived before the SSE connection was established.
   */
  async getACPMessageHistory(
    sessionId: string,
    acpSessionId: string
  ): Promise<SessionMessage[]> {
    try {
      const resp = await this.makeRequest<{ messages: ACPJSONRPCMessage[] }>(`/${sessionId}/messages`);
      const rawMsgs = resp?.messages ?? [];
      const result: SessionMessage[] = [];
      let nextLocalId = Date.now(); // use timestamp-based IDs to avoid collision with SSE ids
      let streamingMsgId: number | null = null;

      for (const msg of rawMsgs) {
        if (msg.method === 'session/update') {
          const acpParams = msg.params as { sessionId: string; update: ACPSessionUpdate; time?: string };
          const update = acpParams?.update;
          if (!update) continue;
          const now = acpParams?.time || new Date().toISOString();

          switch (update.sessionUpdate) {
            case 'agent_message_chunk': {
              const text = acpExtractText(update.content);
              if (!text) continue;
              if (streamingMsgId !== null) {
                // Append to existing streaming message.
                const idx = result.findIndex(m => m.id === streamingMsgId);
                if (idx >= 0) result[idx] = { ...result[idx], content: result[idx].content + text };
              } else {
                const id = nextLocalId++;
                streamingMsgId = id;
                result.push({ id, role: 'agent', content: text, time: now, type: 'normal' });
              }
              break;
            }
            case 'tool_call': {
              streamingMsgId = null;
              const toolObj = { type: 'tool_use', name: acpToolDisplayName(update.kind, update.title), id: update.toolCallId, input: update.rawInput ?? {}, title: update.title };
              result.push({ id: nextLocalId++, role: 'agent', content: JSON.stringify(toolObj), time: now, type: 'normal', toolUseId: update.toolCallId });
              break;
            }
            case 'tool_call_update': {
              const isSuccess = update.status === 'completed' || update.status === 'success';
              const isError = update.status === 'failed' || update.status === 'error';
              if (!isSuccess && !isError) continue;
              const content = update.rawOutput != null ? (typeof update.rawOutput === 'string' ? update.rawOutput : JSON.stringify(update.rawOutput)) : '';
              result.push({ id: nextLocalId++, role: 'tool_result', content, time: now, type: 'normal', parentToolUseId: update.toolCallId, status: isSuccess ? 'success' : 'error' });
              break;
            }
            case 'plan': {
              streamingMsgId = null;
              if (!update.entries || update.entries.length === 0) continue;
              result.push({ id: nextLocalId++, role: 'agent', content: acpPlanToMarkdown(update.entries), time: now, type: 'plan' });
              break;
            }
            case 'user_message_chunk': {
              const text = acpExtractText(update.content);
              if (!text) continue;
              result.push({ id: nextLocalId++, role: 'user', content: text, time: now, type: 'normal' });
              break;
            }
            default:
              streamingMsgId = null;
          }
        } else if (msg.result != null || msg.error) {
          // prompt result/error: reset streaming state
          streamingMsgId = null;
        }
      }
      console.log(`[ACP] getACPMessageHistory: ${result.length} messages restored`);
      return result;
    } catch (err) {
      console.warn(`[ACP] getACPMessageHistory failed:`, err);
      return [];
    }
  }

  /**
   * Subscribe to ACP session events via SSE at /{sessionId}/sse.
   *
   * The SSE stream emits raw JSON-RPC 2.0 messages from the ACP agent:
   *   - session/update notifications  → converted to SessionMessage via callbacks.onMessage
   *   - session/request_permission    → converted to PendingAction via callbacks.onPermission
   *   - session/prompt result         → signals turn end via callbacks.onStatus({status:'stable'})
   *
   * Returns the EventSource; call .close() to unsubscribe.
   */
  subscribeToACPSessionEvents(
    sessionId: string,
    acpSessionId: string,
    callbacks: ACPSessionCallbacks
  ): EventSource {
    const isUsingProxy = this.baseURL.includes('/api/proxy');
    const sseUrl = isUsingProxy
      ? `/api/proxy/${sessionId}/sse`
      : `${this.baseURL}/${sessionId}/sse`;

    if (this.debug) {
      console.log(`[AgentAPIProxy] ACP SSE subscribe: ${sseUrl}`);
    }

    const eventSource = new EventSource(sseUrl);
    let nextLocalId = 1;
    // Track the current streaming agent message id (for chunk accumulation).
    let streamingMsgId: number | null = null;

    console.log(`[ACP] EventSource created (url=${sseUrl}, acpSessionId=${acpSessionId})`);

    eventSource.addEventListener('open', () => {
      console.log(`[ACP] SSE connection opened (url=${sseUrl}, acpSessionId=${acpSessionId})`);
    });

    eventSource.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg: ACPJSONRPCMessage = JSON.parse(event.data);

        if (this.debug) {
          console.log('[AgentAPIProxy] ACP SSE message:', msg);
        }

        // ── session/update notification ──────────────────────────────────
        if (msg.method === 'session/update') {
          const acpParams = msg.params as { sessionId: string; update: ACPSessionUpdate; time?: string };
          const update = acpParams?.update;
          if (!update) return;

          const now = acpParams?.time || new Date().toISOString();

          switch (update.sessionUpdate) {
            case 'agent_message_chunk': {
              const text = acpExtractText(update.content);
              if (!text) return;

              // Agent is actively streaming — mark as running so the UI
              // suppresses input and shows the stop button even when the
              // prompt was sent by the provisioner (stock session pickup).
              callbacks.onStatus({ status: 'running' });

              if (streamingMsgId !== null) {
                // Append to existing streaming message.
                callbacks.onChunk(streamingMsgId, text);
              } else {
                // Start a new streaming message.
                const id = nextLocalId++;
                streamingMsgId = id;
                callbacks.onMessage({
                  id,
                  role: 'agent',
                  content: text,
                  time: now,
                  type: 'normal',
                });
              }
              break;
            }

            case 'tool_call': {
              // Finalize any streaming text before the tool call.
              streamingMsgId = null;
              // Tool is executing — keep the running state.
              callbacks.onStatus({ status: 'running' });
              const toolObj = {
                type: 'tool_use',
                // Use kind→name mapping for a proper tool name (e.g. "Bash" for "execute").
                // title often contains the full command/path text, not a short name.
                name: acpToolDisplayName(update.kind, update.title),
                id: update.toolCallId,
                input: update.rawInput ?? {},
                title: update.title,
              };
              callbacks.onMessage({
                id: nextLocalId++,
                role: 'agent',
                content: JSON.stringify(toolObj),
                time: now,
                type: 'normal',
                toolUseId: update.toolCallId,
              });
              break;
            }

            case 'tool_call_update': {
              const isSuccess = update.status === 'completed' || update.status === 'success';
              const isError = update.status === 'failed' || update.status === 'error';
              if (!isSuccess && !isError) return;

              const content = update.rawOutput != null
                ? (typeof update.rawOutput === 'string' ? update.rawOutput : JSON.stringify(update.rawOutput))
                : '';
              callbacks.onMessage({
                id: nextLocalId++,
                role: 'tool_result',
                content,
                time: now,
                type: 'normal',
                parentToolUseId: update.toolCallId,
                status: isSuccess ? 'success' : 'error',
              });
              break;
            }

            case 'plan': {
              streamingMsgId = null;
              if (!update.entries || update.entries.length === 0) return;
              const planMD = acpPlanToMarkdown(update.entries);
              callbacks.onMessage({
                id: nextLocalId++,
                role: 'agent',
                content: planMD,
                time: now,
                type: 'plan',
              });
              break;
            }

            case 'user_message_chunk': {
              const text = acpExtractText(update.content);
              if (!text) return;
              callbacks.onMessage({
                id: nextLocalId++,
                role: 'user',
                content: text,
                time: now,
                type: 'normal',
              });
              break;
            }
          }
          return;
        }

        // ── session/request_permission (agent → client RPC) ──────────────
        if (msg.method === 'session/request_permission' && msg.id != null) {
          streamingMsgId = null;
          const params = msg.params as ACPPermissionParams;
          const action: PendingAction = {
            type: 'answer_question',
            tool_use_id: params.toolCall?.toolCallId ?? '',
            content: {
              questions: [{
                question: 'Permission required',
                header: 'Permission Required',
                options: (params.options ?? []).map(o => ({
                  label: o.name || o.optionId,
                  description: o.kind ?? '',
                })),
                multiSelect: false,
              }],
            },
          };
          callbacks.onPermission(action, msg.id as number);
          return;
        }

        // ── Result of session/prompt (turn finished) ──────────────────────
        if (msg.result != null && msg.id != null) {
          streamingMsgId = null;
          callbacks.onStatus({ status: 'stable' });
          return;
        }

        // ── Error on session/prompt ───────────────────────────────────────
        if (msg.error && msg.id != null) {
          streamingMsgId = null;
          callbacks.onStatus({ status: 'stable' });
          callbacks.onError(new Error(msg.error.message));
          return;
        }

      } catch (err) {
        if (this.debug) {
          console.error('[AgentAPIProxy] ACP SSE parse error:', err);
        }
        callbacks.onError(err instanceof Error ? err : new Error('Failed to parse ACP SSE message'));
      }
    });

    eventSource.onerror = (event) => {
      // EventSource.readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
      const state = eventSource.readyState;
      console.error(`[ACP] SSE onerror (url=${sseUrl}, acpSessionId=${acpSessionId}, readyState=${state})`, event);
      if (state === EventSource.CLOSED) {
        console.error(`[ACP] SSE connection permanently closed`);
      } else {
        // readyState=CONNECTING means the browser is auto-reconnecting.
        console.warn(`[ACP] SSE error – browser will auto-reconnect (readyState=${state})`);
      }
      callbacks.onError(new Error(`ACP SSE connection error (readyState=${state})`));
    };

    return eventSource;
  }

  /**
   * Send a session/prompt request to the ACP agent.
   * The result (stopReason) arrives asynchronously via the SSE stream.
   * @param promptId - JSON-RPC id; correlates the SSE result message.
   */
  async sendACPPrompt(
    sessionId: string,
    acpSessionId: string,
    text: string,
    promptId: number
  ): Promise<void> {
    await this.makeRequest<unknown>(`/${sessionId}/rpc`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: promptId,
        method: 'session/prompt',
        params: {
          sessionId: acpSessionId,
          prompt: [{ type: 'text', text }],
        },
      }),
    });
  }

  /**
   * Reply to a session/request_permission RPC that arrived via SSE.
   * @param rpcId  - The JSON-RPC id from the SSE message.
   * @param optionId - The selected option id to send back.
   */
  async replyToACPPermission(
    sessionId: string,
    rpcId: number,
    optionId: string
  ): Promise<void> {
    await this.makeRequest<unknown>(`/${sessionId}/rpc`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          outcome: { outcome: 'selected', optionId },
        },
      }),
    });
  }

  /**
   * Cancel the current ACP session turn.
   */
  async cancelACPSession(sessionId: string, acpSessionId: string): Promise<void> {
    await this.makeRequest<unknown>(`/${sessionId}/rpc`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'session/cancel',
        params: { sessionId: acpSessionId },
      }),
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
