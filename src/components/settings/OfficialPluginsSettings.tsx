'use client'

import { useState, useEffect } from 'react'

interface OfficialPluginsSettingsProps {
  plugins: string[] | undefined
  onChange: (plugins: string[]) => void
  disabled?: boolean
}

export function OfficialPluginsSettings({ plugins, onChange, disabled = false }: OfficialPluginsSettingsProps) {
  const [pluginsText, setPluginsText] = useState('')

  // plugins 配列からテキストを生成
  useEffect(() => {
    setPluginsText(plugins?.join('\n') || '')
  }, [plugins])

  const handleTextChange = (text: string) => {
    setPluginsText(text)
    // テキストを配列に変換して onChange を呼び出す
    const pluginArray = text.split('\n').map(p => p.trim()).filter(p => p)
    onChange(pluginArray)
  }

  const pluginCount = plugins?.filter(p => p.trim()).length || 0

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
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">Official Plugins</p>
              <p className="mt-1">
                These are plugins from the <code className="bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-xs">claude-plugins-official</code> marketplace.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Enabled Official Plugins (one per line)
            {pluginCount > 0 && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                ({pluginCount} plugin{pluginCount !== 1 ? 's' : ''} configured)
              </span>
            )}
          </label>
          <textarea
            value={pluginsText}
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={disabled}
            placeholder={"plugin-1\nplugin-2\nplugin-3"}
            rows={6}
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
              disabled ? 'cursor-not-allowed' : ''
            }`}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Enter the names of official plugins you want to enable, one per line.
          </p>
        </div>
      </div>
    </div>
  )
}
