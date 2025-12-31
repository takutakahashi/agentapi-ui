'use client'

import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: ReactNode
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className = ''
}: EmptyStateProps) {
  const sizeConfig = {
    sm: {
      container: 'py-8',
      iconWrapper: 'w-12 h-12 mb-3',
      iconSize: 'w-6 h-6',
      title: 'text-base',
      description: 'text-sm max-w-xs',
      button: 'px-3 py-1.5 text-sm'
    },
    md: {
      container: 'py-16',
      iconWrapper: 'w-16 h-16 mb-4',
      iconSize: 'w-8 h-8',
      title: 'text-lg',
      description: 'text-sm max-w-sm',
      button: 'px-4 py-2 text-sm'
    },
    lg: {
      container: 'py-24',
      iconWrapper: 'w-20 h-20 mb-5',
      iconSize: 'w-10 h-10',
      title: 'text-xl',
      description: 'text-base max-w-md',
      button: 'px-5 py-2.5 text-base'
    }
  }

  const config = sizeConfig[size]

  return (
    <div className={`empty-state ${config.container} animate-fade-in ${className}`}>
      {icon && (
        <div className={`${config.iconWrapper} rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center`}>
          <div className={`${config.iconSize} text-gray-400 dark:text-gray-500`}>
            {icon}
          </div>
        </div>
      )}

      <h3 className={`${config.title} font-semibold text-gray-900 dark:text-white mb-2`}>
        {title}
      </h3>

      {description && (
        <p className={`${config.description} text-gray-500 dark:text-gray-400 text-center mb-6`}>
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className={`btn-primary ${config.button} gap-2`}
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className={`btn-secondary ${config.button}`}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Pre-configured empty states for common use cases
export function NoSessionsEmptyState({ onCreateSession }: { onCreateSession: () => void }) {
  return (
    <EmptyState
      icon={
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      }
      title="セッションがありません"
      description="新しいセッションを作成して、AIエージェントとの会話を始めましょう。"
      action={{
        label: '新しいセッションを作成',
        onClick: onCreateSession,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        )
      }}
    />
  )
}

export function NoConversationsEmptyState() {
  return (
    <EmptyState
      icon={
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      }
      title="会話がありません"
      description="このリポジトリではまだ会話が開始されていません。"
    />
  )
}

export function NoSchedulesEmptyState({ onCreateSchedule }: { onCreateSchedule: () => void }) {
  return (
    <EmptyState
      icon={
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      title="スケジュールがありません"
      description="定期実行タスクを設定して、自動化を始めましょう。"
      action={{
        label: 'スケジュールを作成',
        onClick: onCreateSchedule,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        )
      }}
    />
  )
}

export function NoResultsEmptyState({ searchTerm, onClear }: { searchTerm?: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      title="検索結果がありません"
      description={searchTerm ? `「${searchTerm}」に一致する結果が見つかりませんでした。` : '条件に一致する結果が見つかりませんでした。'}
      action={onClear ? {
        label: 'フィルタをクリア',
        onClick: onClear
      } : undefined}
    />
  )
}

export function ErrorEmptyState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full text-red-400 dark:text-red-500">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
      title="エラーが発生しました"
      description={message || 'データの読み込み中にエラーが発生しました。'}
      action={onRetry ? {
        label: '再試行',
        onClick: onRetry,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )
      } : undefined}
    />
  )
}
