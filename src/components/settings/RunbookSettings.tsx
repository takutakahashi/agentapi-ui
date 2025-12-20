'use client'

import { RunbookRepositoryConfig } from '@/types/settings'

interface RunbookSettingsProps {
  config: RunbookRepositoryConfig | undefined
  onChange: (config: RunbookRepositoryConfig) => void
}

export function RunbookSettings({ config, onChange }: RunbookSettingsProps) {
  const handleChange = (field: keyof RunbookRepositoryConfig, value: string) => {
    onChange({
      repositoryUrl: config?.repositoryUrl || '',
      branch: config?.branch || 'main',
      directoryPath: config?.directoryPath || '',
      [field]: value,
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Runbook Repository
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Configure the repository containing your runbooks.
      </p>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="repositoryUrl"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Repository URL
          </label>
          <input
            type="text"
            id="repositoryUrl"
            value={config?.repositoryUrl || ''}
            onChange={(e) => handleChange('repositoryUrl', e.target.value)}
            placeholder="https://github.com/org/runbooks"
            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            htmlFor="branch"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Branch
          </label>
          <input
            type="text"
            id="branch"
            value={config?.branch || ''}
            onChange={(e) => handleChange('branch', e.target.value)}
            placeholder="main"
            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            htmlFor="directoryPath"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Directory Path
          </label>
          <input
            type="text"
            id="directoryPath"
            value={config?.directoryPath || ''}
            onChange={(e) => handleChange('directoryPath', e.target.value)}
            placeholder="/docs/runbooks"
            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Path to the directory containing runbook files within the repository.
          </p>
        </div>
      </div>
    </div>
  )
}
