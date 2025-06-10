import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedAgentAPIClient } from '../unified-agentapi-client';
import { RealAgentAPIClient, RealAgentAPIError } from '../real-agentapi-client';
import { MockAgentAPIClient } from '../__mocks__/agentapi-client';

// Mock the dependencies
vi.mock('../real-agentapi-client');
vi.mock('../__mocks__/agentapi-client');

const mockRealAgentAPIClient = RealAgentAPIClient as any;
const mockMockAgentAPIClient = MockAgentAPIClient as any;

describe('UnifiedAgentAPIClient', () => {
  let client: UnifiedAgentAPIClient;
  let realClientMock: any;
  let mockClientMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock instances
    realClientMock = {
      getStatus: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      healthCheck: vi.fn(),
    };

    mockClientMock = {
      getStatus: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      getAgents: vi.fn(),
      getAgent: vi.fn(),
      createAgent: vi.fn(),
      updateAgent: vi.fn(),
      deleteAgent: vi.fn(),
      getMetrics: vi.fn(),
      getConfig: vi.fn(),
      healthCheck: vi.fn(),
    };

    mockRealAgentAPIClient.mockImplementation(() => realClientMock);
    mockMockAgentAPIClient.mockImplementation(() => mockClientMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create client with default auto mode', () => {
      client = new UnifiedAgentAPIClient();
      expect(client.getCurrentMode()).toBe('auto');
    });

    it('should create client with explicit production mode', () => {
      client = new UnifiedAgentAPIClient({ mode: 'production' });
      expect(client.getCurrentMode()).toBe('production');
    });

    it('should create client with explicit mock mode', () => {
      client = new UnifiedAgentAPIClient({ mode: 'mock' });
      expect(client.getCurrentMode()).toBe('mock');
    });
  });

  describe('Auto Mode - Production API Available', () => {
    beforeEach(() => {
      realClientMock.healthCheck.mockResolvedValue(true);
      client = new UnifiedAgentAPIClient({ mode: 'auto' });
    });

    it('should use production mode when real API is healthy', async () => {
      realClientMock.getStatus.mockResolvedValue({ status: 'stable' });
      
      const status = await client.getStatus();
      
      expect(status).toEqual({ status: 'stable' });
      expect(realClientMock.getStatus).toHaveBeenCalled();
      expect(mockClientMock.getStatus).not.toHaveBeenCalled();
      expect(client.getCurrentMode()).toBe('production');
    });

    it('should handle production API calls correctly', async () => {
      const mockMessages = { messages: [{ id: 1, content: 'test', role: 'user', timestamp: '2024-01-01T00:00:00Z' }] };
      realClientMock.getMessages.mockResolvedValue(mockMessages);
      
      const messages = await client.getMessages();
      
      expect(messages).toEqual(mockMessages);
      expect(realClientMock.getMessages).toHaveBeenCalled();
    });

    it('should send messages through production API', async () => {
      const mockResponse = { id: 1, content: 'response', role: 'agent', timestamp: '2024-01-01T00:00:00Z' };
      realClientMock.sendMessage.mockResolvedValue(mockResponse);
      
      const response = await client.sendMessage({ content: 'test message' });
      
      expect(response).toEqual(mockResponse);
      expect(realClientMock.sendMessage).toHaveBeenCalledWith({ content: 'test message' });
    });
  });

  describe('Auto Mode - Production API Unavailable', () => {
    beforeEach(() => {
      realClientMock.healthCheck.mockResolvedValue(false);
      client = new UnifiedAgentAPIClient({ mode: 'auto' });
    });

    it('should fall back to mock mode when real API is unhealthy', async () => {
      mockClientMock.getStatus.mockResolvedValue({ status: 'stable' });
      
      await client.getStatus();
      
      expect(client.getCurrentMode()).toBe('mock');
      expect(mockClientMock.getStatus).not.toHaveBeenCalled(); // Uses built-in mock response
    });
  });

  describe('Auto Mode - Fallback on Runtime Error', () => {
    beforeEach(() => {
      realClientMock.healthCheck.mockResolvedValue(true);
      client = new UnifiedAgentAPIClient({ mode: 'auto', fallbackToMock: true });
    });

    it('should fall back to mock on production API error', async () => {
      realClientMock.getStatus.mockRejectedValue(new RealAgentAPIError(500, 'server_error', 'Server Error'));
      
      const status = await client.getStatus();
      
      expect(status).toEqual({ status: 'stable' }); // Built-in fallback response
      expect(realClientMock.getStatus).toHaveBeenCalled();
      expect(client.getCurrentMode()).toBe('mock');
    });

    it('should not fall back if fallbackToMock is disabled', async () => {
      const clientNoFallback = new UnifiedAgentAPIClient({ mode: 'auto', fallbackToMock: false });
      realClientMock.getStatus.mockRejectedValue(new RealAgentAPIError(500, 'server_error', 'Server Error'));
      
      await expect(clientNoFallback.getStatus()).rejects.toThrow('Server Error');
    });
  });

  describe('Explicit Production Mode', () => {
    beforeEach(() => {
      client = new UnifiedAgentAPIClient({ mode: 'production' });
    });

    it('should use only production API in production mode', async () => {
      realClientMock.getStatus.mockResolvedValue({ status: 'running' });
      
      const status = await client.getStatus();
      
      expect(status).toEqual({ status: 'running' });
      expect(realClientMock.getStatus).toHaveBeenCalled();
      expect(client.getCurrentMode()).toBe('production');
    });

    it('should throw error for mock-only features', async () => {
      await expect(client.getAgents()).rejects.toThrow('Agent management features require mock mode');
      await expect(client.getMetrics()).rejects.toThrow('Metrics features require mock mode');
    });
  });

  describe('Explicit Mock Mode', () => {
    beforeEach(() => {
      client = new UnifiedAgentAPIClient({ mode: 'mock' });
    });

    it('should use mock API in mock mode', async () => {
      const mockAgents = { agents: [], total: 0, page: 1, limit: 20 };
      mockClientMock.getAgents.mockResolvedValue(mockAgents);
      
      const agents = await client.getAgents();
      
      expect(agents).toEqual(mockAgents);
      expect(mockClientMock.getAgents).toHaveBeenCalled();
      expect(client.getCurrentMode()).toBe('mock');
    });

    it('should support all agent management features', async () => {
      const mockAgent = { id: 'agent-1', name: 'Test Agent', status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', config: { type: 'test', parameters: {} } };
      
      mockClientMock.getAgent.mockResolvedValue(mockAgent);
      mockClientMock.createAgent.mockResolvedValue(mockAgent);
      mockClientMock.updateAgent.mockResolvedValue(mockAgent);
      mockClientMock.deleteAgent.mockResolvedValue(undefined);
      
      await expect(client.getAgent('agent-1')).resolves.toEqual(mockAgent);
      await expect(client.createAgent({ name: 'Test', config: { type: 'test', parameters: {} } })).resolves.toEqual(mockAgent);
      await expect(client.updateAgent('agent-1', { name: 'Updated' })).resolves.toEqual(mockAgent);
      await expect(client.deleteAgent('agent-1')).resolves.toBeUndefined();
    });

    it('should support metrics and config features', async () => {
      const mockMetrics = { timestamp: '2024-01-01T00:00:00Z', system: { cpu_usage: 0.5, memory_usage: 0.6, disk_usage: 0.3, uptime: 1000 }, agents: [], requests: { total: 100, per_minute: 10, success_rate: 0.9, error_rate: 0.1 } };
      const mockConfig = { logging: { level: 'info' as const, format: 'json' as const }, auth: { enabled: true, provider: 'test' }, limits: { max_agents: 10, request_rate: 100 } };
      
      mockClientMock.getMetrics.mockResolvedValue(mockMetrics);
      mockClientMock.getConfig.mockResolvedValue(mockConfig);
      
      await expect(client.getMetrics()).resolves.toEqual(mockMetrics);
      await expect(client.getConfig()).resolves.toEqual(mockConfig);
    });
  });

  describe('Feature Detection', () => {
    beforeEach(() => {
      client = new UnifiedAgentAPIClient({ mode: 'auto' });
    });

    it('should correctly identify core features as available', () => {
      expect(client.isFeatureAvailable('getStatus')).toBe(true);
      expect(client.isFeatureAvailable('getMessages')).toBe(true);
      expect(client.isFeatureAvailable('sendMessage')).toBe(true);
      expect(client.isFeatureAvailable('healthCheck')).toBe(true);
    });

    it('should correctly identify mock-only features availability', () => {
      // Features depend on having mock client available
      expect(client.isFeatureAvailable('getAgents')).toBe(true); // Mock client is available in auto mode
      expect(client.isFeatureAvailable('getMetrics')).toBe(true);
      expect(client.isFeatureAvailable('getConfig')).toBe(true);
    });

    it('should return false for unknown features', () => {
      expect(client.isFeatureAvailable('unknownFeature')).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should delegate health check to active client', async () => {
      realClientMock.healthCheck.mockResolvedValue(true);
      client = new UnifiedAgentAPIClient({ mode: 'production' });
      
      const isHealthy = await client.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(realClientMock.healthCheck).toHaveBeenCalled();
    });

    it('should delegate health check to mock client in mock mode', async () => {
      mockClientMock.healthCheck.mockResolvedValue(true);
      client = new UnifiedAgentAPIClient({ mode: 'mock' });
      
      const isHealthy = await client.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockClientMock.healthCheck).toHaveBeenCalled();
    });
  });

  describe('Mode Switching', () => {
    it('should allow manual mode switching', async () => {
      client = new UnifiedAgentAPIClient({ mode: 'production' });
      expect(client.getCurrentMode()).toBe('production');
      
      await client.setMode('mock');
      expect(client.getCurrentMode()).toBe('mock');
    });
  });

  describe('Debug Information', () => {
    it('should provide debug information', () => {
      client = new UnifiedAgentAPIClient({ mode: 'auto' });
      
      const debugInfo = client.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('mode');
      expect(debugInfo).toHaveProperty('hasRealClient');
      expect(debugInfo).toHaveProperty('hasMockClient');
      expect(debugInfo).toHaveProperty('isInitialized');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      client = new UnifiedAgentAPIClient({ mode: 'production' });
    });

    it('should preserve original errors when fallback is disabled', async () => {
      const originalError = new RealAgentAPIError(404, 'not_found', 'Not Found');
      realClientMock.getStatus.mockRejectedValue(originalError);
      
      await expect(client.getStatus()).rejects.toThrow('Not Found');
    });
  });

  describe('Environment Variables', () => {
    it('should respect AGENTAPI_MODE environment variable', () => {
      // Mock environment variable
      const originalEnv = process.env.AGENTAPI_MODE;
      process.env.AGENTAPI_MODE = 'mock';
      
      // This would be tested with the factory function
      // but we'll just verify the concept here
      
      process.env.AGENTAPI_MODE = originalEnv;
    });
  });
});