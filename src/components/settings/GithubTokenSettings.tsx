'use client'

import { LogoutButton } from './LogoutButton'

interface GithubTokenSettingsProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export function GithubTokenSettings({ enabled, onChange }: GithubTokenSettingsProps) {
  const handleToggle = () => {
    onChange(!enabled)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label
            htmlFor="githubTokenEnabled"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Use GitHub OAuth Token
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use your GitHub OAuth token for agent sessions
          </p>
        </div>
        <button
          type="button"
          id="githubTokenEnabled"
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
        When enabled, your GitHub OAuth token will be used to authenticate with GitHub APIs during agent sessions.
        This allows the agent to perform GitHub operations on your behalf.
      </p>
      <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
        <p className="mb-2">
          <strong>Note:</strong> After changing this setting, you need to logout and login again for the changes to take effect.
        </p>
        <LogoutButton />
      </div>
    </div>
  )
}
