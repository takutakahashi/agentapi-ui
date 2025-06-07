import {
  AgentStatus,
  Message,
  MessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
  EventData,
  RealAgentAPIConfig,
  APIError
} from '../types/real-agentapi';
import { loadGlobalSettings, loadRepositorySettings } from '../types/settings';

export class RealAgentAPIError extends Error {
  constructor(
    public status: number,
    public type: string,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'RealAgentAPIError';
  }
}

export class RealAgentAPIClient {
  private baseURL: string;
  private timeout: number;
  private debug: boolean;

  constructor(config: RealAgentAPIConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 10000;
    this.debug = config.debug || false;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    if (this.debug) {
      console.log(`[RealAgentAPI] ${options.method || 'GET'} ${url}`, {
        headers: requestOptions.headers,
        body: options.body,
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle RFC 7807 Problem Details format
        let errorData: APIError;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            type: 'unknown_error',
            title: 'Unknown Error',
            status: response.status,
            detail: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        throw new RealAgentAPIError(
          response.status,
          errorData.type,
          errorData.title,
          errorData.detail
        );
      }

      const data = await response.json();
      
      if (this.debug) {
        console.log(`[RealAgentAPI] Response:`, data);
      }

      return data;
    } catch (error) {
      if (error instanceof RealAgentAPIError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new RealAgentAPIError(0, 'timeout', 'Request timeout');
      }

      throw new RealAgentAPIError(
        0,
        'network_error',
        error instanceof Error ? error.message : 'Unknown network error'
      );
    }
  }

  // Agent status
  async getStatus(): Promise<AgentStatus> {
    return this.makeRequest<AgentStatus>('/status');
  }

  // Message management
  async getMessages(): Promise<MessagesResponse> {
    return this.makeRequest<MessagesResponse>('/messages');
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.makeRequest<SendMessageResponse>('/message', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Real-time events using Server-Sent Events
  createEventSource(): EventSource {
    const url = `${this.baseURL}/events`;
    const eventSource = new EventSource(url);

    if (this.debug) {
      console.log(`[RealAgentAPI] Creating EventSource for ${url}`);
    }

    return eventSource;
  }

  // Utility method to listen for specific event types
  subscribeToEvents(
    onMessage: (message: Message) => void,
    onStatusChange: (status: AgentStatus) => void,
    onError?: (error: Error) => void
  ): EventSource {
    const eventSource = this.createEventSource();

    eventSource.addEventListener('message_update', (event) => {
      try {
        const data: EventData = JSON.parse(event.data);
        if (data.type === 'message_update') {
          onMessage(data.data as Message);
        }
      } catch {
        if (onError) {
          onError(new Error('Failed to parse message_update event'));
        }
      }
    });

    eventSource.addEventListener('status_change', (event) => {
      try {
        const data: EventData = JSON.parse(event.data);
        if (data.type === 'status_change') {
          onStatusChange(data.data as AgentStatus);
        }
      } catch {
        if (onError) {
          onError(new Error('Failed to parse status_change event'));
        }
      }
    });

    eventSource.addEventListener('error', () => {
      if (onError) {
        onError(new Error('EventSource connection error'));
      }
    });

    return eventSource;
  }

  // Utility method to check if agent is ready to receive messages
  async isReady(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.status === 'stable';
    } catch {
      return false;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getStatus();
      return true;
    } catch {
      return false;
    }
  }

  setDebug(debug: boolean): void {
    this.debug = debug;
  }
}

// Utility functions to get settings from browser storage
export function getRealAgentAPIConfigFromStorage(repoFullname?: string): RealAgentAPIConfig {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side rendering or Node.js environment - use environment variables
    return {
      baseURL: process.env.NEXT_PUBLIC_REAL_AGENTAPI_URL || 'http://localhost:8080',
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      debug: process.env.NODE_ENV === 'development',
    };
  }
  
  let settings;
  
  try {
    if (repoFullname) {
      // Get repository-specific settings (which includes global settings as fallback)
      settings = loadRepositorySettings(repoFullname);
    } else {
      // Get global settings
      settings = loadGlobalSettings();
    }
    
    return {
      baseURL: settings.agentApi.endpoint || process.env.NEXT_PUBLIC_REAL_AGENTAPI_URL || 'http://localhost:8080',
      timeout: settings.agentApi.timeout || parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      debug: process.env.NODE_ENV === 'development',
    };
  } catch (error) {
    console.warn('Failed to load settings from storage for real agentapi, using environment variables:', error);
    // Fallback to environment variables if storage access fails
    return {
      baseURL: process.env.NEXT_PUBLIC_REAL_AGENTAPI_URL || 'http://localhost:8080',
      timeout: parseInt(process.env.AGENTAPI_TIMEOUT || '10000'),
      debug: process.env.NODE_ENV === 'development',
    };
  }
}

// Factory function for easier client creation
export function createRealAgentAPIClient(config: RealAgentAPIConfig): RealAgentAPIClient {
  return new RealAgentAPIClient(config);
}

// Factory function to create client using stored settings
export function createRealAgentAPIClientFromStorage(repoFullname?: string): RealAgentAPIClient {
  const config = getRealAgentAPIConfigFromStorage(repoFullname);
  return new RealAgentAPIClient(config);
}

// Default client instance for convenience (uses global settings from storage)
export const realAgentAPI = createRealAgentAPIClientFromStorage();