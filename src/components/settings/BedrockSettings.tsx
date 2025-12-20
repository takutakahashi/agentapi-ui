'use client'

import { BedrockConfig } from '@/types/settings'

interface BedrockSettingsProps {
  config: BedrockConfig | undefined
  onChange: (config: BedrockConfig) => void
}

export function BedrockSettings({ config, onChange }: BedrockSettingsProps) {
  const handleChange = (value: string) => {
    onChange({
      modelId: value,
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Bedrock Settings
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Configure AWS Bedrock settings for AI model access.
      </p>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="modelId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Model ID
          </label>
          <input
            type="text"
            id="modelId"
            value={config?.modelId || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="anthropic.claude-3-sonnet-20240229-v1:0"
            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            The Bedrock model ID to use for AI operations.
          </p>
        </div>
      </div>
    </div>
  )
}
