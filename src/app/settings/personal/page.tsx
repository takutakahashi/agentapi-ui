'use client'

import { useState, useEffect } from 'react'
import { SettingsData, RunbookRepositoryConfig, BedrockConfig } from '@/types/settings'
import { RunbookSettings, BedrockSettings, SettingsAccordion } from '@/components/settings'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'

export default function PersonalSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({})
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      // TODO: Get user name from context or auth
      const name = 'default-user'
      setUserName(name)

      try {
        const client = createAgentAPIProxyClientFromStorage()
        const data = await client.getSettings(name)
        setSettings(data)
      } catch (err) {
        console.error('Failed to load personal settings:', err)
        setError('設定の読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleRunbookChange = (config: RunbookRepositoryConfig) => {
    setSettings((prev) => ({ ...prev, runbook: config }))
    setSuccess(false)
  }

  const handleBedrockChange = (config: BedrockConfig) => {
    setSettings((prev) => ({ ...prev, bedrock: config }))
    setSuccess(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const client = createAgentAPIProxyClientFromStorage()
      await client.saveSettings(userName, settings)
      setSuccess(true)
    } catch (err) {
      console.error('Failed to save personal settings:', err)
      setError('設定の保存に失敗しました')
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
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-600 dark:text-green-400">Settings saved successfully!</p>
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
