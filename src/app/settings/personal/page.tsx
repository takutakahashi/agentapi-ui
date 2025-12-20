'use client'

import { useState } from 'react'
import { PersonalSettings } from '@/types/settings'

export default function PersonalSettingsPage() {
  const [settings] = useState<PersonalSettings>({})
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    console.log('Personal Settings:', settings)

    // Simulate save delay
    setTimeout(() => {
      setSaving(false)
    }, 500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Personal Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your personal preferences
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <p className="text-gray-500 dark:text-gray-400">
          Settings will be added here.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saving && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
