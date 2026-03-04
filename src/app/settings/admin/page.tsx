'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsData, BedrockConfig, APIMCPServerConfig, MarketplaceConfig, prepareSettingsForSave } from '@/types/settings'
import { BedrockSettings, SettingsAccordion, MCPServerSettings, MarketplaceSettings, PluginSettings, EnvVarsSettings, MemorySettings } from '@/components/settings'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'

const BASE_SETTINGS_NAME = '__base__'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SettingsData>({})
  const [originalSettings, setOriginalSettings] = useState<SettingsData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const { showToast } = useToast()
  const hasUnsavedChangesRef = useRef(false)

  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings)

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        const client = createAgentAPIProxyClientFromStorage()

        // Check admin status
        const userInfo = await client.getUserInfo()
        if (!userInfo?.is_admin) {
          setIsAdmin(false)
          setLoading(false)
          return
        }
        setIsAdmin(true)

        // Load base settings
        try {
          const data = await client.getSettings(BASE_SETTINGS_NAME)
          setSettings(data)
          setOriginalSettings(data)
        } catch {
          // Base settings may not exist yet — start with empty settings
          setSettings({})
          setOriginalSettings({})
        }
      } catch (err) {
        console.error('Failed to load admin data:', err)
        setError('管理者情報の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleMarketplacesChange = (marketplaces: Record<string, MarketplaceConfig>) => {
    setSettings((prev) => ({ ...prev, marketplaces }))
  }

  const handlePluginsChange = (plugins: string[]) => {
    setSettings((prev) => ({ ...prev, enabled_plugins: plugins }))
  }

  const handleBedrockChange = (config: BedrockConfig) => {
    setSettings((prev) => ({ ...prev, bedrock: config }))
  }

  const handleMCPServersChange = (servers: Record<string, APIMCPServerConfig>) => {
    setSettings((prev) => ({ ...prev, mcp_servers: servers }))
  }

  const handleEnvVarsChange = (updates: Record<string, string>) => {
    setSettings((prev) => {
      const existingEnvVars = prev.env_vars || {}
      const newEnvVars = { ...existingEnvVars, ...updates }
      return { ...prev, env_vars: newEnvVars }
    })
  }

  const handleMemoryEnabledChange = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, memory_enabled: enabled }))
  }

  const handleMemorySummarizeDraftsChange = (enabled: boolean | undefined) => {
    setSettings((prev) => ({ ...prev, memory_summarize_drafts: enabled }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const client = createAgentAPIProxyClientFromStorage()
      const preparedSettings = prepareSettingsForSave(settings)
      await client.saveSettings(BASE_SETTINGS_NAME, preparedSettings)
      setOriginalSettings(settings)
      showToast('Base settings saved successfully!', 'success')
    } catch (err) {
      console.error('Failed to save admin settings:', err)
      setError('設定の保存に失敗しました')
      showToast('Failed to save base settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure global base settings for all users
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Settings
          </h2>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
              Access Denied
            </h3>
            <p className="text-red-600 dark:text-red-400">
              You do not have admin privileges to access this page.
            </p>
            <button
              onClick={() => router.push('/settings/personal')}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Back to Personal Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Admin Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure global base settings applied to all users by default. Users can override these settings in their personal or team settings.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            These are the base settings (<code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">__base__</code>) that serve as organization-wide defaults. Individual users and teams can override any of these settings in their own configuration.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <SettingsAccordion
        title="Marketplace"
        description="Configure plugin marketplaces available to all users"
        defaultOpen
      >
        <MarketplaceSettings marketplaces={settings.marketplaces} onChange={handleMarketplacesChange} />
      </SettingsAccordion>

      <SettingsAccordion
        title="Plugins"
        description="Enable plugins from official and registered marketplaces for all users"
        defaultOpen
      >
        <PluginSettings
          enabledPlugins={settings.enabled_plugins}
          availableMarketplaces={Object.keys(settings.marketplaces || {})}
          onChange={handlePluginsChange}
        />
      </SettingsAccordion>

      <SettingsAccordion
        title="AI Settings (Bedrock)"
        description="Configure default AI provider and model for all users"
        defaultOpen
      >
        <BedrockSettings config={settings.bedrock} onChange={handleBedrockChange} showCredentials />
      </SettingsAccordion>

      <SettingsAccordion
        title="MCP Servers"
        description="Configure base Model Context Protocol servers available to all users"
        defaultOpen
      >
        <MCPServerSettings servers={settings.mcp_servers} onChange={handleMCPServersChange} />
      </SettingsAccordion>

      <SettingsAccordion
        title="Environment Variables"
        description="Configure global environment variables applied to all sessions"
        defaultOpen
      >
        <EnvVarsSettings envVarKeys={settings.env_var_keys} onChange={handleEnvVarsChange} />
      </SettingsAccordion>

      <SettingsAccordion
        title="Memory"
        description="Configure default memory settings for all users"
        defaultOpen
      >
        <MemorySettings
          memoryEnabled={settings.memory_enabled ?? true}
          memorySummarizeDrafts={settings.memory_summarize_drafts}
          onMemoryEnabledChange={handleMemoryEnabledChange}
          onMemorySummarizeDraftsChange={handleMemorySummarizeDraftsChange}
        />
      </SettingsAccordion>

      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        {hasUnsavedChanges && (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>未保存の変更があります</span>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ml-auto"
        >
          {saving && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          {saving ? 'Saving...' : 'Save Base Settings'}
        </button>
      </div>
    </div>
  )
}
