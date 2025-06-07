// AgentAPI TypeScript types based on the API documentation

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
  parameters: Record<string, any>;
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
  data?: any;
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
  details?: Record<string, any>;
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