'use client'

interface ExperimentalSettingsProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export function ExperimentalSettings({ enabled, onChange }: ExperimentalSettingsProps) {
  const handleToggle = () => {
    onChange(!enabled)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label
            htmlFor="experimentalEnabled"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Enable Experimental Features
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enable experimental features for testing
          </p>
        </div>
        <button
          type="button"
          id="experimentalEnabled"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
        When enabled, experimental features will be available. These features are still in development and may be unstable.
      </p>
    </div>
  )
}
