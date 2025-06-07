import { RealAgentAPIClient } from './real-agentapi-client';
import { MockAgentAPIClient } from './__mocks__/agentapi-client';
import { 
  AgentAPIClientConfig, 
  Agent, 
  AgentListResponse, 
  AgentListParams,
  CreateAgentRequest,
  UpdateAgentRequest,
  Metrics,
  SystemConfig 
} from '../types/agentapi';
import { 
  RealAgentAPIConfig,
  AgentStatus,
  MessagesResponse,
  SendMessageRequest,
  SendMessageResponse
} from '../types/real-agentapi';
import { getAgentAPIConfigFromStorage } from './agentapi-client';
import { getRealAgentAPIConfigFromStorage } from './real-agentapi-client';

export type ClientMode = 'production' | 'mock' | 'auto';

export interface UnifiedAgentAPIConfig {
  mode?: ClientMode;
  realApiConfig?: RealAgentAPIConfig;
  mockApiConfig?: AgentAPIClientConfig;
  fallbackToMock?: boolean;
  healthCheckTimeout?: number;
}

// Unified interface that combines both API capabilities
export interface UnifiedAgentAPIInterface {
  // Core messaging interface (available in both modes)
  getStatus(): Promise<AgentStatus>;
  getMessages(): Promise<MessagesResponse>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  
  // Advanced agent management (mock mode only)
  getAgents?(params?: AgentListParams): Promise<AgentListResponse>;
  getAgent?(id: string): Promise<Agent>;
  createAgent?(data: CreateAgentRequest): Promise<Agent>;
  updateAgent?(id: string, data: UpdateAgentRequest): Promise<Agent>;
  deleteAgent?(id: string): Promise<void>;
  
  // Metrics and config (mock mode only)
  getMetrics?(): Promise<Metrics>;
  getConfig?(): Promise<SystemConfig>;
  
  // Utility methods
  healthCheck(): Promise<boolean>;
  getCurrentMode(): ClientMode;
  isFeatureAvailable(feature: string): boolean;
}

export class UnifiedAgentAPIClient implements UnifiedAgentAPIInterface {
  private realClient?: RealAgentAPIClient;
  private mockClient?: MockAgentAPIClient;
  private currentMode: ClientMode;
  private config: UnifiedAgentAPIConfig;
  private isInitialized = false;

  constructor(config: UnifiedAgentAPIConfig = {}) {
    this.config = {
      mode: 'auto',
      fallbackToMock: true,
      healthCheckTimeout: 5000,
      ...config
    };
    this.currentMode = this.config.mode || 'auto';
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Get configurations from storage if not provided
    const realConfig = this.config.realApiConfig || getRealAgentAPIConfigFromStorage();
    const mockConfig = this.config.mockApiConfig || getAgentAPIConfigFromStorage();

    // Initialize clients based on mode
    if (this.config.mode === 'mock') {
      this.mockClient = new MockAgentAPIClient(mockConfig);
      this.currentMode = 'mock';
    } else if (this.config.mode === 'production') {
      this.realClient = new RealAgentAPIClient(realConfig);
      this.currentMode = 'production';
    } else {
      // Auto mode - try production first, fallback to mock if needed
      this.realClient = new RealAgentAPIClient(realConfig);
      this.mockClient = new MockAgentAPIClient(mockConfig);
      
      const isRealApiHealthy = await this.checkRealApiHealth();
      this.currentMode = isRealApiHealthy ? 'production' : 'mock';
    }

    this.isInitialized = true;
  }

  private async checkRealApiHealth(): Promise<boolean> {
    if (!this.realClient) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(), 
        this.config.healthCheckTimeout || 5000
      );
      
      const isHealthy = await Promise.race([
        this.realClient.healthCheck(),
        new Promise<boolean>((_, reject) => {
          controller.signal.addEventListener('abort', () => 
            reject(new Error('Health check timeout'))
          );
        })
      ]);
      
