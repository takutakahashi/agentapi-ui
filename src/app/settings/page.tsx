'use client'

import { useState, useEffect, useCallback } from 'react'
import { SettingsFormData, getDefaultSettings, isSingleProfileModeEnabled } from '../../types/settings'
import type { EnvironmentVariable } from '../../types/settings'
import BedrockSettingsComponent from '../../components/BedrockSettings'
import PushNotificationSettings from '../../components/PushNotificationSettings'

export default function GlobalSettingsPage() {
  const [settings, setSettings] = useState<SettingsFormData>(getDefaultSettings())
  
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decryptError, setDecryptError] = useState<string | null>(null)
  
  const isSingleProfile = isSingleProfileModeEnabled()

  // Helper function to clear corrupted encrypted config
  const clearEncryptedConfig = useCallback(() => {
    try {
      localStorage.removeItem('agentapi-encrypted-config')
      console.log('Cleared corrupted encrypted config from localStorage')
    } catch (error) {
      console.error('Failed to clear encrypted config:', error)
    }
  }, [])
  
  const loadEncryptedSettings = useCallback(async () => {
    if (!isSingleProfile) return
    
    try {
      const encryptedConfig = localStorage.getItem('agentapi-encrypted-config')
      if (!encryptedConfig) {
        setDecryptError('暗号化された設定が見つかりません')
        return
      }
      
      // Validate encrypted config format
      if (typeof encryptedConfig !== 'string' || encryptedConfig.trim().length === 0) {
        console.error('Invalid encrypted config format:', encryptedConfig)
        localStorage.removeItem('agentapi-encrypted-config')
        setDecryptError('暗号化設定の形式が無効です。設定をクリアしました。')
        return
      }
      
      const response = await fetch('/api/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: encryptedConfig })
      })
      
      if (!response.ok) {
        throw new Error('復号化に失敗しました')
      }
      
      const { decrypted } = await response.json()
      
      let decryptedJson
      try {
        const decryptedString = Buffer.from(decrypted, 'base64').toString('utf8')
        decryptedJson = JSON.parse(decryptedString)
      } catch (parseError) {
        console.error('Failed to parse decrypted data:', parseError)
        localStorage.removeItem('agentapi-encrypted-config')
        setDecryptError('復号化されたデータの解析に失敗しました。設定をクリアしました。')
        return
      }
      
      // 復号化されたデータをテキストエリアに展開
      if (decryptedJson.environmentVariables) {
        const envVars = Object.entries(decryptedJson.environmentVariables).map(([key, value]) => ({
          key,
          value: String(value),
          description: ''
        }))
        setSettings(prev => ({
          ...prev,
          environmentVariables: envVars
        }))
      }
      
      
      if (decryptedJson.bedrockSettings) {
        setSettings(prev => ({
          ...prev,
          bedrockSettings: decryptedJson.bedrockSettings
        }))
      }
      
      setDecryptError(null)
    } catch (err) {
      console.error('Failed to decrypt settings:', err)
      setDecryptError('設定の復号化に失敗しました')
    }
  }, [isSingleProfile])

  // Load encrypted settings on component mount
  useEffect(() => {
    if (isSingleProfile) {
      loadEncryptedSettings()
    }
  }, [loadEncryptedSettings, isSingleProfile])

  const saveSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // In single profile mode, only encrypt and save - never use agentapi-global-settings
      if (isSingleProfile) {
        try {
          // Prepare settings data to encrypt
          const settingsData = {
            baseUrl: `${window.location.protocol}//${window.location.host}/api/proxy`,
            bedrockSettings: settings.bedrockSettings,
            environmentVariables: settings.environmentVariables.reduce((acc, env) => {
              if (env.key) acc[env.key] = env.value
              return acc
            }, {} as Record<string, string>)
          }
          
          // Convert settings to base64
          const base64Data = Buffer.from(JSON.stringify(settingsData)).toString('base64')
          
          // Encrypt the settings
          const encryptResponse = await fetch('/api/encrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: base64Data
            })
          })
          
          if (!encryptResponse.ok) {
            throw new Error('Failed to encrypt settings')
          }
          
          const { encrypted } = await encryptResponse.json()
          
          // Store only encrypted data in localStorage
          localStorage.setItem('agentapi-encrypted-config', encrypted)
        } catch (encryptError) {
          console.error('Failed to encrypt settings:', encryptError)
          setError('設定の暗号化に失敗しました')
          return
        }
      } else {
        // Non-single profile mode - this should not happen in this component
        setError('Single profile mode以外では使用できません')
        return
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
            Settings (Single Profile Mode)
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            Configure encrypted environment variables
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Settings are encrypted and stored securely. No unencrypted data is saved to localStorage.
          </p>
        </div>

        <div className="space-y-8">
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

          {/* Loading Status */}
          {isSingleProfile && decryptError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
                設定の読み込みエラー
              </h2>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                {decryptError}
              </p>
              <button
                onClick={() => {
                  clearEncryptedConfig()
                  setDecryptError(null)
                  window.location.reload()
                }}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
              >
                暗号化設定をクリアして再読み込み
              </button>
            </div>
          )}

          {/* Amazon Bedrock Settings */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <BedrockSettingsComponent
              settings={settings.bedrockSettings || { enabled: false }}
              onChange={(bedrockSettings) => setSettings(prev => ({ ...prev, bedrockSettings }))}
              title="Amazon Bedrock Settings"
              description="Configure Amazon Bedrock provider settings for Claude API access. These settings are encrypted and stored securely."
            />
          </div>

          {/* Push Notification Settings */}
          <PushNotificationSettings />


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