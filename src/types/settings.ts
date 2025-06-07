export interface AgentApiSettings {
  endpoint: string
  apiKey: string
  timeout: number
  customHeaders: Record<string, string>
}

export interface EnvironmentVariable {
  key: string
  value: string
  description?: string
}

export interface RepositorySettings {
  repoFullname: string
  agentApi: AgentApiSettings
  environmentVariables: EnvironmentVariable[]
  created_at: string
  updated_at: string
}

export interface SettingsFormData {
  agentApi: AgentApiSettings
  environmentVariables: EnvironmentVariable[]
}

// Default settings
export const getDefaultSettings = (): SettingsFormData => ({
  agentApi: {
    endpoint: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
    apiKey: '',
    timeout: 30000,
    customHeaders: {}
  },
  environmentVariables: []
})