      clearTimeout(timeoutId);
      return isHealthy;
    } catch (error) {
      console.warn('[UnifiedAgentAPI] Real API health check failed:', error);
      return false;
    }
  }

  private async executeWithFallback<T>(
    realApiCall: () => Promise<T>,
    mockApiCall?: () => Promise<T>,
    feature?: string
  ): Promise<T> {
    await this.initialize();

    if (this.currentMode === 'mock') {
      if (!mockApiCall) {
        throw new Error(`Feature '${feature || 'unknown'}' not available in mock mode`);
      }
      return mockApiCall();
    }

    if (this.currentMode === 'production') {
      try {
        if (!this.realClient) {
          throw new Error('Real API client not available');
        }
        return await realApiCall();
      } catch (error) {
        // If fallback is enabled and we have a mock implementation, try it
        if (this.config.fallbackToMock && mockApiCall && this.mockClient) {
          console.warn('[UnifiedAgentAPI] Production API failed, falling back to mock:', error);
          this.currentMode = 'mock';
          return mockApiCall();
        }
        throw error;
      }
    }

    throw new Error(`Invalid mode: ${this.currentMode}`);
  }

  // Core messaging interface (available in both modes)
  async getStatus(): Promise<AgentStatus> {
    return this.executeWithFallback(
      () => this.realClient!.getStatus(),
      this.config.fallbackToMock ? () => Promise.resolve({ status: 'stable' as const }) : undefined
    );
  }

  async getMessages(): Promise<MessagesResponse> {
    return this.executeWithFallback(
      () => this.realClient!.getMessages(),
      this.config.fallbackToMock ? () => Promise.resolve({ messages: [] }) : undefined
    );
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.executeWithFallback(
      () => this.realClient!.sendMessage(request),
      this.config.fallbackToMock ? () => Promise.resolve({
        id: Date.now(),
        content: `Mock response to: ${request.content}`,
        role: 'agent' as const,
        timestamp: new Date().toISOString()
      }) : undefined
    );
  }

  // Advanced agent management (mock mode preferred)
  async getAgents(params?: AgentListParams): Promise<AgentListResponse> {
    await this.initialize();
    
    if (!this.mockClient) {
      throw new Error('Agent management features require mock mode');
    }
    
    return this.mockClient.getAgents(params);
  }

  async getAgent(id: string): Promise<Agent> {
    await this.initialize();
    
    if (!this.mockClient) {
      throw new Error('Agent management features require mock mode');
    }
    
    return this.mockClient.getAgent(id);
  }

  async createAgent(data: CreateAgentRequest): Promise<Agent> {
    await this.initialize();
    
    if (!this.mockClient) {
      throw new Error('Agent management features require mock mode');
    }
    
    return this.mockClient.createAgent(data);
  }

  async updateAgent(id: string, data: UpdateAgentRequest): Promise<Agent> {
    await this.initialize();
    
    if (!this.mockClient) {
      throw new Error('Agent management features require mock mode');
    }
    
    return this.mockClient.updateAgent(id, data);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.initialize();
    
    if (!this.mockClient) {
      throw new Error('Agent management features require mock mode');
    }
    
    return this.mockClient.deleteAgent(id);
  }

  // Metrics and config (mock mode only)
  async getMetrics(): Promise<Metrics> {
    await this.initialize();
    
    if (!this.mockClient) {
      throw new Error('Metrics features require mock mode');
    }
    
    return this.mockClient.getMetrics();
  }

  async getConfig(): Promise<SystemConfig> {
    await this.initialize();
    
    if (!this.mockClient) {
      throw new Error('Config features require mock mode');
    }
    
    return this.mockClient.getConfig();
  }

  // Utility methods
  async healthCheck(): Promise<boolean> {
    await this.initialize();
    
    if (this.currentMode === 'production' && this.realClient) {
      return this.realClient.healthCheck();
    } else if (this.currentMode === 'mock' && this.mockClient) {
      return this.mockClient.healthCheck();
    }
    
    return false;
  }

  getCurrentMode(): ClientMode {
    return this.currentMode;
  }

  isFeatureAvailable(feature: string): boolean {
    const coreFeatures = ['getStatus', 'getMessages', 'sendMessage', 'healthCheck'];
    const mockOnlyFeatures = [
      'getAgents', 'getAgent', 'createAgent', 'updateAgent', 'deleteAgent',
      'getMetrics', 'getConfig'
    ];

    if (coreFeatures.indexOf(feature) !== -1) {
      return true;
    }

    if (mockOnlyFeatures.indexOf(feature) !== -1) {
      // For auto mode, mock client is always available
      // For explicit modes, check if mock client exists
      return this.config.mode === 'auto' || this.config.mode === 'mock' || this.mockClient !== undefined;
    }

    return false;
  }

  // Force mode switching (for testing and debugging)
  async setMode(mode: ClientMode): Promise<void> {
    this.config.mode = mode;
    this.currentMode = mode;
    this.isInitialized = false;
    await this.initialize();
  }

  // Get debug information
  getDebugInfo(): { 
    mode: ClientMode, 
    hasRealClient: boolean, 
    hasMockClient: boolean,
    isInitialized: boolean 
  } {
    return {
      mode: this.currentMode,
      hasRealClient: !!this.realClient,
      hasMockClient: !!this.mockClient,
      isInitialized: this.isInitialized
    };
  }
}

// Factory functions
export function createUnifiedAgentAPIClient(config?: UnifiedAgentAPIConfig): UnifiedAgentAPIClient {
  return new UnifiedAgentAPIClient(config);
}

export function createUnifiedAgentAPIClientFromStorage(repoFullname?: string): UnifiedAgentAPIClient {
  // Check environment variables for mode configuration
  const mode = (process.env.AGENTAPI_MODE as ClientMode) || 'auto';
  const fallbackToMock = process.env.AGENTAPI_FALLBACK !== 'false';
  
  const realApiConfig = getRealAgentAPIConfigFromStorage(repoFullname);
  const mockApiConfig = getAgentAPIConfigFromStorage(repoFullname);
  
  return new UnifiedAgentAPIClient({
    mode,
    realApiConfig,
    mockApiConfig,
    fallbackToMock
  });
}

// Default unified client instance
export const unifiedAgentAPI = createUnifiedAgentAPIClientFromStorage();