'use client'

import { useState, useEffect } from 'react'
import { 
  SingleProfileModeSettings as SingleProfileModeSettingsType,
  loadSingleProfileModeSettings,
  saveSingleProfileModeSettings,
  getDefaultSingleProfileModeSettings
} from '../../types/settings'

interface SingleProfileModeSettingsProps {
  onSettingsChange?: (settings: SingleProfileModeSettingsType) => void
}

export default function SingleProfileModeSettings({ onSettingsChange }: SingleProfileModeSettingsProps) {
  const [settings, setSettings] = useState<SingleProfileModeSettingsType>(getDefaultSingleProfileModeSettings())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const loadedSettings = loadSingleProfileModeSettings()
    setSettings(loadedSettings)
    setIsLoading(false)
  }, [])

  const handleToggleMode = async (enabled: boolean) => {
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const updatedSettings = {
        ...settings,
        enabled
      }

      // Handle cookie operations via API route
      if (enabled && settings.globalApiKey) {
        const response = await fetch('/api/settings/single-profile-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', apiKey: settings.globalApiKey })
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to set API key cookie')
        }
      } else if (!enabled) {
        const response = await fetch('/api/settings/single-profile-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete' })
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to delete API key cookie')
        }
      }

      saveSingleProfileModeSettings(updatedSettings)
      setSettings(updatedSettings)
      onSettingsChange?.(updatedSettings)
      
      setSuccess(enabled ? 'Single Profile Modeが有効になりました' : 'Single Profile Modeが無効になりました')
    } catch (err) {
      setError('設定の更新に失敗しました: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleApiKeyChange = (apiKey: string) => {
    setSettings(prev => ({
      ...prev,
      globalApiKey: apiKey
    }))
    setError(null)
    setSuccess(null)
  }

  const handleSaveApiKey = async () => {
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      if (!settings.globalApiKey.trim()) {
        throw new Error('APIキーを入力してください')
      }

      if (settings.enabled) {
        const response = await fetch('/api/settings/single-profile-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', apiKey: settings.globalApiKey })
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to set API key cookie')
        }
      }

      saveSingleProfileModeSettings(settings)
      onSettingsChange?.(settings)
      setSuccess('APIキーが保存されました')
    } catch (err) {
      setError('APIキーの保存に失敗しました: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Single Profile Mode
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          プロファイル管理を簡素化し、グローバル設定でAPIキーを管理します。
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Single Profile Mode
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {settings.enabled ? '有効' : '無効'}
          </p>
        </div>
        <button
          onClick={() => handleToggleMode(!settings.enabled)}
          disabled={isSaving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-main-color focus:ring-offset-2 ${
            settings.enabled 
              ? 'bg-main-color' 
              : 'bg-gray-200 dark:bg-gray-600'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* API Key Settings */}
      <div className="space-y-4">
        <div>
          <label htmlFor="globalApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            グローバルAPIキー
          </label>
          <div className="relative">
            <input
              id="globalApiKey"
              type={showApiKey ? 'text' : 'password'}
              value={settings.globalApiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              disabled={isSaving}
              placeholder="APIキーを入力してください"
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-main-color focus:border-main-color dark:bg-gray-700 dark:text-white sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute inset-y-0 right-0 flex items-center pr-3"
            >
              {showApiKey ? (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            このAPIキーは暗号化されてCookieに保存され、すべてのAPI通信で使用されます。
          </p>
        </div>

        <button
          onClick={handleSaveApiKey}
          disabled={isSaving || !settings.globalApiKey.trim()}
          className="w-full px-4 py-2 bg-main-color hover:bg-main-color-dark text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-main-color focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : 'APIキーを保存'}
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <div className="flex">
            <svg className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
          </div>
        </div>
      )}

      {/* Additional Information */}
      {settings.enabled && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
            Single Profile Mode が有効です
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• プロファイルの作成・編集・削除が無効化されます</li>
            <li>• プロファイル選択UIが非表示になります</li>
            <li>• すべてのAPI通信でグローバルAPIキーが使用されます</li>
            <li>• 環境変数とMCP設定はグローバル設定が適用されます</li>
          </ul>
        </div>
      )}
    </div>
  )
}