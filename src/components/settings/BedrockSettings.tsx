'use client'

import { BedrockConfig } from '@/types/settings'

interface BedrockSettingsProps {
  config: BedrockConfig | undefined
  onChange: (config: BedrockConfig) => void
  showCredentials?: boolean // チーム設定の場合のみ true
}

// 利用可能な AWS リージョンリスト
const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-west-3', label: 'Europe (Paris)' },
]

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

export function BedrockSettings({ config, onChange, showCredentials = false }: BedrockSettingsProps) {
  const getDefaultConfig = (): BedrockConfig => ({
    enabled: false,
    region: 'us-east-1',
    model: DEFAULT_MODEL,
  })

  const handleChange = <K extends keyof BedrockConfig>(field: K, value: BedrockConfig[K]) => {
    const currentConfig = config || getDefaultConfig()
    onChange({
      ...currentConfig,
      [field]: value,
    })
  }

  const handleToggleEnabled = () => {
    const currentConfig = config || getDefaultConfig()
    onChange({
      ...currentConfig,
      enabled: !currentConfig.enabled,
    })
  }

  const isEnabled = config?.enabled ?? false

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label
            htmlFor="bedrockEnabled"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Enable Bedrock
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use Amazon Bedrock for AI operations
          </p>
        </div>
        <button
          type="button"
          id="bedrockEnabled"
          onClick={handleToggleEnabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={isEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Region Selection (Required) */}
      <div>
        <label
          htmlFor="region"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Region <span className="text-red-500">*</span>
        </label>
        <select
          id="region"
          value={config?.region || 'us-east-1'}
          onChange={(e) => handleChange('region', e.target.value)}
          disabled={!isEnabled}
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {AWS_REGIONS.map((region) => (
            <option key={region.value} value={region.value}>
              {region.label} ({region.value})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          AWS region where Bedrock is available
        </p>
      </div>

      {/* Model ID (Optional) */}
      <div>
        <label
          htmlFor="model"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Model ID
        </label>
        <input
          type="text"
          id="model"
          value={config?.model || ''}
          onChange={(e) => handleChange('model', e.target.value)}
          placeholder={DEFAULT_MODEL}
          disabled={!isEnabled}
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Bedrock model ID (default: {DEFAULT_MODEL})
        </p>
      </div>

      {/* AWS Profile (Optional) */}
      <div>
        <label
          htmlFor="profile"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          AWS Profile
        </label>
        <input
          type="text"
          id="profile"
          value={config?.profile || ''}
          onChange={(e) => handleChange('profile', e.target.value)}
          placeholder="default"
          disabled={!isEnabled}
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          AWS profile to use for authentication
        </p>
      </div>

      {/* Role ARN (Optional) */}
      <div>
        <label
          htmlFor="roleArn"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          IAM Role ARN
        </label>
        <input
          type="text"
          id="roleArn"
          value={config?.role_arn || ''}
          onChange={(e) => handleChange('role_arn', e.target.value)}
          placeholder="arn:aws:iam::123456789012:role/BedrockRole"
          disabled={!isEnabled}
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          IAM role ARN to assume for Bedrock access
        </p>
      </div>

      {/* AWS Credentials - Team settings only */}
      {showCredentials && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              AWS Credentials (Team Only)
            </h4>
          </div>

          <div>
            <label
              htmlFor="accessKeyId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Access Key ID
            </label>
            <input
              type="text"
              id="accessKeyId"
              value={config?.access_key_id || ''}
              onChange={(e) => handleChange('access_key_id', e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              disabled={!isEnabled}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="secretAccessKey"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Secret Access Key
            </label>
            <input
              type="password"
              id="secretAccessKey"
              value={config?.secret_access_key || ''}
              onChange={(e) => handleChange('secret_access_key', e.target.value)}
              placeholder="••••••••••••••••"
              disabled={!isEnabled}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              AWS credentials for Bedrock API access. These are stored securely and masked in responses.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
