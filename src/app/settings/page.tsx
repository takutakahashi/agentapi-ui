'use client'

import { useState, useEffect, useCallback } from 'react'
import { loadFullGlobalSettings, saveFullGlobalSettings, GlobalSettings } from '../../types/settings'
import type { EnvironmentVariable } from '../../types/settings'
import BedrockSettingsComponent from '../../components/BedrockSettings'
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


  const addEnvironmentVariable = () => {
    if (!settings) return
    setSettings(prev => prev ? ({
      ...prev,
      environmentVariables: [
        ...prev.environmentVariables,
        { key: '', value: '', description: '' }
      ]
    }) : null)
  }

  const updateEnvironmentVariable = (index: number, field: keyof EnvironmentVariable, value: string) => {
    if (!settings) return
    setSettings(prev => prev ? ({
      ...prev,
      environmentVariables: prev.environmentVariables.map((env, i) =>
        i === index ? { ...env, [field]: value } : env
      )
    }) : null)
  }

  const removeEnvironmentVariable = (index: number) => {
    if (!settings) return
    setSettings(prev => prev ? ({
      ...prev,
      environmentVariables: prev.environmentVariables.filter((_, i) => i !== index)
    }) : null)
  }

  const addFixedOrganization = () => {
    if (!settings) return
    setSettings(prev => prev ? ({
      ...prev,
      fixedOrganizations: [...prev.fixedOrganizations, '']
    }) : null)
  }

  const updateFixedOrganization = (index: number, value: string) => {
    if (!settings) return
    setSettings(prev => prev ? ({
      ...prev,
      fixedOrganizations: prev.fixedOrganizations.map((org, i) =>
        i === index ? value : org
      )
    }) : null)
  }

  const removeFixedOrganization = (index: number) => {
    if (!settings) return
    setSettings(prev => prev ? ({
      ...prev,
      fixedOrganizations: prev.fixedOrganizations.filter((_, i) => i !== index)
    }) : null)
  }

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

          {/* Fixed Organizations */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Fixed Organizations
              </h2>
              <button
                onClick={addFixedOrganization}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                + Add Organization
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Organizations that will be available for selection when creating new sessions.
            </p>

            {settings.fixedOrganizations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No fixed organizations configured. Users can enter any repository.
              </p>
            ) : (
              <div className="space-y-2">
                {settings.fixedOrganizations.map((org, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={org}
                      onChange={(e) => updateFixedOrganization(index, e.target.value)}
                      placeholder="organization-name"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => removeFixedOrganization(index)}
                      className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Environment Variables */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Environment Variables
              </h2>
              <button
                onClick={addEnvironmentVariable}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                + Add Variable
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Environment variables to be passed to agent sessions.
            </p>

            {settings.environmentVariables.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No environment variables configured
              </p>
            ) : (
              <div className="space-y-4">
                {settings.environmentVariables.map((env, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-md p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Variable Name
                        </label>
                        <input
                          type="text"
                          value={env.key}
                          onChange={(e) => updateEnvironmentVariable(index, 'key', e.target.value)}
                          placeholder="VARIABLE_NAME"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Value
                        </label>
                        <input
                          type="text"
                          value={env.value}
                          onChange={(e) => updateEnvironmentVariable(index, 'value', e.target.value)}
                          placeholder="variable value"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description (optional)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={env.description || ''}
                          onChange={(e) => updateEnvironmentVariable(index, 'description', e.target.value)}
                          placeholder="Describe what this variable is used for"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => removeEnvironmentVariable(index)}
                          className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Amazon Bedrock Settings */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <BedrockSettingsComponent
              settings={settings.bedrockSettings || { enabled: false }}
              onChange={(bedrockSettings) => setSettings(prev => prev ? ({ ...prev, bedrockSettings }) : null)}
              title="Amazon Bedrock Settings"
              description="Configure Amazon Bedrock provider settings for Claude API access."
            />
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
