'use client'

import { useState } from 'react'

interface OfficialPluginsSettingsProps {
  plugins: string[] | undefined
  onChange: (plugins: string[]) => void
  disabled?: boolean
}

export function OfficialPluginsSettings({ plugins, onChange, disabled = false }: OfficialPluginsSettingsProps) {
  const [newPluginName, setNewPluginName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pluginList = plugins || []

  const handleAdd = () => {
    if (disabled) return
    setError(null)

    const trimmed = newPluginName.trim()
    if (!trimmed) {
      setError('Plugin name is required')
      return
    }

    if (pluginList.includes(trimmed)) {
      setError('This plugin is already added')
      return
    }

    onChange([...pluginList, trimmed])
    setNewPluginName('')
  }

  const handleDelete = (pluginName: string) => {
    if (disabled) return
    onChange(pluginList.filter(p => p !== pluginName))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-4">
      {disabled && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm text-amber-700 dark:text-amber-300">
            This feature is experimental. Enable experimental features to configure official plugins.
          </span>
        </div>
      )}

      <div className={disabled ? "opacity-60" : ""}>
        {/* Plugin List */}
        {pluginList.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No official plugins enabled</p>
            <p className="text-sm mt-1">Add plugins from the claude-plugins-official marketplace</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pluginList.map((pluginName) => (
              <div
                key={pluginName}
                className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 bg-white dark:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔌</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {pluginName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(pluginName)}
                  disabled={disabled}
                  className={`text-sm font-medium ${
                    disabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
                  }`}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Plugin Input */}
        <div className="mt-4">
          {error && (
            <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newPluginName}
              onChange={(e) => {
                setNewPluginName(e.target.value)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder="Enter plugin name"
              className={`flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                disabled ? 'cursor-not-allowed' : ''
              }`}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={disabled || !newPluginName.trim()}
              className={`px-4 py-2 rounded-md transition-colors ${
                disabled || !newPluginName.trim()
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              + Add
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Enter the name of an official plugin from claude-plugins-official
          </p>
        </div>
      </div>
    </div>
  )
}
