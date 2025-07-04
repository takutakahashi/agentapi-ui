'use client'

import { useState, useEffect, useCallback } from 'react'
import { SettingsFormData, loadGlobalSettings, saveGlobalSettings, isSingleProfileModeEnabled } from '../../types/settings'
import type { EnvironmentVariable } from '../../types/settings'
import type { EncryptedData } from '../../lib/encryption'
import MCPServerSettings from '../../components/MCPServerSettings'

export default function GlobalSettingsPage() {
  const [settings, setSettings] = useState<SettingsFormData>(loadGlobalSettings())
  const [, setEncryptedData] = useState<EncryptedData | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const isSingleProfile = isSingleProfileModeEnabled()
  
  const loadSettings = useCallback(() => {
    try {
      const globalSettings = loadGlobalSettings()
      setSettings(globalSettings)
      
      // Load encrypted data if in single profile mode
      if (isSingleProfile && typeof window !== 'undefined') {
        const storedEncrypted = localStorage.getItem('agentapi-encrypted-config')
        if (storedEncrypted) {
          setEncryptedData(JSON.parse(storedEncrypted))
        }
      }
    } catch (err) {
      console.error('Failed to load global settings:', err)
    }
  }, [isSingleProfile])

  // Load saved settings on component mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Save unencrypted settings to localStorage
      saveGlobalSettings(settings)
      
      // If in single profile mode, also encrypt and save
      if (isSingleProfile) {
        try {
          // Get API token hash
          const apiTokenResponse = await fetch('/api/auth/status')
          if (!apiTokenResponse.ok) {
            throw new Error('Not authenticated')
          }
          const { tokenHash } = await apiTokenResponse.json()
          
          // Encrypt the settings
          const encryptResponse = await fetch('/api/encrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: {
                baseUrl: process.env.NEXT_PUBLIC_AGENTAPI_PROXY_URL || 'http://localhost:8080',
                mcpServers: settings.mcpServers,
                environmentVariables: settings.environmentVariables.reduce((acc, env) => {
                  if (env.key) acc[env.key] = env.value
                  return acc
                }, {} as Record<string, string>)
              },
              apiTokenHash: tokenHash
            })
          })
          
          if (!encryptResponse.ok) {
            throw new Error('Failed to encrypt settings')
          }
          
          const encrypted = await encryptResponse.json()
          setEncryptedData(encrypted)
          
          // Store encrypted data in localStorage
          localStorage.setItem('agentapi-encrypted-config', JSON.stringify(encrypted))
        } catch (encryptError) {
          console.error('Failed to encrypt settings:', encryptError)
          // Continue with success even if encryption fails
        }
      }
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000) // Clear saved message after 3 seconds
    } catch {
      setError('Failed to save global settings')
    } finally {
      setLoading(false)
    }
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


  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Global Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            Configure global environment variables
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            These settings will be used as defaults for all repositories and profiles. Individual repository settings can override these values.
          </p>
        </div>

        <div className="space-y-8">
          {/* Environment Variables */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Global Environment Variables
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
                No default environment variables configured
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

          {/* MCP Servers Section */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <MCPServerSettings
              mcpServers={settings.mcpServers || []}
              onChange={(mcpServers) => setSettings(prev => ({ ...prev, mcpServers }))}
              title="Global MCP Servers"
              description="Configure Model Context Protocol servers that will be available across all profiles. Profile-specific MCP servers will override these global settings."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-4">
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  ✓ Global settings saved successfully
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
              {loading ? 'Saving...' : 'Save Global Settings'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}