'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsData, BedrockConfig, APIMCPServerConfig, MarketplaceConfig, AuthMode, ExternalSessionManagerConfig, prepareSettingsForSave, getSendGithubTokenOnSessionStart, setSendGithubTokenOnSessionStart, AgentApiType, getAgentApiType, setAgentApiType, EnterKeyBehavior, getEnterKeyBehavior, setEnterKeyBehavior, FontSettings as FontSettingsType, getFontSettings, setFontSettings, getMemoryEnabled, setMemoryEnabled, getMemorySummarizeDrafts, setMemorySummarizeDrafts } from '@/types/settings'
import { BedrockSettings, SettingsAccordion, GithubTokenSettings, MCPServerSettings, MarketplaceSettings, PluginSettings, KeyBindingSettings, ClaudeOAuthSettings, FontSettings, EnvVarsSettings, MemorySettings, SlackSettings, FileSettings } from '@/components/settings'
import { createAgentAPIProxyClientFromStorage, AgentAPIProxyError, CredentialsMetadata } from '@/lib/agentapi-proxy-client'
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
  const [isAuthError, setIsAuthError] = useState(false)
  const [sendGithubToken, setSendGithubToken] = useState(false)
  const [agentApiType, setAgentApiTypeState] = useState<AgentApiType>('default')
  const [enterKeyBehavior, setEnterKeyBehaviorState] = useState<EnterKeyBehavior>('send')
  const [fontSettings, setFontSettingsState] = useState<FontSettingsType>({ fontSize: 14, fontFamily: 'sans-serif' })
  const [memoryEnabled, setMemoryEnabledState] = useState(true)
  const [memorySummarizeDrafts, setMemorySummarizeDraftsState] = useState<boolean | undefined>(undefined)
  const [slackUserId, setSlackUserId] = useState<string>('')
  const [notificationChannels, setNotificationChannels] = useState<string[] | undefined>(undefined)
  const [esmList, setEsmList] = useState<ExternalSessionManagerConfig[]>([])
  const [newEsm, setNewEsm] = useState<{ name: string; url: string; default: boolean }>({ name: '', url: '', default: false })
  const [showAddEsm, setShowAddEsm] = useState(false)
  const [editingEsmIndex, setEditingEsmIndex] = useState<number | null>(null)
  const [editEsm, setEditEsm] = useState<{ name: string; url: string; default: boolean }>({ name: '', url: '', default: false })
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({})
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null)
  const [regeneratingEsmId, setRegeneratingEsmId] = useState<string | null>(null)
  // Credentials state
  const [credentialsMetadata, setCredentialsMetadata] = useState<CredentialsMetadata | null>(null)
  const [credentialsJson, setCredentialsJson] = useState<string>('')
  const [credentialsJsonError, setCredentialsJsonError] = useState<string | null>(null)
  const [uploadingCredentials, setUploadingCredentials] = useState(false)
  const [deletingCredentials, setDeletingCredentials] = useState(false)
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
        if (err instanceof AgentAPIProxyError && err.status === 401) {
          setIsAuthError(true)
          setError('認証が必要です。ログアウトして再度ログインしてください。')
        } else {
          setError('ユーザー情報の取得に失敗しました')
        }
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
        // Slack User ID を設定
        setSlackUserId(data.slack_user_id || '')
        setNotificationChannels(data.notification_channels)
        // External session managers を設定
        setEsmList(data.external_session_managers || [])

        // 認証ファイルメタデータを読み込み
        try {
          const meta = await client.getCredentials(userName)
          setCredentialsMetadata(meta)
        } catch {
          // credentials endpoint が存在しない場合は無視
        }
      } catch (err) {
        console.error('Failed to load personal settings:', err)
        if (err instanceof AgentAPIProxyError && err.status === 401) {
          setIsAuthError(true)
          setError('認証が必要です。ログアウトして再度ログインしてください。')
        } else {
          setError('Failed to load settings')
        }
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

  const handleSlackUserIdChange = (value: string) => {
    setSlackUserId(value)
    setSettings((prev) => ({ ...prev, slack_user_id: value }))
  }

  const handleNotificationChannelsChange = (channels: string[]) => {
    setNotificationChannels(channels)
    setSettings((prev) => ({ ...prev, notification_channels: channels }))
  }

  const handleAddEsm = () => {
    if (!newEsm.name.trim() || !newEsm.url.trim()) return
    // If new ESM is default, clear default from others
    const updatedList = newEsm.default
      ? esmList.map(e => ({ ...e, default: false }))
      : [...esmList]
    const updated = [...updatedList, { name: newEsm.name.trim(), url: newEsm.url.trim(), default: newEsm.default }]
    setEsmList(updated)
    setSettings((prev) => ({ ...prev, external_session_managers: updated }))
    setNewEsm({ name: '', url: '', default: false })
    setShowAddEsm(false)
  }

  const handleDeleteEsm = (index: number) => {
    const updated = esmList.filter((_, i) => i !== index)
    setEsmList(updated)
    setSettings((prev) => ({ ...prev, external_session_managers: updated }))
  }

  const handleToggleEsmDefault = (index: number) => {
    const updated = esmList.map((e, i) => ({ ...e, default: i === index ? !e.default : false }))
    setEsmList(updated)
    setSettings((prev) => ({ ...prev, external_session_managers: updated }))
  }

  const handleStartEditEsm = (index: number) => {
    const esm = esmList[index]
    setEditingEsmIndex(index)
    setEditEsm({ name: esm.name, url: esm.url, default: esm.default ?? false })
  }

  const handleSaveEditEsm = () => {
    if (editingEsmIndex === null) return
    if (!editEsm.name.trim() || !editEsm.url.trim()) return
    const updatedList = editEsm.default
      ? esmList.map((e, i) => ({ ...e, default: false }))
      : [...esmList]
    updatedList[editingEsmIndex] = {
      ...esmList[editingEsmIndex],
      name: editEsm.name.trim(),
      url: editEsm.url.trim(),
      default: editEsm.default,
    }
    setEsmList(updatedList)
    setSettings((prev) => ({ ...prev, external_session_managers: updatedList }))
    setEditingEsmIndex(null)
  }

  const handleCopySecret = async (id: string) => {
    const secret = revealedSecrets[id]
    if (!secret) return
    await navigator.clipboard.writeText(secret)
    setCopiedSecretId(id)
    setTimeout(() => setCopiedSecretId(null), 2000)
  }

  const generateHmacSecret = (): string => {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleRegenerateSecret = async (index: number) => {
    const esm = esmList[index]
    const newSecret = generateHmacSecret()
    const updatedList = esmList.map((e, i) =>
      i === index ? { ...e, hmac_secret: newSecret } : e
    )
    setEsmList(updatedList)
    const esmId = esm.id ?? `temp-${index}`
    setRegeneratingEsmId(esmId)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const preparedSettings = prepareSettingsForSave({
        ...settings,
        external_session_managers: updatedList,
      })
      const savedSettings = await client.saveSettings(userName, preparedSettings)
      setSettings(prev => ({ ...prev, external_session_managers: updatedList }))
      setOriginalSettings(prev => ({ ...prev, external_session_managers: updatedList }))
      if (savedSettings?.external_session_managers) {
        const secrets: Record<string, string> = {}
        for (const m of savedSettings.external_session_managers) {
          if (m.id && m.hmac_secret) {
            secrets[m.id] = m.hmac_secret
          }
        }
        if (Object.keys(secrets).length > 0) {
          setRevealedSecrets(prev => ({ ...prev, ...secrets }))
        }
      }
      showToast('シークレットを再生成しました', 'success')
    } catch (err) {
      console.error('Failed to regenerate secret:', err)
      showToast('再生成に失敗しました', 'error')
      setEsmList(esmList)
    } finally {
      setRegeneratingEsmId(null)
    }
  }

  // Credentials handlers
  const handleCredentialsJsonChange = (value: string) => {
    setCredentialsJson(value)
    setCredentialsJsonError(null)
    if (value.trim()) {
      try {
        JSON.parse(value)
      } catch {
        setCredentialsJsonError('有効な JSON を入力してください')
      }
    }
  }

  const handleCredentialsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCredentialsJson(text)
      setCredentialsJsonError(null)
      try {
        JSON.parse(text)
      } catch {
        setCredentialsJsonError('有効な JSON ファイルを選択してください')
      }
    }
    reader.readAsText(file)
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleUploadCredentials = async () => {
    if (!credentialsJson.trim() || credentialsJsonError) return
    setUploadingCredentials(true)
    try {
      const parsed = JSON.parse(credentialsJson)
      const client = createAgentAPIProxyClientFromStorage()
      const meta = await client.uploadCredentials(userName, parsed)
      setCredentialsMetadata(meta)
      setCredentialsJson('')
      showToast('auth.json をアップロードしました', 'success')
    } catch (err) {
      console.error('Failed to upload credentials:', err)
      showToast('アップロードに失敗しました', 'error')
    } finally {
      setUploadingCredentials(false)
    }
  }

  const handleDeleteCredentials = async () => {
    if (!confirm('auth.json を削除しますか？')) return
    setDeletingCredentials(true)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      await client.deleteCredentials(userName)
      setCredentialsMetadata(null)
      setCredentialsJson('')
      showToast('auth.json を削除しました', 'success')
    } catch (err) {
      console.error('Failed to delete credentials:', err)
      showToast('削除に失敗しました', 'error')
    } finally {
      setDeletingCredentials(false)
    }
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
      const savedSettings = await client.saveSettings(userName, preparedSettings)
      // 保存成功後、元の設定を更新
      setOriginalSettings(settings)
      // PUT レスポンスに含まれるフルの HMAC シークレットをキャプチャ
      if (savedSettings?.external_session_managers) {
        const secrets: Record<string, string> = {}
        for (const m of savedSettings.external_session_managers) {
          if (m.id && m.hmac_secret) {
            secrets[m.id] = m.hmac_secret
          }
        }
        if (Object.keys(secrets).length > 0) {
          setRevealedSecrets(prev => ({ ...prev, ...secrets }))
        }
      }
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
          {isAuthError && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-3 inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
            >
              {loggingOut ? 'ログアウト中...' : 'ログアウト'}
            </button>
          )}
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
                      { value: 'claude-acp', label: 'Claude ACP', description: 'agent_type=claude-acp を送信' },
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
            title="セッションマネージャー"
            description="外部セッションマネージャーの設定"
            defaultOpen={false}
          >
            <div className="space-y-4">
              {esmList.length === 0 && !showAddEsm && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  外部セッションマネージャーが登録されていません
                </p>
              )}
              {esmList.map((esm, index) => (
                <div key={esm.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {editingEsmIndex === index ? (
                    /* 編集フォーム */
                    <div className="p-3 space-y-3 bg-blue-50 dark:bg-blue-900/10">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">名前</label>
                        <input
                          type="text"
                          value={editEsm.name}
                          onChange={(e) => setEditEsm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                        <input
                          type="url"
                          value={editEsm.url}
                          onChange={(e) => setEditEsm(prev => ({ ...prev, url: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEsm.default}
                          onChange={(e) => setEditEsm(prev => ({ ...prev, default: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">デフォルトに設定する</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEditEsm}
                          disabled={!editEsm.name.trim() || !editEsm.url.trim()}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          更新
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEsmIndex(null)}
                          className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 通常表示 */
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{esm.name}</span>
                          {esm.default && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">デフォルト</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">{esm.url}</span>
                        {/* HMAC シークレット表示 */}
                        {esm.id && revealedSecrets[esm.id] ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <code className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[180px]">
                              {revealedSecrets[esm.id]}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopySecret(esm.id!)}
                              className="flex-shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                              title="シークレットをコピー"
                            >
                              {copiedSecretId === esm.id ? (
                                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : esm.hmac_secret ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1 block">
                            {esm.hmac_secret /* hint like ****xxxx */}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditEsm(index)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSecret(index)}
                          disabled={regeneratingEsmId === (esm.id ?? `temp-${index}`)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-yellow-300 dark:hover:border-yellow-700 hover:text-yellow-600 dark:hover:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="HMACシークレットを再生成して保存"
                        >
                          {regeneratingEsmId === (esm.id ?? `temp-${index}`) ? (
                            <span className="inline-flex items-center gap-1">
                              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                              再生成中
                            </span>
                          ) : '再生成'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleEsmDefault(index)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            esm.default
                              ? 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-700'
                          }`}
                          title={esm.default ? 'デフォルトを解除' : 'デフォルトに設定'}
                        >
                          {esm.default ? '★' : '☆'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEsm(index)}
                          className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {showAddEsm ? (
                <div className="p-3 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3 bg-blue-50 dark:bg-blue-900/10">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">名前</label>
                    <input
                      type="text"
                      value={newEsm.name}
                      onChange={(e) => setNewEsm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="例: 開発環境"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                    <input
                      type="url"
                      value={newEsm.url}
                      onChange={(e) => setNewEsm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://agentapi.example.com"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEsm.default}
                      onChange={(e) => setNewEsm(prev => ({ ...prev, default: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">デフォルトマネージャーに設定する（manager_id 未指定時に自動使用）</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddEsm}
                      disabled={!newEsm.name.trim() || !newEsm.url.trim()}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      追加
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddEsm(false); setNewEsm({ name: '', url: '', default: false }) }}
                      className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddEsm(true)}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  マネージャーを追加
                </button>
              )}
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="認証ファイル (auth.json)"
            description="Codex の auth.json をアップロードします。セッション開始時に自動で適用されます。"
          >
            <div className="space-y-4">
              {/* codex auth.json の説明 */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>codex の認証ファイル</strong>について: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">~/.codex/auth.json</code> は Codex が使用する認証情報ファイルです。ここにアップロードすると、エージェントセッション開始時に自動で適用されます。
                </p>
              </div>
              {/* 現在のステータス */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  {credentialsMetadata?.has_data ? (
                    <>
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        auth.json がアップロード済みです
                        {credentialsMetadata.updated_at && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                            (更新: {new Date(credentialsMetadata.updated_at).toLocaleString()})
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-sm text-gray-500 dark:text-gray-400">auth.json が未設定です</span>
                    </>
                  )}
                </div>
                {credentialsMetadata?.has_data && (
                  <button
                    type="button"
                    onClick={handleDeleteCredentials}
                    disabled={deletingCredentials}
                    className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletingCredentials ? '削除中...' : '削除'}
                  </button>
                )}
              </div>

              {/* ファイルアップロード */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ファイルを選択 (~/.codex/auth.json)
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleCredentialsFileChange}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-3 file:py-1.5 file:px-3
                    file:rounded file:border file:border-gray-300 dark:file:border-gray-600
                    file:text-xs file:font-medium
                    file:bg-white dark:file:bg-gray-700
                    file:text-gray-700 dark:file:text-gray-300
                    file:cursor-pointer
                    hover:file:bg-gray-50 dark:hover:file:bg-gray-600"
                />
              </div>

              {/* テキスト入力 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  または JSON を直接貼り付け
                </label>
                <textarea
                  value={credentialsJson}
                  onChange={(e) => handleCredentialsJsonChange(e.target.value)}
                  placeholder=""
                  rows={6}
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
                {credentialsJsonError && (
                  <p className="mt-1 text-xs text-red-500">{credentialsJsonError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleUploadCredentials}
                disabled={!credentialsJson.trim() || !!credentialsJsonError || uploadingCredentials}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {uploadingCredentials && (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                )}
                {uploadingCredentials ? 'アップロード中...' : 'アップロード'}
              </button>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="セッションファイル"
            description="SSH 鍵などのファイルをセッション起動時に自動配置します"
          >
            <FileSettings userName={userName} />
          </SettingsAccordion>

          <SettingsAccordion
            title="通知設定"
            description="通知チャネルの設定"
            defaultOpen
          >
            <SlackSettings
              slackUserId={slackUserId}
              notificationChannels={notificationChannels}
              onSlackUserIdChange={handleSlackUserIdChange}
              onChannelsChange={handleNotificationChannelsChange}
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
