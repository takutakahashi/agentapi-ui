export interface AgentApiSettings {
  endpoint: string
  apiKey: string
  timeout: number
  customHeaders: Record<string, string>
}

export interface AgentApiProxySettings {
  endpoint: string
  enabled: boolean
  timeout: number
}

export interface EnvironmentVariable {
  key: string
  value: string
  description?: string
}

export interface RepositorySettings {
  repoFullname: string
  agentApi: AgentApiSettings
  agentApiProxy: AgentApiProxySettings
  environmentVariables: EnvironmentVariable[]
  created_at: string
  updated_at: string
}

export interface GlobalSettings {
  agentApi: AgentApiSettings
  agentApiProxy: AgentApiProxySettings
  environmentVariables: EnvironmentVariable[]
  created_at: string
  updated_at: string
}

export interface SettingsFormData {
  agentApi: AgentApiSettings
  agentApiProxy: AgentApiProxySettings
  environmentVariables: EnvironmentVariable[]
}

// Default settings
export const getDefaultSettings = (): SettingsFormData => ({
  agentApi: {
    endpoint: process.env.NEXT_PUBLIC_AGENTAPI_URL || 'http://localhost:8080/api/v1',
    apiKey: '',
    timeout: 30000,
    customHeaders: {}
  },
  agentApiProxy: {
    endpoint: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8081',
    enabled: true,
    timeout: 30000
  },
  environmentVariables: []
})

// Global settings utilities
export const loadGlobalSettings = (): SettingsFormData => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return getDefaultSettings()
  }
  
  try {
    const savedSettings = localStorage.getItem('agentapi-global-settings')
    if (savedSettings) {
      return JSON.parse(savedSettings)
    }
  } catch (err) {
    console.error('Failed to load global settings:', err)
  }
  return getDefaultSettings()
}

export const saveGlobalSettings = (settings: SettingsFormData): void => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    console.warn('Cannot save settings: localStorage not available (server-side)')
    return
  }
  
  try {
    localStorage.setItem('agentapi-global-settings', JSON.stringify(settings))
  } catch (err) {
    console.error('Failed to save global settings:', err)
    throw err
  }
}

// Repository settings utilities with hierarchy support
export const loadRepositorySettings = (repoFullname: string): SettingsFormData => {
  const globalSettings = loadGlobalSettings()
  
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return globalSettings
  }
  
  try {
    const savedSettings = localStorage.getItem(`agentapi-settings-${repoFullname}`)
    if (savedSettings) {
      const repoSettings = JSON.parse(savedSettings)
      // Merge global settings with repository-specific overrides
      return mergeSettings(globalSettings, repoSettings)
    }
  } catch (err) {
    console.error('Failed to load repository settings:', err)
  }
  
  // Return global settings as fallback
  return globalSettings
}

export const saveRepositorySettings = (repoFullname: string, settings: SettingsFormData): void => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    console.warn('Cannot save repository settings: localStorage not available (server-side)')
    return
  }
  
  try {
    localStorage.setItem(`agentapi-settings-${repoFullname}`, JSON.stringify(settings))
  } catch (err) {
    console.error('Failed to save repository settings:', err)
    throw err
  }
}

// Merge settings with hierarchy: global settings as base, repo settings as overrides
const mergeSettings = (globalSettings: SettingsFormData, repoSettings: SettingsFormData): SettingsFormData => {
  return {
    agentApi: {
      ...globalSettings.agentApi,
      ...repoSettings.agentApi,
      customHeaders: {
        ...globalSettings.agentApi.customHeaders,
        ...repoSettings.agentApi.customHeaders
      }
    },
    agentApiProxy: {
      ...globalSettings.agentApiProxy,
      ...repoSettings.agentApiProxy
    },
    environmentVariables: [
      ...globalSettings.environmentVariables,
      ...repoSettings.environmentVariables.filter(repoVar => 
        !globalSettings.environmentVariables.some(globalVar => globalVar.key === repoVar.key)
      )
    ]
  }
}

// Get effective settings for display (what would actually be used)
export const getEffectiveSettings = (repoFullname: string): SettingsFormData => {
  return loadRepositorySettings(repoFullname)
}