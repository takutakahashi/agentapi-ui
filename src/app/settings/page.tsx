'use client'

import { useState, useEffect, useCallback } from 'react'
import { loadFullGlobalSettings, saveFullGlobalSettings, GlobalSettings } from '../../types/settings'
import { OneClickPushNotifications } from '../components/OneClickPushNotifications'

export default function GlobalSettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null)

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    const globalSettings = loadFullGlobalSettings()
    setSettings(globalSettings)
  }, [])

  const saveSettings = useCallback(async () => {
    if (!settings) return

    try {
      setLoading(true)
      setError(null)

      saveFullGlobalSettings(settings)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save global settings')
    } finally {
      setLoading(false)
    }
  }, [settings])

  if (!settings) {
    return (
      <main className="min-h-dvh bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            Configure global settings for AgentAPI UI
          </p>
        </div>

        <div className="space-y-8">
          {/* AgentAPI Proxy Settings */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              AgentAPI Proxy Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={settings.agentApiProxy.endpoint}
                  onChange={(e) => setSettings(prev => prev ? ({
                    ...prev,
                    agentApiProxy: { ...prev.agentApiProxy, endpoint: e.target.value }
                  }) : null)}
                  placeholder="http://localhost:8080"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key (optional)
                </label>
                <input
                  type="password"
                  value={settings.agentApiProxy.apiKey || ''}
                  onChange={(e) => setSettings(prev => prev ? ({
                    ...prev,
                    agentApiProxy: { ...prev.agentApiProxy, apiKey: e.target.value }
                  }) : null)}
                  placeholder="Enter API key if required"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Push Notification Settings */}
          <OneClickPushNotifications />


          {/* Action Buttons */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-4">
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  Settings saved successfully
                </span>
              )}
              {error && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </span>
              )}
            </div>

            <button
              onClick={saveSettings}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
