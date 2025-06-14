'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SettingsFormData, loadRepositorySettings, saveRepositorySettings } from '../../../types/settings'
import type { AgentApiSettings, AgentApiProxySettings, EnvironmentVariable } from '../../../types/settings'

export default function SettingsPage() {
  const params = useParams()
  const repoFullname = params.repo_fullname as string
  
  const [settings, setSettings] = useState<SettingsFormData>(loadRepositorySettings(repoFullname))
  
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const loadSettings = useCallback(() => {
    try {
      const repoSettings = loadRepositorySettings(repoFullname)
      setSettings(repoSettings)
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }, [repoFullname])

  // Load saved settings on component mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      saveRepositorySettings(repoFullname, settings)
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000) // Clear saved message after 3 seconds
    } catch {
      setError('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const updateAgentApiSetting = (key: keyof AgentApiSettings, value: string | number | Record<string, string>) => {
    setSettings(prev => ({
      ...prev,
      agentApi: {
        ...prev.agentApi,
        [key]: value
      }
    }))
  }

  const updateAgentApiProxySetting = (key: keyof AgentApiProxySettings, value: string | number | boolean | { username: string; password: string } | undefined) => {
    setSettings(prev => ({
      ...prev,
      agentApiProxy: {
        ...prev.agentApiProxy,
        [key]: value
      }
    }))
  }

  const addEnvironmentVariable = () => {
    setSettings(prev => ({
      ...prev,
      environmentVariables: [
        ...prev.environmentVariables,
        { key: '', value: '', description: '' }
      ]
    }))
  }

  const updateEnvironmentVariable = (index: number, field: keyof EnvironmentVariable, value: string) => {
    setSettings(prev => ({
      ...prev,
      environmentVariables: prev.environmentVariables.map((env, i) => 
        i === index ? { ...env, [field]: value } : env
      )
    }))
  }

  const removeEnvironmentVariable = (index: number) => {
    setSettings(prev => ({
      ...prev,
      environmentVariables: prev.environmentVariables.filter((_, i) => i !== index)
    }))
  }

  const addCustomHeader = () => {
    const key = prompt('Enter header name:')
    if (key && key.trim()) {
      updateAgentApiSetting('customHeaders', {
        ...settings.agentApi.customHeaders,
        [key.trim()]: ''
      })
    }
  }

  const updateCustomHeader = (key: string, value: string) => {
    updateAgentApiSetting('customHeaders', {
      ...settings.agentApi.customHeaders,
      [key]: value
    })
  }

  const removeCustomHeader = (key: string) => {
    const newHeaders = { ...settings.agentApi.customHeaders }
    delete newHeaders[key]
    updateAgentApiSetting('customHeaders', newHeaders)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            Repository: <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{repoFullname}</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Configure AgentAPI settings and environment variables for this repository
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Repository settings override global defaults. 
            <Link href="/settings" className="text-blue-600 dark:text-blue-400 hover:underline ml-1">
              Edit global settings
            </Link>
          </p>
        </div>

        <div className="space-y-8">
          {/* AgentAPI Configuration */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              AgentAPI Configuration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Endpoint
                </label>
                <input
                  type="url"
                  value={settings.agentApi.endpoint}
                  onChange={(e) => updateAgentApiSetting('endpoint', e.target.value)}
                  placeholder="http://localhost:8080"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.agentApi.apiKey}
                  onChange={(e) => updateAgentApiSetting('apiKey', e.target.value)}
                  placeholder="Enter your API key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Request Timeout (ms)
                </label>
                <input
                  type="number"
                  value={settings.agentApi.timeout}
                  onChange={(e) => updateAgentApiSetting('timeout', parseInt(e.target.value) || 30000)}
                  min="1000"
                  max="300000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Custom Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Custom Headers
                  </label>
                  <button
                    onClick={addCustomHeader}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    + Add Header
                  </button>
                </div>
                
                {Object.entries(settings.agentApi.customHeaders).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No custom headers configured
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(settings.agentApi.customHeaders).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300 min-w-0 flex-shrink-0">
                          {key}:
                        </span>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateCustomHeader(key, e.target.value)}
                          placeholder="Header value"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <button
                          onClick={() => removeCustomHeader(key)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AgentAPI Proxy Configuration */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              AgentAPI Proxy Configuration
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Configure the AgentAPI proxy for session management and routing. Repository settings override global proxy settings.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="proxy-enabled"
                  checked={settings.agentApiProxy.enabled}
                  onChange={(e) => updateAgentApiProxySetting('enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="proxy-enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable AgentAPI Proxy
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Proxy Endpoint
                </label>
                <input
                  type="url"
                  value={settings.agentApiProxy.endpoint}
                  onChange={(e) => updateAgentApiProxySetting('endpoint', e.target.value)}
                  placeholder="http://localhost:8080"
                  disabled={!settings.agentApiProxy.enabled}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Proxy Request Timeout (ms)
                </label>
                <input
                  type="number"
                  value={settings.agentApiProxy.timeout}
                  onChange={(e) => updateAgentApiProxySetting('timeout', parseInt(e.target.value) || 30000)}
                  min="1000"
                  max="300000"
                  disabled={!settings.agentApiProxy.enabled}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                />
              </div>

              {/* Basic Auth Configuration */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Basic Authentication (Optional)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Configure Basic Auth credentials to authenticate with the proxy server.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={settings.agentApiProxy.basicAuth?.username || ''}
                      onChange={(e) => {
                        const username = e.target.value;
                        const password = settings.agentApiProxy.basicAuth?.password || '';
                        updateAgentApiProxySetting('basicAuth', 
                          username || password ? { username, password } : undefined
                        );
                      }}
                      placeholder="Enter username"
                      disabled={!settings.agentApiProxy.enabled}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={settings.agentApiProxy.basicAuth?.password || ''}
                      onChange={(e) => {
                        const password = e.target.value;
                        const username = settings.agentApiProxy.basicAuth?.username || '';
                        updateAgentApiProxySetting('basicAuth', 
                          username || password ? { username, password } : undefined
                        );
                      }}
                      placeholder="Enter password"
                      disabled={!settings.agentApiProxy.enabled}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                
                {settings.agentApiProxy.basicAuth?.username || settings.agentApiProxy.basicAuth?.password ? (
                  <button
                    onClick={() => updateAgentApiProxySetting('basicAuth', undefined)}
                    disabled={!settings.agentApiProxy.enabled}
                    className="mt-3 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear Basic Auth Credentials
                  </button>
                ) : null}
              </div>
            </div>
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

          {/* Action Buttons */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-4">
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  ✓ Settings saved successfully
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