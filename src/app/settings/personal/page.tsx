'use client'

import { useState, useEffect } from 'react'
import { SettingsData, BedrockConfig, APIMCPServerConfig, MarketplaceConfig, AuthMode, prepareSettingsForSave, getSendGithubTokenOnSessionStart, setSendGithubTokenOnSessionStart, getUseClaudeAgentAPI, setUseClaudeAgentAPI, EnterKeyBehavior, getEnterKeyBehavior, setEnterKeyBehavior, FontSettings as FontSettingsType, getFontSettings, setFontSettings } from '@/types/settings'
import { BedrockSettings, SettingsAccordion, GithubTokenSettings, MCPServerSettings, MarketplaceSettings, PluginSettings, KeyBindingSettings, ClaudeOAuthSettings, FontSettings, SyncSettings } from '@/components/settings'
import { OneClickPushNotifications } from '@/app/components/OneClickPushNotifications'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'

export default function PersonalSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({})
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendGithubToken, setSendGithubToken] = useState(false)
  const [useClaudeAgentAPI, setUseClaudeAgentAPIState] = useState(false)
  const [enterKeyBehavior, setEnterKeyBehaviorState] = useState<EnterKeyBehavior>('send')
  const [fontSettings, setFontSettingsState] = useState<FontSettingsType>({ fontSize: 14, fontFamily: 'sans-serif' })
  const { showToast } = useToast()

  // GitHub Token 設定、Claude AgentAPI 設定、Enter キー設定、Font 設定の読み込み
  useEffect(() => {
    // GitHub Token 設定を読み込み
    setSendGithubToken(getSendGithubTokenOnSessionStart())
    // Claude AgentAPI 設定を読み込み
    setUseClaudeAgentAPIState(getUseClaudeAgentAPI())
    // Enter キー設定を読み込み
    setEnterKeyBehaviorState(getEnterKeyBehavior())
    // Font 設定を読み込み
    setFontSettingsState(getFontSettings())
  }, [])

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const client = createAgentAPIProxyClientFromStorage()
        const proxyUserInfo = await client.getUserInfo()

        if (proxyUserInfo.username) {
          setUserName(proxyUserInfo.username)
        } else {
          setError('ユーザー情報の取得に失敗しました')
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to get user info:', err)
        setError('ユーザー情報の取得に失敗しました')
        setLoading(false)
      }
    }

    loadUserInfo()
  }, [])

  useEffect(() => {
    const fetchSettings = async () => {
      if (!userName) return

      try {
        const client = createAgentAPIProxyClientFromStorage()
        const data = await client.getSettings(userName)
        setSettings(data)
      } catch (err) {
        console.error('Failed to load personal settings:', err)
        setError('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [userName])

  const handleMarketplacesChange = (marketplaces: Record<string, MarketplaceConfig>) => {
    setSettings((prev) => ({ ...prev, marketplaces }))
  }

  const handlePluginsChange = (plugins: string[]) => {
    setSettings((prev) => ({ ...prev, enabled_plugins: plugins }))
  }

  const handleBedrockChange = (config: BedrockConfig) => {
    setSettings((prev) => ({ ...prev, bedrock: config }))
  }

  const handleClaudeOAuthChange = (token: string, authMode: AuthMode) => {
    setSettings((prev) => ({
      ...prev,
      claude_code_oauth_token: token,
      auth_mode: authMode,
    }))
  }

  const handleMCPServersChange = (servers: Record<string, APIMCPServerConfig>) => {
    setSettings((prev) => ({ ...prev, mcp_servers: servers }))
  }

  const handleGithubTokenChange = (enabled: boolean) => {
    setSendGithubToken(enabled)
    setSendGithubTokenOnSessionStart(enabled)
  }

  const handleUseClaudeAgentAPIChange = (enabled: boolean) => {
    console.log('[PersonalSettings] Changing useClaudeAgentAPI to:', enabled)
    setUseClaudeAgentAPIState(enabled)
    setUseClaudeAgentAPI(enabled)
    // Verify it was saved
    const saved = getUseClaudeAgentAPI()
    console.log('[PersonalSettings] Verified saved value:', saved)
  }

  const handleEnterKeyBehaviorChange = (behavior: EnterKeyBehavior) => {
    setEnterKeyBehaviorState(behavior)
    setEnterKeyBehavior(behavior)
  }

  const handleFontSettingsChange = (settings: FontSettingsType) => {
    setFontSettingsState(settings)
    setFontSettings(settings)
  }

  const handleSyncSettingsChange = (gitRepository: string, storagePath: string) => {
    setSettings((prev) => ({
      ...prev,
      git_repository: gitRepository,
      storage_path: storagePath,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const client = createAgentAPIProxyClientFromStorage()
      // 空の値を除外して保存
      const preparedSettings = prepareSettingsForSave(settings)
      await client.saveSettings(userName, preparedSettings)
      showToast('Settings saved successfully!', 'success')
    } catch (err) {
      console.error('Failed to save personal settings:', err)
      setError('Failed to save settings')
      showToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Personal Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your personal preferences
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Personal Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your personal preferences
          {userName && (
            <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">
              ({userName})
            </span>
          )}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {userName && (
        <>
          <SettingsAccordion
            title="Marketplace"
            description="Configure plugin marketplaces"
            defaultOpen
          >
            <MarketplaceSettings marketplaces={settings.marketplaces} onChange={handleMarketplacesChange} />
          </SettingsAccordion>

          <SettingsAccordion
            title="Plugins"
            description="Enable plugins from official and registered marketplaces"
            defaultOpen
          >
            <PluginSettings
              enabledPlugins={settings.enabled_plugins}
              availableMarketplaces={Object.keys(settings.marketplaces || {})}
              onChange={handlePluginsChange}
            />
          </SettingsAccordion>

          <SettingsAccordion
            title="AI Settings"
            description="Configure AI providers and models"
            defaultOpen
          >
            <div className="space-y-6">
              <ClaudeOAuthSettings
                hasToken={settings.has_claude_code_oauth_token ?? false}
                authMode={settings.auth_mode}
                onChange={handleClaudeOAuthChange}
              />
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Bedrock Settings
                </h4>
                <BedrockSettings config={settings.bedrock} onChange={handleBedrockChange} />
              </div>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="MCP Servers"
            description="Configure Model Context Protocol servers"
            defaultOpen
          >
            <MCPServerSettings servers={settings.mcp_servers} onChange={handleMCPServersChange} />
          </SettingsAccordion>

          <SettingsAccordion
            title="Session Settings"
            description="Configure session behavior"
            defaultOpen
          >
            <div className="space-y-6">
              <KeyBindingSettings enterKeyBehavior={enterKeyBehavior} onChange={handleEnterKeyBehaviorChange} />
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <FontSettings fontSettings={fontSettings} onChange={handleFontSettingsChange} />
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <GithubTokenSettings enabled={sendGithubToken} onChange={handleGithubTokenChange} />
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="use-claude-agentapi"
                      type="checkbox"
                      checked={useClaudeAgentAPI}
                      onChange={(e) => handleUseClaudeAgentAPIChange(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="use-claude-agentapi" className="font-medium text-gray-700 dark:text-gray-300">
                      新しいエージェントを使用 (Claude AgentAPI)
                    </label>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      有効にすると、セッション作成時に agent_type パラメーターに claude-agentapi が設定されます
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Settings Sync"
            description="Configure settings synchronization with Git repository"
            defaultOpen
          >
            <SyncSettings
              gitRepository={settings.git_repository}
              storagePath={settings.storage_path}
              onChange={handleSyncSettingsChange}
            />
          </SettingsAccordion>

          <SettingsAccordion
            title="Push Notifications"
            description="Configure push notification settings"
            defaultOpen
          >
            <OneClickPushNotifications />
          </SettingsAccordion>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
