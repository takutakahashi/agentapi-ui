'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { SettingsData, BedrockConfig, APIMCPServerConfig, MarketplaceConfig, ExternalSessionManagerConfig, prepareSettingsForSave } from '@/types/settings'
import { BedrockSettings, SettingsAccordion, MCPServerSettings, MarketplaceSettings, PluginSettings, EnvVarsSettings, CodexDeviceAuthSettings, ESMRegistrationToken } from '@/components/settings'
import { createAgentAPIProxyClientFromStorage, CredentialsMetadata } from '@/lib/agentapi-proxy-client'
import ApiTokensSection from '@/app/components/ApiTokensSection'
import { useToast } from '@/contexts/ToastContext'

export default function TeamSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({})
  const [originalSettings, setOriginalSettings] = useState<SettingsData>({})
  const [teamName, setTeamName] = useState('')
  const [availableTeams, setAvailableTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isTeamLoaded, setIsTeamLoaded] = useState(false)
  const [credentialsMetadata, setCredentialsMetadata] = useState<CredentialsMetadata | null>(null)
  const [esmList, setEsmList] = useState<ExternalSessionManagerConfig[]>([])
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

  const loadTeamSettings = useCallback(async (name: string) => {
    if (!name.trim()) return

    setLoading(true)
    setError(null)

    try {
      const client = createAgentAPIProxyClientFromStorage()
      const data = await client.getSettings(name)
      setSettings(data)
      setOriginalSettings(data)
      setEsmList(data.external_session_managers || [])
      setTeamName(name)
      setIsTeamLoaded(true)

      try {
        setCredentialsMetadata(await client.getCredentials(name))
      } catch {
        setCredentialsMetadata(null)
      }

    } catch (err) {
      console.error('Failed to load team settings:', err)
      setError('Failed to load team settings. The team may not exist or you may not have permission.')
      setIsTeamLoaded(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load teams from user info
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const client = createAgentAPIProxyClientFromStorage()
        const proxyUserInfo = await client.getUserInfo()
        const teams = proxyUserInfo?.teams || []

        if (!Array.isArray(teams) || teams.length === 0) {
          setError('所属しているチームがありません')
          setLoading(false)
          return
        }

        setAvailableTeams(teams)

        // If only one team, auto-select it
        if (teams.length === 1) {
          loadTeamSettings(teams[0])
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to get user info:', err)
        setError('ユーザー情報の取得に失敗しました')
        setLoading(false)
      }
    }

    loadUserInfo()
  }, [loadTeamSettings])

  const handleTeamSelect = (selectedTeam: string) => {
    if (selectedTeam) {
      loadTeamSettings(selectedTeam)
    }
  }

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

  const updateEsmList = (managers: ExternalSessionManagerConfig[]) => {
    setEsmList(managers)
    setSettings((prev) => ({ ...prev, external_session_managers: managers }))
  }

  const handleToggleAutomaticAssignment = (index: number) => {
    updateEsmList(esmList.map((manager, current) => ({
      ...manager,
      automatic_assignment_enabled: current === index ? !manager.automatic_assignment_enabled : manager.automatic_assignment_enabled,
    })))
  }

  const handleTogglePool = (index: number) => {
    updateEsmList(esmList.map((manager, current) => ({
      ...manager,
      pool_enabled: current === index ? !manager.pool_enabled : manager.pool_enabled,
    })))
  }

  const handlePoolNameChange = (index: number, pool: string) => {
    updateEsmList(esmList.map((manager, current) => ({
      ...manager,
      pool: current === index ? pool : manager.pool,
    })))
  }

  const handleSave = async () => {
    if (!teamName) {
      setError('Please select a team first')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const client = createAgentAPIProxyClientFromStorage()
      // 空の値を除外して保存
      const preparedSettings = prepareSettingsForSave(settings)
      const savedSettings = await client.saveSettings(teamName, preparedSettings)
      // 保存成功後、元の設定を更新
      setSettings(savedSettings)
      setOriginalSettings(savedSettings)
      setEsmList(savedSettings.external_session_managers || [])
      showToast('Team settings saved successfully!', 'success')
    } catch (err) {
      console.error('Failed to save team settings:', err)
      setError('Failed to save settings')
      showToast('Failed to save team settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Team Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure settings for your team
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
          Team Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure settings for your team
          {teamName && (
            <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">
              ({teamName})
            </span>
          )}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Team Selection - only show if multiple teams */}
      {availableTeams.length > 1 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Select Team
          </h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <select
                value={teamName}
                onChange={(e) => handleTeamSelect(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">チームを選択してください</option>
                {availableTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {teamName && isTeamLoaded && (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Team loaded: {teamName}</span>
            </div>
          )}
        </div>
      )}

      {isTeamLoaded && (
        <>
          <ApiTokensSection scope="team" teamId={teamName} defaultOpen={false} />

          <SettingsAccordion
            title="Codex Authentication"
            description="Register a shared Codex auth.json for the team"
            defaultOpen={false}
          >
            <CodexDeviceAuthSettings
              scope="team"
              teamId={teamName}
              hasCredentials={!!credentialsMetadata?.has_data}
              onAuthComplete={async () => {
                const client = createAgentAPIProxyClientFromStorage()
                setCredentialsMetadata(await client.getCredentials(teamName))
                showToast('チームの Codex 認証情報を保存しました', 'success')
              }}
            />
          </SettingsAccordion>

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
            title="Default Agent Type"
            description="Choose the agent used when a team session does not specify one"
            defaultOpen={false}
          >
            <select
              value={settings.default_agent_type || 'auto'}
              onChange={(e) => setSettings((prev) => ({
                ...prev,
                default_agent_type: e.target.value as NonNullable<SettingsData['default_agent_type']>,
              }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="auto">自動選択</option>
              <option value="claude-acp">Claude ACP</option>
              <option value="codex-acp">Codex ACP</option>
              <option value="pi-ollama">Pi Ollama</option>
              <option value="cursor">Cursor ACP</option>
            </select>
          </SettingsAccordion>

          <SettingsAccordion
            title="AI Settings"
            description="Configure AI providers and models"
            defaultOpen
          >
            <BedrockSettings config={settings.bedrock} onChange={handleBedrockChange} showCredentials />
          </SettingsAccordion>

          <SettingsAccordion
            title="MCP Servers"
            description="Configure Model Context Protocol servers for the team"
            defaultOpen
          >
            <MCPServerSettings servers={settings.mcp_servers} onChange={handleMCPServersChange} />
          </SettingsAccordion>

          <SettingsAccordion
            title="GitHub App Authentication"
            description="Configure the GitHub App installation used by team sessions"
            defaultOpen={false}
          >
            <div className="space-y-2">
              <label htmlFor="github-app-installation-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Installation ID
              </label>
              <input
                id="github-app-installation-id"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={settings.github_app_installation_id || ''}
                onChange={(e) => setSettings((prev) => ({
                  ...prev,
                  github_app_installation_id: e.target.value,
                }))}
                placeholder="12345678"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Team session の開始時に、この installation 用の短期 token を生成して GITHUB_TOKEN に設定します。
              </p>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Environment Variables"
            description="Configure custom environment variables for team sessions"
            defaultOpen
          >
            <EnvVarsSettings envVarKeys={settings.env_var_keys} onChange={handleEnvVarsChange} />
          </SettingsAccordion>

          <SettingsAccordion
            title="セッションマネージャー"
            description="チームで共有する External Session Manager を登録します"
            defaultOpen={false}
          >
            <div className="space-y-4">
              <ESMRegistrationToken scope="team" teamId={teamName} />
              {esmList.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">チームの External Session Manager は登録されていません</p>
              )}
              {esmList.map((manager, index) => (
                <div key={manager.id || index} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{manager.name}</span>
                        {manager.pool_enabled && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Pool 有効</span>}
                        {manager.automatic_assignment_enabled && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">自動割り当て ON</span>}
                        {manager.pool && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Pool: {manager.pool}</span>}
                        {manager.has_connection_token && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">token 設定済み</span>}
                      </div>
                      <label className="mt-2 block text-xs text-gray-500 dark:text-gray-400">
                        Pool 名
                        <input
                          type="text"
                          required
                          value={manager.pool ?? ''}
                          onChange={(event) => handlePoolNameChange(index, event.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </label>
                    </div>
                    <button type="button" onClick={() => handleTogglePool(index)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
					  {manager.pool_enabled ? 'Pool を無効化' : 'Pool を有効化'}
                    </button>
                    <button type="button" onClick={() => handleToggleAutomaticAssignment(index)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
					  {manager.automatic_assignment_enabled ? '自動割り当てを停止' : '自動割り当てを有効化'}
                    </button>
                    <button type="button" onClick={() => updateEsmList(esmList.filter((_, current) => current !== index))} className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 dark:border-red-700 dark:text-red-400">
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
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

      {!isTeamLoaded && availableTeams.length > 1 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Team Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Select a team from the dropdown above to configure team settings.
          </p>
        </div>
      )}
    </div>
  )
}
