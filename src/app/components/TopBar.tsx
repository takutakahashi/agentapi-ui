'use client'

import { useRouter } from 'next/navigation'

interface TopBarProps {
  title: string
  subtitle?: string
  showFilterButton?: boolean
  filterButtonText?: string
  onFilterToggle?: () => void
  showSettingsButton?: boolean
  showNewSessionButton?: boolean
  onNewSession?: () => void
  children?: React.ReactNode
}

export default function TopBar({
  title,
  subtitle,
  showFilterButton = false,
  filterButtonText = 'フィルタを表示',
  onFilterToggle,
  showSettingsButton = true,
  showNewSessionButton = false,
  onNewSession,
  children
}: TopBarProps) {
  const router = useRouter()

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
        {/* ヘッダーセクション */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* 右側のボタン群 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* フィルタボタン */}
            {showFilterButton && onFilterToggle && (
              <button
                onClick={onFilterToggle}
                className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                </svg>
                <span className="hidden sm:inline">{filterButtonText}</span>
              </button>
            )}

            {/* 新しいセッションボタン */}
            {showNewSessionButton && onNewSession && (
              <button
                onClick={onNewSession}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">新しいセッション</span>
                <span className="sm:hidden">新規</span>
              </button>
            )}

            {/* 設定ボタン */}
            {showSettingsButton && (
              <button
                onClick={() => router.push('/settings')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                title="設定"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 追加コンテンツ */}
        {children}
      </div>
    </div>
  )
}