import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockAgentAPIClient,
  MockWebSocket,
  createMockAgentAPIClient,
  mockAgents,
  mockMetrics,
  mockSystemConfig,
} from '../__mocks__/agentapi-client';
import { AgentAPIError } from '../agentapi-client';
import type { AgentAPIClientConfig } from '../../types/agentapi';

describe('MockAgentAPIClient', () => {
  let mockClient: MockAgentAPIClient;
  let config: AgentAPIClientConfig;

  beforeEach(() => {
    config = {
      baseURL: 'http://localhost:8080/api/v1',
      apiKey: 'test-api-key',
      timeout: 5000,
      debug: false,
    };
    mockClient = new MockAgentAPIClient(config);
    mockClient.resetMockData();
    mockClient.setShouldFailRequests(false);
    mockClient.setMockDelay(0); // No delay for tests
  });

  describe('Agent Management', () => {
    it('should get agents list', async () => {
      const result = await mockClient.getAgents();
      
      expect(result.agents).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.agents[0].name).toBe('Test Agent 1');
    });

    it('should filter agents by status', async () => {
      const result = await mockClient.getAgents({ status: 'active' });
      
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].status).toBe('active');
    });

    it('should filter agents by name', async () => {
      const result = await mockClient.getAgents({ name: 'Test Agent 1' });
      
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('Test Agent 1');
    });

    it('should paginate agents', async () => {
      const result = await mockClient.getAgents({ page: 2, limit: 1 });
      
      expect(result.agents).toHaveLength(1);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(1);
      expect(result.agents[0].name).toBe('Test Agent 2');
    });

    it('should get single agent', async () => {
      const result = await mockClient.getAgent('agent-1');
      
      expect(result.id).toBe('agent-1');
      expect(result.name).toBe('Test Agent 1');
      expect(result.status).toBe('active');
    });

    it('should throw error for non-existent agent', async () => {
      await expect(mockClient.getAgent('non-existent')).rejects.toThrow(AgentAPIError);
      await expect(mockClient.getAgent('non-existent')).rejects.toThrow('Agent with id non-existent not found');
    });

    it('should create new agent', async () => {
      const createRequest = {
        name: 'New Test Agent',
        config: {
          type: 'custom',
          parameters: { endpoint: 'https://api.test.com' },
        },
      };

      const result = await mockClient.createAgent(createRequest);
      
      expect(result.name).toBe('New Test Agent');
      expect(result.status).toBe('active');
      expect(result.config).toEqual(createRequest.config);
      expect(result.id).toMatch(/^agent-\d+$/);
      
      // Verify it was added to the mock data
      const allAgents = await mockClient.getAgents();
      expect(allAgents.total).toBe(4);
    });

    it('should update existing agent', async () => {
      const updateRequest = {
        name: 'Updated Agent Name',
        config: {
          type: 'updated',
          parameters: { new: 'parameter' },
        },
      };

      const result = await mockClient.updateAgent('agent-1', updateRequest);
      
      expect(result.id).toBe('agent-1');
      expect(result.name).toBe('Updated Agent Name');
      expect(result.config.type).toBe('updated');
      expect(result.updated_at).not.toBe('2024-01-01T12:00:00Z'); // Should be updated
    });

    it('should throw error when updating non-existent agent', async () => {
      await expect(mockClient.updateAgent('non-existent', { name: 'Test' }))
        .rejects.toThrow('Agent with id non-existent not found');
    });

    it('should delete agent', async () => {
      await mockClient.deleteAgent('agent-1');
      
      // Verify it was removed
      await expect(mockClient.getAgent('agent-1')).rejects.toThrow('Agent with id agent-1 not found');
      
      const allAgents = await mockClient.getAgents();
      expect(allAgents.total).toBe(2);
    });

    it('should throw error when deleting non-existent agent', async () => {
      await expect(mockClient.deleteAgent('non-existent'))
        .rejects.toThrow('Agent with id non-existent not found');
    });
  });

  describe('Metrics', () => {
    it('should get system metrics', async () => {
      const result = await mockClient.getMetrics();
      
      expect(result.system.cpu_usage).toBe(0.45);
      expect(result.system.memory_usage).toBe(0.67);
      expect(result.system.disk_usage).toBe(0.23);
      expect(result.agents).toHaveLength(2);
      expect(result.requests.total).toBe(1500);
      expect(result.timestamp).toBeDefined();
    });

    it('should get agent metrics', async () => {
      const result = await mockClient.getAgentMetrics('agent-1');
      
      expect(result.agent_id).toBe('agent-1');
      expect(result.requests_processed).toBe(150);
      expect(result.success_rate).toBe(0.95);
    });

    it('should throw error for non-existent agent metrics', async () => {
      await expect(mockClient.getAgentMetrics('non-existent'))
        .rejects.toThrow('Metrics for agent non-existent not found');
    });

    it('should get metrics history', async () => {
      const params = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-02T00:00:00Z',
        interval: '1h',
      };

      const result = await mockClient.getMetricsHistory(params);
      
      expect(result.history).toHaveLength(10);
      expect(result.history[0].system).toBeDefined();
      expect(result.history[0].timestamp).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should get system configuration', async () => {
      const result = await mockClient.getConfig();
      
      expect(result.logging.level).toBe('info');
      expect(result.logging.format).toBe('json');
      expect(result.auth.enabled).toBe(true);
      expect(result.limits.max_agents).toBe(100);
    });

    it('should update system configuration', async () => {
      const updateRequest = {
        logging: {
          level: 'debug' as const,
          format: 'text' as const,
        },
      };

      const result = await mockClient.updateConfig(updateRequest);
      
      expect(result.logging.level).toBe('debug');
      expect(result.logging.format).toBe('text');
      expect(result.auth.enabled).toBe(true); // Should preserve other settings
    });
  });

  describe('WebSocket', () => {
    it('should create mock WebSocket', () => {
      const ws = mockClient.createWebSocket();
      
      expect(ws).toBeInstanceOf(MockWebSocket);
      expect(ws.url).toBe('ws://localhost:8080/api/v1/websocket');
      expect(ws.readyState).toBe(MockWebSocket.CONNECTING);
    });

    it('should handle WebSocket connection', async () => {
      const ws = mockClient.createWebSocket();
      
      return new Promise<void>((resolve) => {
        ws.addEventListener('open', () => {
          expect(ws.readyState).toBe(MockWebSocket.OPEN);
          resolve();
        });
      });
    });

    it('should handle agent subscription', async () => {
      const ws = mockClient.createWebSocket();
      
      return new Promise<void>((resolve) => {
        ws.addEventListener('open', () => {
          mockClient.subscribeToAgents(ws, 'agent-1');
          
          ws.addEventListener('message', (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.type === 'subscription_confirmed') {
              expect(data.channel).toBe('agents');
              resolve();
            }
          });
        });
      });
    });

    it('should handle metrics subscription', async () => {
      const ws = mockClient.createWebSocket();
      
      return new Promise<void>((resolve) => {
        ws.addEventListener('open', () => {
          mockClient.subscribeToMetrics(ws, 1000);
          
          ws.addEventListener('message', (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.type === 'subscription_confirmed') {
              expect(data.channel).toBe('metrics');
              resolve();
            }
          });
        });
      });
    });

    it('should handle unsubscribe', async () => {
      const ws = mockClient.createWebSocket();
      
      return new Promise<void>((resolve) => {
        ws.addEventListener('open', () => {
          // First subscribe
          mockClient.subscribeToAgents(ws);
          
          // Then unsubscribe
          mockClient.unsubscribeFromChannel(ws, 'agents');
          
          // Should not receive further agent updates
          resolve();
        });
      });
    });

    it('should close WebSocket', async () => {
      const ws = mockClient.createWebSocket();
      
      return new Promise<void>((resolve) => {
        ws.addEventListener('close', () => {
          expect(ws.readyState).toBe(MockWebSocket.CLOSED);
          resolve();
        });
        
        ws.addEventListener('open', () => {
          ws.close();
        });
      });
    });
  });

  describe('Utility Methods', () => {
    it('should perform health check', async () => {
      const result = await mockClient.healthCheck();
      expect(result).toBe(true);
    });

    it('should fail health check when configured', async () => {
      mockClient.setShouldFailRequests(true);
      const result = await mockClient.healthCheck();
      expect(result).toBe(false);
    });

    it('should set API key', () => {
      mockClient.setApiKey('new-key');
      // This method updates internal state, can't directly test
      // but ensures no errors are thrown
    });

    it('should set debug mode', () => {
      mockClient.setDebug(true);
      // This method updates internal state, can't directly test
      // but ensures no errors are thrown
    });
  });

  describe('Testing Utilities', () => {
    it('should configure mock delay', async () => {
      mockClient.setMockDelay(100);
      
      const start = Date.now();
      await mockClient.getAgents();
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should configure request failures', async () => {
      mockClient.setShouldFailRequests(true);
      
      await expect(mockClient.getAgents()).rejects.toThrow(AgentAPIError);
      await expect(mockClient.getAgents()).rejects.toThrow('Mock error for testing');
    });

    it('should reset mock data', async () => {
      // Create a new agent
      await mockClient.createAgent({
        name: 'Temp Agent',
        config: { type: 'temp', parameters: {} },
      });
      
      let agents = await mockClient.getAgents();
      expect(agents.total).toBe(4);
      
      // Reset data
      mockClient.resetMockData();
      
      agents = await mockClient.getAgents();
      expect(agents.total).toBe(3);
      expect(agents.agents[0].name).toBe('Test Agent 1');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle all error types consistently', async () => {
      mockClient.setShouldFailRequests(true);
      
      // Test all methods throw AgentAPIError when configured to fail
      await expect(mockClient.getAgents()).rejects.toThrow(AgentAPIError);
      await expect(mockClient.getAgent('agent-1')).rejects.toThrow(AgentAPIError);
      await expect(mockClient.createAgent({ name: 'test', config: { type: 'test', parameters: {} } }))
        .rejects.toThrow(AgentAPIError);
      await expect(mockClient.updateAgent('agent-1', { name: 'test' })).rejects.toThrow(AgentAPIError);
      await expect(mockClient.deleteAgent('agent-1')).rejects.toThrow(AgentAPIError);
      await expect(mockClient.getMetrics()).rejects.toThrow(AgentAPIError);
      await expect(mockClient.getAgentMetrics('agent-1')).rejects.toThrow(AgentAPIError);
      await expect(mockClient.getMetricsHistory({ from: '2024-01-01', to: '2024-01-02' }))
        .rejects.toThrow(AgentAPIError);
      await expect(mockClient.getConfig()).rejects.toThrow(AgentAPIError);
      await expect(mockClient.updateConfig({})).rejects.toThrow(AgentAPIError);
    });
  });
});

