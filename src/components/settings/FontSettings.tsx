'use client'

import { FontSettings as FontSettingsType, FontSize, FontFamily } from '@/types/settings'

interface FontSettingsProps {
  fontSettings: FontSettingsType
  onChange: (settings: FontSettingsType) => void
}

export function FontSettings({ fontSettings, onChange }: FontSettingsProps) {
  const fontSizeOptions: { value: FontSize; label: string }[] = [
    { value: 'small', label: '小' },
    { value: 'medium', label: '中' },
    { value: 'large', label: '大' }
  ]

  const fontFamilyOptions: { value: FontFamily; label: string; description: string }[] = [
    {
      value: 'sans-serif',
      label: 'Sans-serif',
      description: '通常のフォント（読みやすさ重視）'
    },
    {
      value: 'monospace',
      label: 'Monospace',
      description: '等幅フォント（コード表示に適している）'
    }
  ]

  const handleFontSizeChange = (fontSize: FontSize) => {
    onChange({ ...fontSettings, fontSize })
  }

  const handleFontFamilyChange = (fontFamily: FontFamily) => {
    onChange({ ...fontSettings, fontFamily })
  }

  return (
    <div className="space-y-6">
      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          フォントサイズ
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          チャット画面のテキストサイズを選択します
        </p>
        <div className="flex gap-2">
          {fontSizeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFontSizeChange(option.value)}
              className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                fontSettings.fontSize === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          フォントファミリー
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          チャット画面のフォントタイプを選択します
        </p>
        <div className="space-y-2">
          {fontFamilyOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                fontSettings.fontFamily === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <input
                type="radio"
                name="fontFamily"
                value={option.value}
                checked={fontSettings.fontFamily === option.value}
                onChange={() => handleFontFamilyChange(option.value)}
                className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <div className="ml-3">
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
