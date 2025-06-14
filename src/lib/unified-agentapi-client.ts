import { RealAgentAPIClient } from './real-agentapi-client';
import { MockAgentAPIClient } from './__mocks__/agentapi-client';
import { AgentAPIProxyClient } from './agentapi-proxy-client';
import { 
  AgentAPIClientConfig, 
  Agent, 
  AgentListResponse, 
  AgentListParams,
  CreateAgentRequest,
  UpdateAgentRequest,
  Metrics,
  SystemConfig,
  Session,
  SessionListParams,
  SessionListResponse,
  CreateSessionRequest,
  SessionMessage,
  SessionMessageListResponse,
  SessionMessageListParams,
  SendSessionMessageRequest,
  SessionEventsOptions
} from '../types/agentapi';
import { 
  RealAgentAPIConfig,
  AgentStatus,
  MessagesResponse,
  SendMessageRequest,
  SendMessageResponse
} from '../types/real-agentapi';
import { getAgentAPIConfigFromStorage, AgentAPIClient } from './agentapi-client';
import { getRealAgentAPIConfigFromStorage } from './real-agentapi-client';
import { getAgentAPIProxyConfigFromStorage } from './agentapi-proxy-client';
import { loadGlobalSettings, loadRepositorySettings } from '../types/settings';

export type ClientMode = 'production' | 'mock' | 'auto';

export interface UnifiedAgentAPIConfig {
  mode?: ClientMode;
  realApiConfig?: RealAgentAPIConfig;
  mockApiConfig?: AgentAPIClientConfig;
  proxyEnabled?: boolean;
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
  
  // Session management (proxy enabled)
  start?(userId: string, metadata?: Record<string, unknown>): Promise<Session>;
  search?(params?: SessionListParams): Promise<SessionListResponse>;
  delete?(sessionId: string): Promise<void>;
  getSession?(sessionId: string): AgentAPIClient; // Returns AgentAPIClient
  getSessionMessages?(sessionId: string, params?: SessionMessageListParams): Promise<SessionMessageListResponse>;
  sendSessionMessage?(sessionId: string, data: SendSessionMessageRequest): Promise<SessionMessage>;
  getSessionStatus?(sessionId: string): Promise<AgentStatus>;
  subscribeToSessionEvents?(
    sessionId: string,
    onMessage: (message: SessionMessage) => void,
    onStatus?: (status: AgentStatus) => void,
    onError?: (error: Error) => void,
    options?: SessionEventsOptions
  ): EventSource;
  
  // Utility methods
  healthCheck(): Promise<boolean>;
  getCurrentMode(): ClientMode;
  isFeatureAvailable(feature: string): boolean;
}

export class UnifiedAgentAPIClient implements UnifiedAgentAPIInterface {
  private realClient?: RealAgentAPIClient;
  private mockClient?: MockAgentAPIClient;
  private proxyClient?: AgentAPIProxyClient;
  private currentMode: ClientMode;
  private config: UnifiedAgentAPIConfig;
  private isInitialized = false;

