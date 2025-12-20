import { MessageTemplate } from './messageTemplate';

// Settings type for routing
export type SettingsType = 'personal' | 'team'

// Runbook リポジトリ設定
export interface RunbookRepositoryConfig {
  repositoryUrl: string;    // GitHub URL
  branch: string;           // ブランチ名
  directoryPath: string;    // ディレクトリパス
}

// Bedrock 設定
export interface BedrockConfig {
  modelId: string;          // モデル ID
  accessKeyId?: string;     // AWS アクセスキー ID (チーム設定のみ)
  secretAccessKey?: string; // AWS シークレットアクセスキー (チーム設定のみ)
}

// 設定データ（API で保存）
export interface SettingsData {
  runbook?: RunbookRepositoryConfig;
  bedrock?: BedrockConfig;
}

// Personal settings
export type PersonalSettings = SettingsData

// Team settings
export interface TeamSettings extends SettingsData {
  teamId?: string
  teamName?: string
}

export interface MCPServerConfig {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  transport: 'stdio' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

export interface RepositoryHistoryItem {
  repository: string;
  lastUsed: Date;
}

export interface AgentApiProxySettings {
  endpoint: string
  enabled: boolean
  timeout: number
  apiKey: string
  useAsGithubToken?: boolean
}

export interface GlobalSettings {
  agentApiProxy: AgentApiProxySettings
  mcpServers: MCPServerConfig[]
  repositoryHistory: RepositoryHistoryItem[]
  messageTemplates: MessageTemplate[]
  githubAuth?: GitHubOAuthSettings
  created_at: string
  updated_at: string
}

export interface SettingsFormData {
  mcpServers: MCPServerConfig[]
}

// GitHub OAuth settings
export interface GitHubOAuthSettings {
  clientId: string
  proxyEndpoint: string
  sessionId?: string
  accessToken?: string
  created_at: string
  updated_at: string
}

// Default settings
export const getDefaultSettings = (): SettingsFormData => ({
  mcpServers: []
})

// Get proxy settings
export const getDefaultProxySettingsAsync = async (): Promise<AgentApiProxySettings> => {
  const endpoint = await getCurrentHostProxyUrlAsync()

  return {
    endpoint,
    enabled: true,
    timeout: 30000,
    apiKey: ''
  }
}

// Get the current hostname for proxy URL from request headers
export function getCurrentHostProxyUrlFromHeaders(requestHeaders?: HeadersInit): string {
  if (requestHeaders) {
    const headersObj = requestHeaders instanceof Headers ? requestHeaders : new Headers(requestHeaders)
    const host = headersObj.get('host')
    const protocol = headersObj.get('x-forwarded-proto') || 
                    headersObj.get('x-forwarded-scheme') ||
                    (headersObj.get('x-forwarded-ssl') === 'on' ? 'https' : 'http')
    
    if (host) {
      return `${protocol}://${host}/api/proxy`
    }
  }
  
  // Fallback to localhost for development
  return 'http://localhost:3000/api/proxy'
}

// Get the current hostname for proxy URL
function getCurrentHostProxyUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side: fallback to localhost for development
    // Note: headers() is async in Next.js 15, so we can't use it here
    return 'http://localhost:3000/api/proxy'
  }
  
  // Client-side: construct URL from current hostname
  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const port = window.location.port
  
  // Construct the base URL
  let baseUrl = `${protocol}//${hostname}`
  if (port && port !== '80' && port !== '443') {
    baseUrl += `:${port}`
  }
  
  return `${baseUrl}/api/proxy`
}

// Async version for server-side use with Next.js 15
export async function getCurrentHostProxyUrlAsync(): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side: try to get hostname from request headers
    try {
      const { headers } = await import('next/headers')
      const headersList = await headers()
      const host = headersList.get('host')
      const protocol = headersList.get('x-forwarded-proto') || 
                      headersList.get('x-forwarded-scheme') ||
                      (headersList.get('x-forwarded-ssl') === 'on' ? 'https' : 'http')
      
      if (host) {
        return `${protocol}://${host}/api/proxy`
      }
    } catch (error) {
      // headers() might not be available in all contexts
      console.warn('Failed to get request headers for proxy URL:', error)
    }
    
    // Fallback to localhost for development
    return 'http://localhost:3000/api/proxy'
  }
  
  // Client-side: construct URL from current hostname
  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const port = window.location.port
  
  // Construct the base URL
  let baseUrl = `${protocol}//${hostname}`
  if (port && port !== '80' && port !== '443') {
    baseUrl += `:${port}`
  }
  
  return `${baseUrl}/api/proxy`
}

