// Types for the actual agentapi based on OpenAPI specification
// https://github.com/coder/agentapi/blob/main/openapi.json

export interface AgentStatus {
  status: 'stable' | 'running';
  version?: string;
}

export interface Message {
  id: number;
  content: string;
  role: 'user' | 'agent';
  timestamp: string;
}

export interface MessagesResponse {
  messages: Message[];
}

export interface SendMessageRequest {
  content: string;
  type?: 'user' | 'raw';
}

export interface SendMessageResponse {
  id: number;
  content: string;
  role: 'user' | 'agent';
  timestamp: string;
}

export interface EventData {
  type: 'message_update' | 'status_change';
  data: Message | AgentStatus;
}

export interface RealAgentAPIConfig {
  baseURL: string;
  timeout?: number;
  debug?: boolean;
}

export interface APIError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}