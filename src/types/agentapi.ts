// API TypeScript types for conversations and sessions

// Metrics types
export interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  uptime: number;
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
  requests: RequestMetrics;
}

export interface MetricsHistoryParams {
  from: string;
  to: string;
  interval?: string;
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
  request_rate: number;
}

export interface SystemConfig {
  logging: LoggingConfig;
  auth: AuthConfig;
  limits: LimitsConfig;
}

// WebSocket types
export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'metrics_update';
  channel?: 'metrics';
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
export interface ProxyClientConfig {
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

// Session types for agentapi-proxy
export interface Session {
  session_id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  updated_at: string;
  environment?: Record<string, string>;
  metadata?: Record<string, unknown>;
  tags?: Record<string, string>;
}

export interface SessionListParams {
  user_id?: string;
  status?: Session['status'];
  page?: number;
  limit?: number;
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
}

// Session message types
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  session_id: string;
  metadata?: Record<string, unknown>;
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
  type: 'user' | 'system';
}

// Session events types for Server-Sent Events
export interface SessionEventData {
  type: 'message' | 'status' | 'error';
  data: SessionMessage | { status: string } | { error: string };
  timestamp: string;
}

export interface SessionEventsOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}