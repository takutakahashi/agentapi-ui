'use client'

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
            Send GitHub Token on Session Start
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Automatically inject your GitHub OAuth token when starting a new session
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
        When enabled, your GitHub OAuth token will be passed to the agent via <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">params.github_token</code> when starting a session.
        This allows the agent to access GitHub APIs on your behalf.
      </p>
    </div>
  )
}
