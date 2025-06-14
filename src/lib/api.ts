import { Chat, ChatListResponse } from '../types/chat'
import { loadGlobalSettings } from '../types/settings'
import { createAgentAPIProxyClientFromStorage } from './agentapi-proxy-client'

// Get API configuration from browser storage
function getAPIConfig(): { baseURL: string; apiKey?: string } {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side rendering or Node.js environment - use environment variables
    return {
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
      apiKey: process.env.NEXT_PUBLIC_API_KEY || process.env.AGENTAPI_API_KEY,
    };
  }
  
  try {
    const settings = loadGlobalSettings();
    return {
      baseURL: settings.agentApiProxy.endpoint || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
      apiKey: settings.agentApi.apiKey || process.env.NEXT_PUBLIC_API_KEY || process.env.AGENTAPI_API_KEY,
    };
  } catch (error) {
    console.warn('Failed to load settings from storage for chat API, using environment variables:', error);
    return {
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
      apiKey: process.env.NEXT_PUBLIC_API_KEY || process.env.AGENTAPI_API_KEY,
    };
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getAPIConfig()
  const url = `${config.baseURL}${endpoint}`
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add authorization header if API key is available
  if (config.apiKey) {
    defaultHeaders['Authorization'] = `Bearer ${config.apiKey}`
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new ApiError(
        response.status,
        `API request failed: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export const chatApi = {
  async getChats(params?: {
    page?: number
    limit?: number
    status?: Chat['status']
    repository?: string
  }): Promise<ChatListResponse> {
    const searchParams = new URLSearchParams()
    
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.status) searchParams.set('status', params.status)
    if (params?.repository) searchParams.set('repository', params.repository)

    const endpoint = `/chats${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    return apiRequest<ChatListResponse>(endpoint)
  },

  async getChat(id: string): Promise<Chat> {
    return apiRequest<Chat>(`/chats/${id}`)
  },

  async createChat(data: Partial<Chat>): Promise<Chat> {
    return apiRequest<Chat>('/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateChat(id: string, data: Partial<Chat>): Promise<Chat> {
    return apiRequest<Chat>(`/chats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async deleteChat(id: string): Promise<void> {
    return apiRequest<void>(`/chats/${id}`, {
      method: 'DELETE',
    })
  },
}

// AgentAPI Proxy client
export const agentAPI = createAgentAPIProxyClientFromStorage()