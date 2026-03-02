'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsData, BedrockConfig, APIMCPServerConfig, MarketplaceConfig, AuthMode, prepareSettingsForSave, getSendGithubTokenOnSessionStart, setSendGithubTokenOnSessionStart, AgentApiType, getAgentApiType, setAgentApiType, EnterKeyBehavior, getEnterKeyBehavior, setEnterKeyBehavior, FontSettings as FontSettingsType, getFontSettings, setFontSettings, getMemoryEnabled, setMemoryEnabled, getMemorySummarizeDrafts, setMemorySummarizeDrafts } from '@/types/settings'
import { BedrockSettings, SettingsAccordion, GithubTokenSettings, MCPServerSettings, MarketplaceSettings, PluginSettings, KeyBindingSettings, ClaudeOAuthSettings, FontSettings, EnvVarsSettings, MemorySettings } from '@/components/settings'
import { OneClickPushNotifications } from '@/app/components/OneClickPushNotifications'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'

export default function PersonalSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SettingsData>({})
  const [originalSettings, setOriginalSettings] = useState<SettingsData>({})
  const [userName, setUserName] = useState('')
  const [userTeams, setUserTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendGithubToken, setSendGithubToken] = useState(false)
  const [agentApiType, setAgentApiTypeState] = useState<AgentApiType>('default')
  const [enterKeyBehavior, setEnterKeyBehaviorState] = useState<EnterKeyBehavior>('send')
  const [fontSettings, setFontSettingsState] = useState<FontSettingsType>({ fontSize: 14, fontFamily: 'sans-serif' })
  const [memoryEnabled, setMemoryEnabledState] = useState(true)
  const [memorySummarizeDrafts, setMemorySummarizeDraftsState] = useState<boolean | undefined>(undefined)
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
    // AgentAPI タイプ設定を読み込み
    setAgentApiTypeState(getAgentApiType())
    // Enter キー設定を読み込み
    setEnterKeyBehaviorState(getEnterKeyBehavior())
    // Font 設定を読み込み
    setFontSettingsState(getFontSettings())
    // メモリ設定を localStorage から読み込み（APIロード前の初期値として使用）
    setMemoryEnabledState(getMemoryEnabled())
    setMemorySummarizeDraftsState(getMemorySummarizeDrafts())
  }, [])

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const client = createAgentAPIProxyClientFromStorage()
        const proxyUserInfo = await client.getUserInfo()

        if (proxyUserInfo.username) {
          setUserName(proxyUserInfo.username)
          setUserTeams(proxyUserInfo.teams || [])
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

        // API の設定を優先してメモリ設定を同期
        // memory_enabled が API に保存されていれば state と localStorage を更新
        if (data.memory_enabled !== undefined) {
          setMemoryEnabledState(data.memory_enabled)
          setMemoryEnabled(data.memory_enabled)
        }
        // memory_summarize_drafts が API に保存されていれば state と localStorage を更新
        if (data.memory_summarize_drafts !== undefined) {
          setMemorySummarizeDraftsState(data.memory_summarize_drafts)
          setMemorySummarizeDrafts(data.memory_summarize_drafts)
        }
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

  const handlePreferredTeamChange = (teamId: string) => {
    setSettings((prev) => ({ ...prev, preferred_team_id: teamId }))
  }

  const handleGithubTokenChange = (enabled: boolean) => {
    setSendGithubToken(enabled)
    setSendGithubTokenOnSessionStart(enabled)
  }

  const handleAgentApiTypeChange = (type: AgentApiType) => {
    setAgentApiTypeState(type)
    setAgentApiType(type)
  }

  const handleEnterKeyBehaviorChange = (behavior: EnterKeyBehavior) => {
    setEnterKeyBehaviorState(behavior)
    setEnterKeyBehavior(behavior)
  }

  const handleFontSettingsChange = (settings: FontSettingsType) => {
    setFontSettingsState(settings)
    setFontSettings(settings)
  }

  const handleMemoryEnabledChange = (enabled: boolean) => {
    setMemoryEnabledState(enabled)
    setMemoryEnabled(enabled) // localStorage にも即時反映（他コンポーネント用）
    setSettings((prev) => ({ ...prev, memory_enabled: enabled })) // API 保存対象に追加
  }

  const handleMemorySummarizeDraftsChange = (enabled: boolean | undefined) => {
    setMemorySummarizeDraftsState(enabled)
    setMemorySummarizeDrafts(enabled) // localStorage にも即時反映（他コンポーネント用）
    setSettings((prev) => ({ ...prev, memory_summarize_drafts: enabled })) // API 保存対象に追加
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (response.ok) {
        router.push('/login')
      }
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setLoggingOut(false)
    }
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
              {/* Team Selector - チームが存在する場合のみ表示 */}
              {userTeams.length > 0 && (
                <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    使用するチーム設定
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    選択したチームの設定（Bedrock、MCP servers、環境変数など）がセッションに適用されます。未選択の場合はすべてのチームの設定がマージされます。
                  </p>
                  <select
                    value={settings.preferred_team_id || ''}
                    onChange={(e) => handlePreferredTeamChange(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">すべてのチームの設定をマージして使用</option>
                    {userTeams.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                  {settings.preferred_team_id && (
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      セッションは <strong>{settings.preferred_team_id}</strong> の設定のみを使用します
                    </p>
                  )}
                </div>
              )}
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
                <div className="text-sm">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                    エージェントタイプ
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 mb-3">
                    セッション作成時に送信する agent_type を選択します。&quot;デフォルト&quot; を選択すると agent_type は送信されません。
                  </p>
                  <div className="space-y-2">
                    {([
                      { value: 'default', label: 'デフォルト', description: 'agent_type を送信しない（バックエンドのデフォルト動作）' },
                      { value: 'claude-agentapi', label: 'Claude AgentAPI', description: 'agent_type=claude-agentapi を送信' },
                      { value: 'codex-agentapi', label: 'Codex AgentAPI', description: 'agent_type=codex-agentapi を送信' },
                    ] as { value: AgentApiType; label: string; description: string }[]).map(({ value, label, description }) => (
                      <label key={value} className="flex items-start cursor-pointer group">
                        <input
                          type="radio"
                          name="agent-api-type"
                          value={value}
                          checked={agentApiType === value}
                          onChange={() => handleAgentApiTypeChange(value)}
                          className="mt-0.5 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="ml-3">
                          <span className="block font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {label}
                          </span>
                          <span className="block text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                            {description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Memory"
            description="メモリ機能の有効/無効とドラフト集約の設定"
            defaultOpen
          >
            <MemorySettings
              memoryEnabled={memoryEnabled}
              memorySummarizeDrafts={memorySummarizeDrafts}
              onMemoryEnabledChange={handleMemoryEnabledChange}
              onMemorySummarizeDraftsChange={handleMemorySummarizeDraftsChange}
            />
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

          {/* ログアウト */}
          <div className="mt-8 pt-6 border-t border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">ログアウト</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">アカウントからサインアウトします</p>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loggingOut && (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                )}
                {loggingOut ? 'ログアウト中...' : 'ログアウト'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
