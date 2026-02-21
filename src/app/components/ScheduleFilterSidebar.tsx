'use client'

import { useState } from 'react'
import { ScheduleStatus } from '../../types/schedule'
import NavigationTabs from './NavigationTabs'
import TaskListPanel from './TaskListPanel'

interface ScheduleFilterSidebarProps {
  statusFilter: ScheduleStatus | null
  onStatusFilterChange: (status: ScheduleStatus | null) => void
  isVisible?: boolean
  onToggleVisibility?: () => void
}

const statusOptions: { value: ScheduleStatus | null; label: string; description: string }[] = [
  { value: null, label: 'すべて', description: 'すべてのスケジュールを表示' },
  { value: 'active', label: 'Active', description: '有効なスケジュール' },
  { value: 'paused', label: 'Paused', description: '一時停止中のスケジュール' },
  { value: 'completed', label: 'Completed', description: '完了したスケジュール' },
]

export default function ScheduleFilterSidebar({
  statusFilter,
  onStatusFilterChange,
  isVisible = true,
  onToggleVisibility,
}: ScheduleFilterSidebarProps) {
  const [activeTab, setActiveTab] = useState<'filter' | 'tasks'>('filter')

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
              onClick={() => setActiveTab('filter')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'filter'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              フィルター
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

          {activeTab === 'filter' ? (
            <>
              {/* Header */}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Status
              </h2>

              {/* Status Filter */}
              <div className="space-y-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value ?? 'all'}
                    onClick={() => onStatusFilterChange(option.value)}
                    className={`
                      w-full text-left px-3 py-2 rounded-md transition-colors
                      ${
                        statusFilter === option.value
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* Clear Filter */}
              {statusFilter !== null && (
                <button
                  onClick={() => onStatusFilterChange(null)}
                  className="mt-4 w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  フィルタをクリア
                </button>
              )}
            </>
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
