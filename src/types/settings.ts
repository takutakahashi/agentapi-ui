import { MCPServerConfig } from './profile';
import { CookieStorage } from '../utils/cookieStorage';

export interface AgentApiProxySettings {
  endpoint: string
  enabled: boolean
  timeout: number
  apiKey: string
  useAsGithubToken?: boolean
}

export interface EnvironmentVariable {
  key: string
  value: string
  description?: string
}

export interface RepositorySettings {
  repoFullname: string
  environmentVariables: EnvironmentVariable[]
  created_at: string
  updated_at: string
}

export interface GlobalSettings {
  environmentVariables: EnvironmentVariable[]
  mcpServers: MCPServerConfig[]
  created_at: string
  updated_at: string
}

export interface SettingsFormData {
  environmentVariables: EnvironmentVariable[]
  mcpServers: MCPServerConfig[]
}

// Default settings
export const getDefaultSettings = (): SettingsFormData => ({
  environmentVariables: [],
  mcpServers: []
})

// Default proxy settings for profiles
export const getDefaultProxySettings = (): AgentApiProxySettings => ({
  endpoint: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
  enabled: true,
  timeout: 30000,
  apiKey: ''
})

// Global settings utilities
export const loadGlobalSettings = (): SettingsFormData => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return getDefaultSettings()
  }
  
  try {
    const savedSettings = localStorage.getItem('agentapi-global-settings')
    let parsedSettings: Partial<SettingsFormData> = {}
    
    if (savedSettings) {
      parsedSettings = JSON.parse(savedSettings)
    }
    
    // Load environment variables from cookies
    const envVarsFromCookie = CookieStorage.getGlobalEnvironmentVariables()
    if (envVarsFromCookie) {
      parsedSettings.environmentVariables = Object.entries(envVarsFromCookie).map(([key, value]) => ({
        key,
        value,
        description: ''
      }))
    }
    
    // Ensure all required properties exist with proper defaults
    return mergeWithDefaults(parsedSettings, getDefaultSettings())
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
    // Save environment variables to cookies
    if (settings.environmentVariables && settings.environmentVariables.length > 0) {
      const envVarsObj = settings.environmentVariables.reduce((acc, env) => {
        acc[env.key] = env.value
        return acc
      }, {} as Record<string, string>)
      CookieStorage.setGlobalEnvironmentVariables(envVarsObj)
    }
    
    // Save non-sensitive settings to localStorage
    const settingsToSave = {
      ...settings,
      environmentVariables: [] // Remove environment variables from localStorage
    }
    localStorage.setItem('agentapi-global-settings', JSON.stringify(settingsToSave))
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
      // Ensure repository settings have proper structure before merging
      const safeRepoSettings = mergeWithDefaults(repoSettings, getDefaultSettings())
      // Merge global settings with repository-specific overrides
      return mergeSettings(globalSettings, safeRepoSettings)
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

// Safely merge partial settings with defaults to ensure all properties exist
const mergeWithDefaults = (partialSettings: Partial<SettingsFormData> | null | undefined, defaultSettings: SettingsFormData): SettingsFormData => {
  return {
    environmentVariables: Array.isArray(partialSettings?.environmentVariables) 
      ? partialSettings.environmentVariables 
      : defaultSettings.environmentVariables,
    mcpServers: Array.isArray(partialSettings?.mcpServers)
      ? partialSettings.mcpServers
      : defaultSettings.mcpServers
  }
}

// Merge settings with hierarchy: global settings as base, repo settings as overrides
const mergeSettings = (globalSettings: SettingsFormData, repoSettings: SettingsFormData): SettingsFormData => {
  return {
    environmentVariables: [
      ...(globalSettings.environmentVariables || []),
      ...(repoSettings.environmentVariables || []).filter(repoVar => 
        !(globalSettings.environmentVariables || []).some(globalVar => globalVar.key === repoVar.key)
      )
    ],
    mcpServers: [
      ...(globalSettings.mcpServers || []),
      ...(repoSettings.mcpServers || []).filter(repoServer => 
        !(globalSettings.mcpServers || []).some(globalServer => globalServer.id === repoServer.id)
      )
    ]
  }
}

// Get effective settings for display (what would actually be used)
export const getEffectiveSettings = (repoFullname: string): SettingsFormData => {
  return loadRepositorySettings(repoFullname)
}