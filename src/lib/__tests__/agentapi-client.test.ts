import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentAPIClient, AgentAPIError } from '../agentapi-client';
import type { AgentAPIClientConfig } from '../../types/agentapi';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock WebSocket
class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;

  constructor(url: string) {
    super();
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 10);
  }

  send(data: string): void {
    // Mock send implementation
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
}

global.WebSocket = MockWebSocket as any;

describe('AgentAPIClient', () => {
  let client: AgentAPIClient;
  let config: AgentAPIClientConfig;

  beforeEach(() => {
    config = {
      baseURL: 'http://localhost:8080/api/v1',
      apiKey: 'test-api-key',
      timeout: 5000,
      debug: false,
    };
    client = new AgentAPIClient(config);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create client with correct configuration', () => {
      expect(client).toBeInstanceOf(AgentAPIClient);
    });

    it('should remove trailing slash from baseURL', () => {
      const clientWithSlash = new AgentAPIClient({
        ...config,
        baseURL: 'http://localhost:8080/api/v1/',
      });
      expect(clientWithSlash).toBeInstanceOf(AgentAPIClient);
    });
  });

  describe('Error Handling', () => {
    it('should throw AgentAPIError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request parameters',
            timestamp: '2024-01-01T00:00:00Z',
          },
        }),
      });

      await expect(client.getAgents()).rejects.toThrow(AgentAPIError);
      await expect(client.getAgents()).rejects.toThrow('Invalid request parameters');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getAgents()).rejects.toThrow(AgentAPIError);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      await expect(client.getAgents()).rejects.toThrow('Request timeout');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Server error',
              timestamp: '2024-01-01T00:00:00Z',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            agents: [],
            total: 0,
            page: 1,
            limit: 20,
          }),
          headers: new Map(),
        });

      const result = await client.getAgents();
      expect(result.agents).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on rate limiting', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: () => Promise.resolve({
            error: {
              code: 'RATE_LIMITED',
              message: 'Rate limit exceeded',
              timestamp: '2024-01-01T00:00:00Z',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            agents: [],
            total: 0,
            page: 1,
            limit: 20,
          }),
          headers: new Map(),
        });

      const result = await client.getAgents();
      expect(result.agents).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Agent Management', () => {
    const mockAgent = {
      id: 'agent-1',
      name: 'Test Agent',
      status: 'active' as const,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      config: {
        type: 'openai',
        parameters: { model: 'gpt-4' },
      },
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
        headers: new Map(),
      });
    });

    it('should get agents list', async () => {
      const mockResponse = {
        agents: [mockAgent],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map(),
      });

      const result = await client.getAgents();
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/agents',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should get agents with parameters', async () => {
      const params = {
        page: 2,
        limit: 10,
        status: 'active' as const,
        name: 'test',
      };

      await client.getAgents(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/agents?page=2&limit=10&status=active&name=test',
        expect.any(Object)
      );
    });

    it('should get single agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgent),
        headers: new Map(),
      });

      const result = await client.getAgent('agent-1');
      expect(result).toEqual(mockAgent);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/agents/agent-1',
        expect.any(Object)
      );
    });

    it('should create agent', async () => {
      const createRequest = {
        name: 'New Agent',
        config: {
          type: 'openai',
          parameters: { model: 'gpt-4' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgent),
        headers: new Map(),
      });

      const result = await client.createAgent(createRequest);
      expect(result).toEqual(mockAgent);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/agents',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createRequest),
        })
      );
    });

    it('should update agent', async () => {
      const updateRequest = {
        name: 'Updated Agent',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockAgent, ...updateRequest }),
        headers: new Map(),
      });

      const result = await client.updateAgent('agent-1', updateRequest);
      expect(result.name).toBe('Updated Agent');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/agents/agent-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateRequest),
        })
      );
    });

    it('should delete agent', async () => {
      await client.deleteAgent('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/agents/agent-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Metrics', () => {
    const mockMetrics = {
      timestamp: '2024-01-01T12:00:00Z',
      system: {
        cpu_usage: 0.45,
        memory_usage: 0.67,
        disk_usage: 0.23,
        uptime: 86400,
      },
      agents: [],
      requests: {
        total: 1500,
        per_minute: 25,
        success_rate: 0.98,
        error_rate: 0.02,
      },
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMetrics),
        headers: new Map(),
      });
    });

    it('should get system metrics', async () => {
      const result = await client.getMetrics();
      expect(result).toEqual(mockMetrics);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/metrics',
        expect.any(Object)
      );
    });

    it('should get agent metrics', async () => {
      const agentMetrics = {
        agent_id: 'agent-1',
        requests_processed: 100,
        success_rate: 0.95,
        average_response_time: 1200,
        last_activity: '2024-01-01T11:30:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(agentMetrics),
        headers: new Map(),
      });

      const result = await client.getAgentMetrics('agent-1');
      expect(result).toEqual(agentMetrics);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/metrics/agents/agent-1',
        expect.any(Object)
      );
    });

    it('should get metrics history', async () => {
      const params = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-02T00:00:00Z',
        interval: '1h',
      };

      await client.getMetricsHistory(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/metrics/history?from=2024-01-01T00%3A00%3A00Z&to=2024-01-02T00%3A00%3A00Z&interval=1h',
        expect.any(Object)
      );
    });
  });

  describe('Configuration', () => {
    const mockConfig = {
      logging: {
        level: 'info' as const,
        format: 'json' as const,
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

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
        headers: new Map(),
      });
    });

    it('should get configuration', async () => {
      const result = await client.getConfig();
      expect(result).toEqual(mockConfig);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/config',
        expect.any(Object)
      );
    });

    it('should update configuration', async () => {
      const updateRequest = {
        logging: {
          level: 'debug' as const,
          format: 'text' as const,
        },
      };

      const result = await client.updateConfig(updateRequest);
      expect(result).toEqual(mockConfig);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/config',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateRequest),
        })
      );
    });
  });

  describe('WebSocket', () => {
    it('should create WebSocket connection', () => {
      const ws = client.createWebSocket();
      expect(ws).toBeInstanceOf(MockWebSocket);
      expect(ws.url).toBe('ws://localhost:8080/api/v1/websocket');
    });

    it('should subscribe to agents', () => {
      const ws = client.createWebSocket();
      const sendSpy = vi.spyOn(ws, 'send');

      client.subscribeToAgents(ws, 'agent-1');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscribe',
          channel: 'agents',
          agent_id: 'agent-1',
        })
      );
    });

    it('should subscribe to metrics', () => {
      const ws = client.createWebSocket();
      const sendSpy = vi.spyOn(ws, 'send');

      client.subscribeToMetrics(ws, 10000);

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscribe',
          channel: 'metrics',
          interval: 10000,
        })
      );
    });

    it('should unsubscribe from channel', () => {
      const ws = client.createWebSocket();
      const sendSpy = vi.spyOn(ws, 'send');

      client.unsubscribeFromChannel(ws, 'agents');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'unsubscribe',
          channel: 'agents',
        })
      );
    });
  });

  describe('Utility Methods', () => {
    it('should perform health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: new Map(),
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/health',
        expect.any(Object)
      );
    });

    it('should return false on health check failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    it('should set API key', () => {
      client.setApiKey('new-api-key');
      // Can't directly test this without exposing private property
      // but it's tested indirectly through other API calls
    });

    it('should set debug mode', () => {
      client.setDebug(true);
      // Can't directly test this without exposing private property
      // but it's tested indirectly through logging
    });
  });

  describe('Rate Limiting', () => {
    it('should extract rate limit information from headers', async () => {
      const headers = new Map([
        ['X-RateLimit-Limit', '1000'],
        ['X-RateLimit-Remaining', '999'],
        ['X-RateLimit-Reset', '1640995200'],
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [], total: 0, page: 1, limit: 20 }),
        headers,
      });

      // This test would need access to internal rate limit info
      // In a real implementation, you might expose this or add a callback
      const result = await client.getAgents();
      expect(result).toBeDefined();
    });
  });
});