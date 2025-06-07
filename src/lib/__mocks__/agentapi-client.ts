import {
  Agent,
  AgentListResponse,
  AgentListParams,
  CreateAgentRequest,
  UpdateAgentRequest,
  Metrics,
  SystemConfig,
  AgentAPIClientConfig,
  WebSocketMessage
} from '../../types/agentapi';
import { AgentAPIError } from '../agentapi-client';

// Mock data
export const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Test Agent 1',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T12:00:00Z',
    config: {
      type: 'openai',
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
      },
      timeout: 30000,
      retry_policy: {
        max_retries: 3,
        backoff_factor: 2,
      },
    },
    metrics: {
      agent_id: 'agent-1',
      requests_processed: 150,
      success_rate: 0.95,
      average_response_time: 1200,
      last_activity: '2024-01-01T11:30:00Z',
    },
  },
  {
    id: 'agent-2',
    name: 'Test Agent 2',
    status: 'inactive',
    created_at: '2024-01-01T01:00:00Z',
    updated_at: '2024-01-01T01:30:00Z',
    config: {
      type: 'claude',
      parameters: {
        model: 'claude-3-sonnet',
        max_tokens: 4000,
      },
    },
  },
  {
    id: 'agent-3',
    name: 'Error Agent',
    status: 'error',
    created_at: '2024-01-01T02:00:00Z',
    updated_at: '2024-01-01T02:15:00Z',
    config: {
      type: 'custom',
      parameters: {
        endpoint: 'https://api.example.com',
      },
    },
  },
];

export const mockMetrics: Metrics = {
  timestamp: '2024-01-01T12:00:00Z',
  system: {
    cpu_usage: 0.45,
    memory_usage: 0.67,
    disk_usage: 0.23,
    uptime: 86400,
  },
  agents: [
    {
      agent_id: 'agent-1',
      requests_processed: 150,
      success_rate: 0.95,
      average_response_time: 1200,
      last_activity: '2024-01-01T11:30:00Z',
    },
    {
      agent_id: 'agent-2',
      requests_processed: 0,
      success_rate: 0,
      average_response_time: 0,
      last_activity: '2024-01-01T01:30:00Z',
    },
  ],
  requests: {
    total: 1500,
    per_minute: 25,
    success_rate: 0.98,
    error_rate: 0.02,
  },
};

export const mockSystemConfig: SystemConfig = {
  logging: {
    level: 'info',
    format: 'json',
  },
  auth: {
    enabled: true,
    provider: 'bearer',
  },
  limits: {
    max_agents: 100,
    request_rate: 1000,
  },
};

// Mock WebSocket class
export class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  private subscriptions = new Set<string>();

  constructor(url: string) {
    super();
    this.url = url;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 100);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      if (message.type === 'subscribe' && message.channel) {
        this.subscriptions.add(message.channel);
        
        // Simulate immediate response for subscription
        setTimeout(() => {
          const response = {
            type: 'subscription_confirmed',
            channel: message.channel,
          };
          this.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify(response),
          }));
        }, 50);

        // Start sending mock updates
        this.startMockUpdates(message.channel, message.agent_id, message.interval);
      } else if (message.type === 'unsubscribe' && message.channel) {
        this.subscriptions.delete(message.channel);
      }
    } catch (error) {
      console.error('Invalid WebSocket message:', error);
    }
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.dispatchEvent(new Event('close'));
    }, 100);
  }

  private startMockUpdates(channel: string, agentId?: string, interval = 5000): void {
    const sendUpdate = () => {
      if (!this.subscriptions.has(channel) || this.readyState !== MockWebSocket.OPEN) {
        return;
      }

      let updateData;
      if (channel === 'agents') {
        updateData = {
          type: 'agent_update',
          agent_id: agentId || 'agent-1',
          agent: mockAgents.find(a => a.id === (agentId || 'agent-1')),
        };
      } else if (channel === 'metrics') {
        updateData = {
          type: 'metrics_update',
          data: {
            ...mockMetrics,
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (updateData) {
        this.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify(updateData),
        }));
      }

      // Schedule next update
      setTimeout(sendUpdate, interval);
    };

    // Start sending updates after initial delay
    setTimeout(sendUpdate, interval);
  }
}

// Mock AgentAPI client
export class MockAgentAPIClient {
  private config: AgentAPIClientConfig;
  private mockDelay: number;
  private shouldFailRequests: boolean;

  constructor(config: AgentAPIClientConfig) {
    this.config = config;
    this.mockDelay = 100; // Simulate network delay
    this.shouldFailRequests = false;
  }

