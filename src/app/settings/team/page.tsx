'use client'

import { useState, useEffect, useCallback } from 'react'
import { SettingsData, BedrockConfig, APIMCPServerConfig, MarketplaceConfig, prepareSettingsForSave } from '@/types/settings'
import { BedrockSettings, SettingsAccordion, MCPServerSettings, MarketplaceSettings, PluginSettings } from '@/components/settings'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'

export default function TeamSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({})
  const [teamName, setTeamName] = useState('')
  const [availableTeams, setAvailableTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isTeamLoaded, setIsTeamLoaded] = useState(false)
  const { showToast } = useToast()

  const loadTeamSettings = useCallback(async (name: string) => {
    if (!name.trim()) return

    setLoading(true)
    setError(null)

    try {
      const client = createAgentAPIProxyClientFromStorage()
      const data = await client.getSettings(name)
      setSettings(data)
      setTeamName(name)
      setIsTeamLoaded(true)
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
      await client.saveSettings(teamName, preparedSettings)
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
            <BedrockSettings config={settings.bedrock} onChange={handleBedrockChange} showCredentials />
          </SettingsAccordion>

          <SettingsAccordion
            title="MCP Servers"
            description="Configure Model Context Protocol servers for the team"
            defaultOpen
          >
            <MCPServerSettings servers={settings.mcp_servers} onChange={handleMCPServersChange} />
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
