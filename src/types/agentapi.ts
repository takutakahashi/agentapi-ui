// AgentAPI TypeScript types based on the API documentation

// Define AgentStatus locally
export interface AgentStatus {
  status: 'stable' | 'running' | 'error';
  last_activity?: string;
  current_task?: string;
}

export interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  updated_at: string;
  config: AgentConfig;
  metrics?: AgentMetrics;
}

export interface AgentConfig {
  type: string;
  parameters: Record<string, unknown>;
  timeout?: number;
  retry_policy?: {
    max_retries: number;
    backoff_factor: number;
  };
}

export interface CreateAgentRequest {
  name: string;
  config: AgentConfig;
}

export interface UpdateAgentRequest {
  name?: string;
  config?: Partial<AgentConfig>;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
  limit: number;
}

export interface AgentListParams {
  page?: number;
  limit?: number;
  status?: Agent['status'];
  name?: string;
}

// Metrics types
export interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  uptime: number;
}

export interface AgentMetrics {
  agent_id: string;
  requests_processed: number;
  success_rate: number;
  average_response_time: number;
  last_activity: string;
}

export interface RequestMetrics {
  total: number;
  per_minute: number;
  success_rate: number;
  error_rate: number;
}

export interface Metrics {
  timestamp: string;
  system: SystemMetrics;
  agents: AgentMetrics[];
  requests: RequestMetrics;
}

export interface MetricsHistoryParams {
  from: string;
  to: string;
  interval?: string;
  agent_id?: string;
}

// Configuration types
export interface LoggingConfig {
  level: 'info' | 'debug' | 'warn' | 'error';
  format: 'json' | 'text';
}

export interface AuthConfig {
  enabled: boolean;
  provider: string;
}

export interface LimitsConfig {
  max_agents: number;
  request_rate: number;
}

export interface SystemConfig {
  logging: LoggingConfig;
  auth: AuthConfig;
  limits: LimitsConfig;
}

// WebSocket types
export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'agent_update' | 'metrics_update';
  channel?: 'agents' | 'metrics';
  agent_id?: string;
  interval?: number;
  data?: unknown;
}

export interface WebSocketOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// Error types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface APIErrorResponse {
  error: APIError;
}

// API Client configuration
export interface AgentAPIClientConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  debug?: boolean;
}

// Rate limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// Session status types based on agentapi-proxy OpenAPI specification
export type SessionStatus = 'creating' | 'starting' | 'active' | 'unhealthy' | 'stopped' | 'unknown';

// Resource scope types for team support
export type ResourceScope = 'user' | 'team';

// Session types for agentapi-proxy
export interface Session {
  session_id: string;
  user_id: string;
  status: SessionStatus;
  started_at: string;
  updated_at?: string;
  addr?: string;
  description?: string;
  environment?: Record<string, string>;
  metadata?: Record<string, unknown>;
  tags?: Record<string, string>;
  scope?: ResourceScope;
  team_id?: string;
}

export interface SessionListParams {
  user_id?: string;
  status?: Session['status'];
  page?: number;
  limit?: number;
  scope?: ResourceScope;
  team_id?: string;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateSessionRequest {
  user_id: string;
  environment?: Record<string, string>;
  metadata?: Record<string, unknown>;
  tags?: Record<string, string>;
  params?: {
    message?: string;
    github_token?: string;
    [key: string]: unknown;
  };
  scope?: ResourceScope;
  team_id?: string;
}

// Session message types
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_result' | 'agent';
  content: string;
  timestamp: string;
  session_id: string;
  metadata?: Record<string, unknown>;
  type?: 'normal' | 'error';
  toolUseId?: string;
  parentToolUseId?: string;
  status?: 'success' | 'error';
  time?: string;
}

export interface SessionMessageListResponse {
  messages: SessionMessage[];
  total: number;
  page: number;
  limit: number;
}

export interface SessionMessageListParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}

export interface SendSessionMessageRequest {
  content: string;
  type: 'user' | 'system' | 'raw';
}

// Session events types for Server-Sent Events
export interface SessionEventData {
  type: 'message' | 'status' | 'error';
  data: SessionMessage | AgentStatus | { error: string };
  timestamp: string;
}

export interface SessionEventsOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}