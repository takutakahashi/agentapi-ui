import { Chat, ChatListResponse } from '../types/chat'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

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
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add authorization header if API key is available
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (apiKey) {
    defaultHeaders['Authorization'] = `Bearer ${apiKey}`
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