'use client'

import { useState, useEffect } from 'react'
import { SettingsData, RunbookRepositoryConfig, BedrockConfig } from '@/types/settings'
import { RunbookSettings, BedrockSettings, SettingsAccordion } from '@/components/settings'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'

interface UserInfo {
  type: 'github' | 'api_key'
  user?: {
    id?: number
    login?: string
    name?: string
    email?: string
    avatar_url?: string
    authenticated?: boolean
  }
}

export default function PersonalSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({})
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Get user info from API
        const userInfoResponse = await fetch('/api/user/info')
        if (userInfoResponse.ok) {
          const userInfo: UserInfo = await userInfoResponse.json()
          if (userInfo.type === 'github' && userInfo.user?.login) {
            setUserName(userInfo.user.login)
          } else {
            // Fallback for API key authentication
            setUserName('default-user')
          }
        } else {
          setUserName('default-user')
        }
      } catch (err) {
        console.error('Failed to get user info:', err)
        setUserName('default-user')
      }
    }

    loadSettings()
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

  const handleRunbookChange = (config: RunbookRepositoryConfig) => {
    setSettings((prev) => ({ ...prev, runbook: config }))
  }

  const handleBedrockChange = (config: BedrockConfig) => {
    setSettings((prev) => ({ ...prev, bedrock: config }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const client = createAgentAPIProxyClientFromStorage()
      await client.saveSettings(userName, settings)
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
          {userName && userName !== 'default-user' && (
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

      <SettingsAccordion
        title="Runbook Repository"
        description="Configure the repository containing your runbooks"
        defaultOpen
      >
        <RunbookSettings config={settings.runbook} onChange={handleRunbookChange} />
      </SettingsAccordion>

      <SettingsAccordion
        title="AI Settings"
        description="Configure AI providers and models"
        defaultOpen
      >
        <BedrockSettings config={settings.bedrock} onChange={handleBedrockChange} />
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
    </div>
  )
}
