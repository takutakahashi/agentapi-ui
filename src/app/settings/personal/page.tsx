'use client'

import { useState, useEffect } from 'react'
import { SettingsData, BedrockConfig, APIMCPServerConfig, MarketplaceConfig, prepareSettingsForSave, getSendGithubTokenOnSessionStart, setSendGithubTokenOnSessionStart } from '@/types/settings'
import { BedrockSettings, SettingsAccordion, GithubTokenSettings, ExperimentalSettings, MCPServerSettings, MarketplaceSettings } from '@/components/settings'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'

export default function PersonalSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({})
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDebugMode, setIsDebugMode] = useState(false)
  const [sendGithubToken, setSendGithubToken] = useState(false)
  const { showToast } = useToast()

  // デバッグモードの判定と GitHub Token 設定の読み込み
  useEffect(() => {
    if (process.env.AGENTAPI_DEBUG === 'true') {
      setIsDebugMode(true)
    } else {
      const debugFlag = localStorage.getItem('agentapi_debug')
      setIsDebugMode(debugFlag === 'true')
    }
    // GitHub Token 設定を読み込み
    setSendGithubToken(getSendGithubTokenOnSessionStart())
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

  const handleBedrockChange = (config: BedrockConfig) => {
    setSettings((prev) => ({ ...prev, bedrock: config }))
  }

  const handleMCPServersChange = (servers: Record<string, APIMCPServerConfig>) => {
    setSettings((prev) => ({ ...prev, mcp_servers: servers }))
  }

  const handleGithubTokenChange = (enabled: boolean) => {
    setSendGithubToken(enabled)
    setSendGithubTokenOnSessionStart(enabled)
  }

  const handleExperimentalChange = (enabled: boolean) => {
    setIsDebugMode(enabled)
    if (enabled) {
      localStorage.setItem('agentapi_debug', 'true')
    } else {
      localStorage.removeItem('agentapi_debug')
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
            description="Configure plugin marketplaces (Experimental)"
            defaultOpen
          >
            <MarketplaceSettings marketplaces={settings.marketplaces} onChange={handleMarketplacesChange} disabled={!isDebugMode} />
          </SettingsAccordion>

          <SettingsAccordion
            title="AI Settings"
            description="Configure AI providers and models"
            defaultOpen
          >
            <BedrockSettings config={settings.bedrock} onChange={handleBedrockChange} />
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
            <GithubTokenSettings enabled={sendGithubToken} onChange={handleGithubTokenChange} />
          </SettingsAccordion>

          <SettingsAccordion
            title="Experimental"
            description="Enable experimental features"
            defaultOpen
          >
            <ExperimentalSettings enabled={isDebugMode} onChange={handleExperimentalChange} />
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
