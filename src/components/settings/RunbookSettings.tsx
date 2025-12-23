'use client'

import { RunbookRepositoryConfig } from '@/types/settings'

interface RunbookSettingsProps {
  config: RunbookRepositoryConfig | undefined
  onChange: (config: RunbookRepositoryConfig) => void
  disabled?: boolean
}

export function RunbookSettings({ config, onChange, disabled = false }: RunbookSettingsProps) {
  const handleChange = (field: keyof RunbookRepositoryConfig, value: string) => {
    if (disabled) return
    onChange({
      repositoryUrl: config?.repositoryUrl || '',
      branch: config?.branch || 'main',
      directoryPath: config?.directoryPath || '',
      [field]: value,
    })
  }

  const inputClassName = disabled
    ? "mt-1 block w-full border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 placeholder-gray-300 dark:placeholder-gray-600 cursor-not-allowed"
    : "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  const labelClassName = disabled
    ? "block text-sm font-medium text-gray-400 dark:text-gray-500 mb-1"
    : "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"

  return (
    <div className="space-y-4">
      {disabled && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-amber-700 dark:text-amber-300">
            この機能は近日公開予定です
          </span>
        </div>
      )}

      <div className={disabled ? "opacity-60" : ""}>
        <label
          htmlFor="repositoryUrl"
          className={labelClassName}
        >
          Repository URL
        </label>
        <input
          type="text"
          id="repositoryUrl"
          value={config?.repositoryUrl || ''}
          onChange={(e) => handleChange('repositoryUrl', e.target.value)}
          placeholder="https://github.com/org/runbooks"
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      <div className={disabled ? "opacity-60" : ""}>
        <label
          htmlFor="branch"
          className={labelClassName}
        >
          Branch
        </label>
        <input
          type="text"
          id="branch"
          value={config?.branch || ''}
          onChange={(e) => handleChange('branch', e.target.value)}
          placeholder="main"
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      <div className={disabled ? "opacity-60" : ""}>
        <label
          htmlFor="directoryPath"
          className={labelClassName}
        >
          Directory Path
        </label>
        <input
          type="text"
          id="directoryPath"
          value={config?.directoryPath || ''}
          onChange={(e) => handleChange('directoryPath', e.target.value)}
          placeholder="/docs/runbooks"
          disabled={disabled}
          className={inputClassName}
        />
        <p className={`mt-1 text-xs ${disabled ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>
          Path to the directory containing runbook files within the repository.
        </p>
      </div>
    </div>
  )
}