describe('Mock Factory Functions', () => {
  it('should create mock client with factory', () => {
    const config = {
      baseURL: 'http://localhost:8080/api/v1',
      apiKey: 'test-key',
    };
    
    const client = createMockAgentAPIClient(config);
    expect(client).toBeInstanceOf(MockAgentAPIClient);
  });
});

describe('Mock Data Consistency', () => {
  it('should have consistent mock agents data', () => {
    expect(mockAgents).toHaveLength(3);
    expect(mockAgents[0].id).toBe('agent-1');
    expect(mockAgents[0].status).toBe('active');
    expect(mockAgents[1].status).toBe('inactive');
    expect(mockAgents[2].status).toBe('error');
  });

  it('should have valid mock metrics data', () => {
    expect(mockMetrics.system.cpu_usage).toBeGreaterThanOrEqual(0);
    expect(mockMetrics.system.cpu_usage).toBeLessThanOrEqual(1);
    expect(mockMetrics.system.memory_usage).toBeGreaterThanOrEqual(0);
    expect(mockMetrics.system.memory_usage).toBeLessThanOrEqual(1);
    expect(mockMetrics.requests.success_rate).toBeGreaterThanOrEqual(0);
    expect(mockMetrics.requests.success_rate).toBeLessThanOrEqual(1);
  });

  it('should have valid mock system config', () => {
    expect(['info', 'debug', 'warn', 'error']).toContain(mockSystemConfig.logging.level);
    expect(['json', 'text']).toContain(mockSystemConfig.logging.format);
    expect(typeof mockSystemConfig.auth.enabled).toBe('boolean');
    expect(mockSystemConfig.limits.max_agents).toBeGreaterThan(0);
    expect(mockSystemConfig.limits.request_rate).toBeGreaterThan(0);
  });
});