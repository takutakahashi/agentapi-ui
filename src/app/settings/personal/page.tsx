'use client'

import { useState, useEffect, useRef } from 'react'
import { SettingsData, BedrockConfig, APIMCPServerConfig, MarketplaceConfig, AuthMode, prepareSettingsForSave, getSendGithubTokenOnSessionStart, setSendGithubTokenOnSessionStart, getAgentType, setAgentType, EnterKeyBehavior, getEnterKeyBehavior, setEnterKeyBehavior, FontSettings as FontSettingsType, getFontSettings, setFontSettings } from '@/types/settings'
import { BedrockSettings, SettingsAccordion, GithubTokenSettings, MCPServerSettings, MarketplaceSettings, PluginSettings, KeyBindingSettings, ClaudeOAuthSettings, FontSettings, EnvVarsSettings } from '@/components/settings'
import { OneClickPushNotifications } from '@/app/components/OneClickPushNotifications'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'

export default function PersonalSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({})
  const [originalSettings, setOriginalSettings] = useState<SettingsData>({})
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendGithubToken, setSendGithubToken] = useState(false)
  const [agentType, setAgentTypeState] = useState('')
  const [customAgentType, setCustomAgentType] = useState('')
  const [enterKeyBehavior, setEnterKeyBehaviorState] = useState<EnterKeyBehavior>('send')
  const [fontSettings, setFontSettingsState] = useState<FontSettingsType>({ fontSize: 14, fontFamily: 'sans-serif' })
  const { showToast } = useToast()
  const hasUnsavedChangesRef = useRef(false)

  // 未保存の変更があるかチェック
  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings)

  // hasUnsavedChanges を ref に保存（イベントハンドラで最新の値を参照するため）
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])

  // ページ離脱時の警告
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

  // GitHub Token 設定、Claude AgentAPI 設定、Enter キー設定、Font 設定の読み込み
  useEffect(() => {
    // GitHub Token 設定を読み込み
    setSendGithubToken(getSendGithubTokenOnSessionStart())
    // Agent Type 設定を読み込み
    const savedAgentType = getAgentType()
    const knownAgentTypes = ['', 'claude-agentapi']
    if (knownAgentTypes.includes(savedAgentType)) {
      setAgentTypeState(savedAgentType)
    } else {
      // 既知の値でない場合は「その他」として扱う
      setAgentTypeState('__custom__')
      setCustomAgentType(savedAgentType)
    }
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
        setOriginalSettings(data)
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

  const handleEnvVarsChange = (updates: Record<string, string>) => {
    setSettings((prev) => {
      const existingEnvVars = prev.env_vars || {}
      const newEnvVars = { ...existingEnvVars, ...updates }
      return { ...prev, env_vars: newEnvVars }
    })
  }

  const handleGithubTokenChange = (enabled: boolean) => {
    setSendGithubToken(enabled)
    setSendGithubTokenOnSessionStart(enabled)
  }

  const handleAgentTypeChange = (value: string) => {
    setAgentTypeState(value)
    if (value !== '__custom__') {
      setAgentType(value)
    }
  }

  const handleCustomAgentTypeChange = (value: string) => {
    setCustomAgentType(value)
    setAgentType(value)
  }

  const handleEnterKeyBehaviorChange = (behavior: EnterKeyBehavior) => {
    setEnterKeyBehaviorState(behavior)
    setEnterKeyBehavior(behavior)
  }

  const handleFontSettingsChange = (settings: FontSettingsType) => {
    setFontSettingsState(settings)
    setFontSettings(settings)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const client = createAgentAPIProxyClientFromStorage()
      // 空の値を除外して保存
      const preparedSettings = prepareSettingsForSave(settings)
      await client.saveSettings(userName, preparedSettings)
      // 保存成功後、元の設定を更新
      setOriginalSettings(settings)
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
            title="Environment Variables"
            description="Configure custom environment variables for sessions"
            defaultOpen
          >
            <EnvVarsSettings envVarKeys={settings.env_var_keys} onChange={handleEnvVarsChange} />
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
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    エージェントの種類 (agent_type)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    セッション作成時に使用する agent_type を選択してください
                  </p>
                  <div className="space-y-3">
                    {[
                      { value: '', label: '使用しない', description: 'agent_type パラメーターを送信しません' },
                      { value: 'claude-agentapi', label: 'claude-agentapi', description: 'Claude AgentAPI エージェントを使用します' },
                    ].map((option) => (
                      <div key={option.value} className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id={`agent-type-${option.value || 'none'}`}
                            type="radio"
                            name="agent-type"
                            value={option.value}
                            checked={agentType === option.value}
                            onChange={() => handleAgentTypeChange(option.value)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor={`agent-type-${option.value || 'none'}`} className="font-medium text-gray-700 dark:text-gray-300">
                            {option.label}
                          </label>
                          <p className="text-gray-500 dark:text-gray-400">{option.description}</p>
                        </div>
                      </div>
                    ))}
                    {/* その他 (自由記述) */}
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="agent-type-custom"
                          type="radio"
                          name="agent-type"
                          value="__custom__"
                          checked={agentType === '__custom__'}
                          onChange={() => handleAgentTypeChange('__custom__')}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div className="ml-3 text-sm flex-1">
                        <label htmlFor="agent-type-custom" className="font-medium text-gray-700 dark:text-gray-300">
                          その他 (自由記述)
                        </label>
                        <p className="text-gray-500 dark:text-gray-400">入力した値をそのまま agent_type に使用します</p>
                        {agentType === '__custom__' && (
                          <input
                            type="text"
                            value={customAgentType}
                            onChange={(e) => handleCustomAgentTypeChange(e.target.value)}
                            placeholder="agent_type を入力してください"
                            className="mt-2 block w-full max-w-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Push Notifications"
            description="Configure push notification settings"
            defaultOpen
          >
            <OneClickPushNotifications />
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
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