  private async delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.mockDelay));
  }

  private async mockRequest<T>(data: T): Promise<T> {
    await this.delay();
    
    if (this.shouldFailRequests) {
      throw new AgentAPIError(500, 'MOCK_ERROR', 'Mock error for testing');
    }
    
    return data;
  }

  // Agent Management Methods
  async getAgents(params?: AgentListParams): Promise<AgentListResponse> {
    let filteredAgents = [...mockAgents];
    
    if (params?.status) {
      filteredAgents = filteredAgents.filter(agent => agent.status === params.status);
    }
    
    if (params?.name) {
      filteredAgents = filteredAgents.filter(agent => 
        agent.name.toLowerCase().includes(params.name!.toLowerCase())
      );
    }

    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedAgents = filteredAgents.slice(startIndex, endIndex);

    return this.mockRequest({
      agents: paginatedAgents,
      total: filteredAgents.length,
      page,
      limit,
    });
  }

  async getAgent(id: string): Promise<Agent> {
    const agent = mockAgents.find(a => a.id === id);
    if (!agent) {
      throw new AgentAPIError(404, 'AGENT_NOT_FOUND', `Agent with id ${id} not found`);
    }
    return this.mockRequest(agent);
  }

  async createAgent(data: CreateAgentRequest): Promise<Agent> {
    const newAgent: Agent = {
      id: `agent-${Date.now()}`,
      name: data.name,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      config: data.config,
    };
    
    mockAgents.push(newAgent);
    return this.mockRequest(newAgent);
  }

  async updateAgent(id: string, data: UpdateAgentRequest): Promise<Agent> {
    const agentIndex = mockAgents.findIndex(a => a.id === id);
    if (agentIndex === -1) {
      throw new AgentAPIError(404, 'AGENT_NOT_FOUND', `Agent with id ${id} not found`);
    }

    const updatedAgent = {
      ...mockAgents[agentIndex],
      ...data,
      updated_at: new Date().toISOString(),
    };
    
    mockAgents[agentIndex] = updatedAgent;
    return this.mockRequest(updatedAgent);
  }

  async deleteAgent(id: string): Promise<void> {
    const agentIndex = mockAgents.findIndex(a => a.id === id);
    if (agentIndex === -1) {
      throw new AgentAPIError(404, 'AGENT_NOT_FOUND', `Agent with id ${id} not found`);
    }
    
    mockAgents.splice(agentIndex, 1);
    await this.mockRequest(undefined);
  }

  // Metrics Methods
  async getMetrics(): Promise<Metrics> {
    return this.mockRequest({
      ...mockMetrics,
      timestamp: new Date().toISOString(),
    });
  }

  async getAgentMetrics(agentId: string): Promise<AgentMetrics> {
    const agentMetrics = mockMetrics.agents.find(m => m.agent_id === agentId);
    if (!agentMetrics) {
      throw new AgentAPIError(404, 'METRICS_NOT_FOUND', `Metrics for agent ${agentId} not found`);
    }
    return this.mockRequest(agentMetrics);
  }

  async getMetricsHistory(): Promise<Metrics[]> {
    // Mock historical data
    const history = Array.from({ length: 10 }, (_, i) => ({
      ...mockMetrics,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(), // Hour intervals
    }));
    
    return this.mockRequest(history);
  }

  // Configuration Methods
  async getConfig(): Promise<SystemConfig> {
    return this.mockRequest(mockSystemConfig);
  }

  async updateConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
    const updatedConfig = {
      ...mockSystemConfig,
      ...config,
    };
    Object.assign(mockSystemConfig, updatedConfig);
    return this.mockRequest(updatedConfig);
  }

  // WebSocket Methods
  createWebSocket(): MockWebSocket {
    return new MockWebSocket(this.config.baseURL.replace(/^http/, 'ws') + '/websocket');
  }

  subscribeToAgents(ws: MockWebSocket, agentId?: string): void {
    const message = {
      type: 'subscribe' as const,
      channel: 'agents' as const,
      agent_id: agentId,
    };
    ws.send(JSON.stringify(message));
  }

  subscribeToMetrics(ws: MockWebSocket, interval = 5000): void {
    const message = {
      type: 'subscribe' as const,
      channel: 'metrics' as const,
      interval,
    };
    ws.send(JSON.stringify(message));
  }

  unsubscribeFromChannel(ws: MockWebSocket, channel: 'agents' | 'metrics'): void {
    const message = {
      type: 'unsubscribe' as const,
      channel,
    };
    ws.send(JSON.stringify(message));
  }

  // Utility Methods
  async healthCheck(): Promise<boolean> {
    await this.delay();
    return !this.shouldFailRequests;
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  setDebug(debug: boolean): void {
    this.config.debug = debug;
  }

  // Testing utilities
  setMockDelay(delay: number): void {
    this.mockDelay = delay;
  }

  setShouldFailRequests(shouldFail: boolean): void {
    this.shouldFailRequests = shouldFail;
  }

  resetMockData(): void {
    // Reset to original mock data
    mockAgents.length = 0;
    mockAgents.push(
      {
        id: 'agent-1',
        name: 'Test Agent 1',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T12:00:00Z',
        config: {
          type: 'openai',
          parameters: { model: 'gpt-4', temperature: 0.7 },
          timeout: 30000,
          retry_policy: { max_retries: 3, backoff_factor: 2 },
        },
        metrics: {
          agent_id: 'agent-1',
          requests_processed: 150,
          success_rate: 0.95,
          average_response_time: 1200,
          last_activity: '2024-01-01T11:30:00Z',
        },
      },
      {
        id: 'agent-2',
        name: 'Test Agent 2',
        status: 'inactive',
        created_at: '2024-01-01T01:00:00Z',
        updated_at: '2024-01-01T01:30:00Z',
        config: {
          type: 'claude',
          parameters: { model: 'claude-3-sonnet', max_tokens: 4000 },
        },
      },
      {
        id: 'agent-3',
        name: 'Error Agent',
        status: 'error',
        created_at: '2024-01-01T02:00:00Z',
        updated_at: '2024-01-01T02:15:00Z',
        config: {
          type: 'custom',
          parameters: { endpoint: 'https://api.example.com' },
        },
      }
    );
  }
}

// Export mock factory
export function createMockAgentAPIClient(config: AgentAPIClientConfig): MockAgentAPIClient {
  return new MockAgentAPIClient(config);
}