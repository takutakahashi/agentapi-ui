'use client'

import { useState, useEffect } from 'react'
import NavigationTabs from './NavigationTabs'
import TaskListPanel from './TaskListPanel'

const SIDEBAR_ACTIVE_TAB_KEY = 'sidebar_active_tab'

interface SessionProfileSidebarProps {
  isVisible?: boolean
  onToggleVisibility?: () => void
}

export default function SessionProfileSidebar({
  isVisible = true,
  onToggleVisibility,
}: SessionProfileSidebarProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'tasks'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SIDEBAR_ACTIVE_TAB_KEY)
      if (saved === 'tasks') return 'tasks'
    }
    return 'info'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_ACTIVE_TAB_KEY, activeTab)
    }
  }, [activeTab])

  return (
    <>
      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-10 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out overflow-y-auto
          md:relative md:translate-x-0 md:inset-auto md:w-80 md:h-screen
          ${isVisible ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4">
          {/* Navigation Tabs */}
          <div className="mb-4">
            <NavigationTabs />
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'info'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              プロファイル
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'tasks'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              タスク
            </button>
          </div>

          {/* Close button for mobile */}
          {onToggleVisibility && (
            <div className="flex justify-end mb-2">
              <button
                onClick={onToggleVisibility}
                className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {activeTab === 'info' ? (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                セッションプロファイル
              </h2>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  セッションプロファイルを使って、セッション設定（環境変数、タグ、初期メッセージなど）を再利用可能なテンプレートとして保存できます。
                </p>
                <p>
                  セッション作成時やWebhook・スケジュールの設定でプロファイルを選択して使用します。
                </p>
              </div>
            </div>
          ) : (
            <TaskListPanel />
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      {isVisible && onToggleVisibility && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-[5]"
          onClick={onToggleVisibility}
        />
      )}
    </>
  )
}