// Default proxy settings for profiles
export const getDefaultProxySettings = (): AgentApiProxySettings => {
  const endpoint = getCurrentHostProxyUrl()
  
  return {
    endpoint,
    enabled: true,
    timeout: 30000,
    apiKey: ''
  }
}



// Global settings utilities
export const loadGlobalSettings = (): SettingsFormData => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return getDefaultSettings()
  }
  
  try {
    const savedSettings = localStorage.getItem('agentapi-global-settings')
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings)
      // Ensure all required properties exist with proper defaults
      return mergeWithDefaults(parsedSettings, getDefaultSettings())
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
    mcpServers: Array.isArray(partialSettings?.mcpServers)
      ? partialSettings.mcpServers
      : defaultSettings.mcpServers
  }
}

// Merge settings with hierarchy: global settings as base, repo settings as overrides
const mergeSettings = (globalSettings: SettingsFormData, repoSettings: SettingsFormData): SettingsFormData => {
  return {
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

// Full global settings (with all fields)
const FULL_GLOBAL_SETTINGS_KEY = 'agentapi-full-global-settings'

export const getDefaultFullGlobalSettings = (): GlobalSettings => {
  const now = new Date().toISOString()
  return {
    agentApiProxy: getDefaultProxySettings(),
    mcpServers: [],
    repositoryHistory: [],
    messageTemplates: [],
    created_at: now,
    updated_at: now
  }
}

export const loadFullGlobalSettings = (): GlobalSettings => {
  if (typeof window === 'undefined') {
    return getDefaultFullGlobalSettings()
  }

  try {
    const savedSettings = localStorage.getItem(FULL_GLOBAL_SETTINGS_KEY)
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings)
      // Convert repositoryHistory lastUsed to Date objects
      if (parsedSettings.repositoryHistory) {
        parsedSettings.repositoryHistory = parsedSettings.repositoryHistory.map(
          (item: { repository: string; lastUsed: string | Date }) => ({
            ...item,
            lastUsed: new Date(item.lastUsed)
          })
        )
      }
      return {
        ...getDefaultFullGlobalSettings(),
        ...parsedSettings
      }
    }
  } catch (err) {
    console.error('Failed to load full global settings:', err)
  }
  return getDefaultFullGlobalSettings()
}

export const saveFullGlobalSettings = (settings: GlobalSettings): void => {
  if (typeof window === 'undefined') {
    console.warn('Cannot save full global settings: localStorage not available (server-side)')
    return
  }

  try {
    // Convert repositoryHistory Date objects to ISO strings
    const settingsToSave = {
      ...settings,
      repositoryHistory: settings.repositoryHistory.map(item => ({
        ...item,
        lastUsed: item.lastUsed instanceof Date ? item.lastUsed.toISOString() : item.lastUsed
      })),
      updated_at: new Date().toISOString()
    }
    localStorage.setItem(FULL_GLOBAL_SETTINGS_KEY, JSON.stringify(settingsToSave))
  } catch (err) {
    console.error('Failed to save full global settings:', err)
    throw err
  }
}

// Repository history utilities
const MAX_REPOSITORY_HISTORY = 10

export const addRepositoryToHistory = (repository: string): void => {
  if (!repository.trim()) return

  const settings = loadFullGlobalSettings()
  const existingIndex = settings.repositoryHistory.findIndex(
    item => item.repository === repository
  )

  const now = new Date()

  if (existingIndex !== -1) {
    settings.repositoryHistory[existingIndex].lastUsed = now
  } else {
    settings.repositoryHistory.unshift({
      repository,
      lastUsed: now
    })
  }

  settings.repositoryHistory.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
  settings.repositoryHistory = settings.repositoryHistory.slice(0, MAX_REPOSITORY_HISTORY)

  saveFullGlobalSettings(settings)
}

export const getRepositoryHistory = (): RepositoryHistoryItem[] => {
  const settings = loadFullGlobalSettings()
  return settings.repositoryHistory
}

// Message template utilities
export const getMessageTemplates = (): MessageTemplate[] => {
  const settings = loadFullGlobalSettings()
  return settings.messageTemplates
}

export const saveMessageTemplates = (templates: MessageTemplate[]): void => {
  const settings = loadFullGlobalSettings()
  settings.messageTemplates = templates
  saveFullGlobalSettings(settings)
}

// GitHub Auth utilities
export const getGitHubAuthSettings = (): GitHubOAuthSettings | undefined => {
  const settings = loadFullGlobalSettings()
  return settings.githubAuth
}

export const saveGitHubAuthSettings = (auth: GitHubOAuthSettings): void => {
  const settings = loadFullGlobalSettings()
  settings.githubAuth = auth
  saveFullGlobalSettings(settings)
}