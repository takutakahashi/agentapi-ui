'use client'

import React, { useState } from 'react'
import { BedrockSettings as BedrockSettingsType } from '../types/settings'

interface BedrockSettingsProps {
  settings: BedrockSettingsType
  onChange: (settings: BedrockSettingsType) => void
  title?: string
  description?: string
}


export default function BedrockSettings({ 
  settings, 
  onChange, 
  title = "Amazon Bedrock Settings",
  description = "Configure Amazon Bedrock provider settings for Claude API access"
}: BedrockSettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleChange = (field: keyof BedrockSettingsType, value: string | boolean | number) => {
    onChange({
      ...settings,
      [field]: value
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="bedrock-enabled"
          checked={settings.enabled}
          onChange={(e) => handleChange('enabled', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="bedrock-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Enable Amazon Bedrock
        </label>
      </div>

      {/* Settings Form - only show when enabled */}
      {settings.enabled && (
        <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          
          {/* AWS Credentials */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">AWS Credentials</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  AWS Access Key ID
                </label>
                <input
                  type="text"
                  value={settings.awsAccessKeyId || ''}
                  onChange={(e) => handleChange('awsAccessKeyId', e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  AWS Secret Access Key
                </label>
                <input
                  type="password"
                  value={settings.awsSecretAccessKey || ''}
                  onChange={(e) => handleChange('awsSecretAccessKey', e.target.value)}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Session Token - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                AWS Session Token (optional)
              </label>
              <input
                type="text"
                value={settings.awsSessionToken || ''}
                onChange={(e) => handleChange('awsSessionToken', e.target.value)}
                placeholder="For temporary credentials or STS"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* AWS Region and Model */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Configuration</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  AWS Region
                </label>
                <input
                  type="text"
                  value={settings.region || ''}
                  onChange={(e) => handleChange('region', e.target.value)}
                  placeholder="us-east-1"
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Model Name
                </label>
                <input
                  type="text"
                  value={settings.modelName || ''}
                  onChange={(e) => handleChange('modelName', e.target.value)}
                  placeholder="claude-3-5-sonnet-20241022"
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  モデル名または推論プロファイルのARNを入力してください
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span>{showAdvanced ? '▼' : '▶'}</span>
              <span>Advanced Settings</span>
            </button>

            {showAdvanced && (
              <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Custom Endpoint URL (optional)
                  </label>
                  <input
                    type="url"
                    value={settings.endpointUrl || ''}
                    onChange={(e) => handleChange('endpointUrl', e.target.value)}
                    placeholder="https://bedrock-runtime.us-east-1.amazonaws.com"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={settings.timeout || 30000}
                    onChange={(e) => handleChange('timeout', parseInt(e.target.value) || 30000)}
                    min="1000"
                    step="1000"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Information Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm">
                <p className="text-blue-800 dark:text-blue-200 font-medium">
                  Environment Variables
                </p>
                <p className="text-blue-600 dark:text-blue-300 mt-1">
                  When enabled, this will set <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">CLAUDE_CODE_USE_BEDROCK=1</code> and configure AWS credentials as environment variables.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}