  constructor(config: UnifiedAgentAPIConfig = {}) {
    this.config = {
      mode: 'auto',
      proxyEnabled: false,
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

    // Initialize proxy client if enabled
    if (this.config.proxyEnabled) {
      const proxyConfig = getAgentAPIProxyConfigFromStorage();
      this.proxyClient = new AgentAPIProxyClient(proxyConfig);
    }

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

  // Session management methods (proxy enabled)
  async start(userId: string, sessionData?: Partial<CreateSessionRequest> | Record<string, unknown>): Promise<Session> {
    await this.initialize();
    
    if (!this.proxyClient) {
      throw new Error('Session management features require proxy to be enabled');
    }
    
    return this.proxyClient.start(userId, sessionData);
  }

  async search(params?: SessionListParams): Promise<SessionListResponse> {
    await this.initialize();
    
    if (!this.proxyClient) {
      throw new Error('Session management features require proxy to be enabled');
    }
    
    return this.proxyClient.search(params);
  }

  async delete(sessionId: string): Promise<void> {
    await this.initialize();
    
    if (!this.proxyClient) {
      throw new Error('Session management features require proxy to be enabled');
    }
    
    return this.proxyClient.delete(sessionId);
  }

  getSession(sessionId: string): AgentAPIClient {
    if (!this.proxyClient) {
      throw new Error('Session management features require proxy to be enabled');
    }
    
    return this.proxyClient.getSession(sessionId);
  }

  async getSessionMessages(sessionId: string, params?: SessionMessageListParams): Promise<SessionMessageListResponse> {
    await this.initialize();
    
    if (!this.proxyClient) {
      throw new Error('Session management features require proxy to be enabled');
    }
    
    return this.proxyClient.getSessionMessages(sessionId, params);
  }

  async sendSessionMessage(sessionId: string, data: SendSessionMessageRequest): Promise<SessionMessage> {
    await this.initialize();
    
    if (!this.proxyClient) {
      throw new Error('Session management features require proxy to be enabled');
    }
    
    return this.proxyClient.sendSessionMessage(sessionId, data);
  }

  async getSessionStatus(sessionId: string): Promise<AgentStatus> {
    await this.initialize();
    
    if (!this.proxyClient) {
      throw new Error('Session management features require proxy to be enabled');
    }
    
    return this.proxyClient.getSessionStatus(sessionId);
  }

  subscribeToSessionEvents(
    sessionId: string,
    onMessage: (message: SessionMessage) => void,
    onStatus?: (status: AgentStatus) => void,
    onError?: (error: Error) => void,
    options?: SessionEventsOptions
  ): EventSource {
    if (!this.proxyClient) {
      throw new Error('Session management features require proxy to be enabled');
    }
    
    return this.proxyClient.subscribeToSessionEvents(sessionId, onMessage, onStatus, onError, options);
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
    const sessionFeatures = [
      'start', 'search', 'delete', 'getSession', 'getSessionMessages', 
      'sendSessionMessage', 'getSessionStatus', 'subscribeToSessionEvents'
    ];

    if (coreFeatures.indexOf(feature) !== -1) {
      return true;
    }

    if (mockOnlyFeatures.indexOf(feature) !== -1) {
      // For auto mode, mock client is always available
      // For explicit modes, check if mock client exists
      return this.config.mode === 'auto' || this.config.mode === 'mock' || this.mockClient !== undefined;
    }

    if (sessionFeatures.indexOf(feature) !== -1) {
      return this.config.proxyEnabled === true;
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
    hasProxyClient: boolean,
    proxyEnabled: boolean,
    isInitialized: boolean 
  } {
    return {
      mode: this.currentMode,
      hasRealClient: !!this.realClient,
      hasMockClient: !!this.mockClient,
      hasProxyClient: !!this.proxyClient,
      proxyEnabled: this.config.proxyEnabled || false,
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
  const proxyEnabled = process.env.AGENTAPI_PROXY_ENABLED === 'true';
  
  const realApiConfig = getRealAgentAPIConfigFromStorage(repoFullname);
  const mockApiConfig = getAgentAPIConfigFromStorage(repoFullname);
  
  // Check if proxy is enabled in settings - default to true for session management
  let proxyEnabledFromSettings: boolean = proxyEnabled || true; // Default to enabled
  try {
    if (typeof window !== 'undefined') {
      const settings = repoFullname ? loadRepositorySettings(repoFullname) : loadGlobalSettings();
      proxyEnabledFromSettings = settings.agentApiProxy?.enabled !== false; // Enable unless explicitly disabled
    }
  } catch (error) {
    // Fallback to enabled by default if settings can't be loaded
    console.warn('Could not load proxy settings from storage, enabling proxy by default:', error);
    proxyEnabledFromSettings = true;
  }
  
  return new UnifiedAgentAPIClient({
    mode,
    realApiConfig,
    mockApiConfig,
    proxyEnabled: proxyEnabledFromSettings,
    fallbackToMock
  });
}

// Default unified client instance
export const unifiedAgentAPI = createUnifiedAgentAPIClientFromStorage();