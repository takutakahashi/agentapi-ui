'use client'

import { SessionProfile } from '../../types/session_profile'

interface SessionProfileCardProps {
  profile: SessionProfile
  onEdit: (profile: SessionProfile) => void
  onDelete: (profileId: string) => void
  isDeleting?: boolean
}

export default function SessionProfileCard({
  profile,
  onEdit,
  onDelete,
  isDeleting = false,
}: SessionProfileCardProps) {
  const handleDelete = () => {
    if (confirm(`"${profile.name}" を削除してもよいですか？`)) {
      onDelete(profile.id)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Profile icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {profile.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {profile.is_default && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
              デフォルト
            </span>
          )}
          {profile.scope === 'team' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              チーム
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              個人
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <div className="mb-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {profile.description}
          </p>
        </div>
      )}

      {/* Initial message template */}
      {profile.config?.initial_message_template && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">初期メッセージテンプレート</div>
          <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 rounded font-mono">
            {profile.config.initial_message_template}
          </p>
        </div>
      )}

      {/* Config summary */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
        {profile.config?.reuse_session && (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            セッション再利用
          </span>
        )}
        {profile.config?.params?.sandbox?.enabled && (
          <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            サンドボックス
          </span>
        )}
        {profile.config?.environment && Object.keys(profile.config.environment).length > 0 && (
          <span>環境変数: <strong className="text-gray-700 dark:text-gray-300">{Object.keys(profile.config.environment).length}</strong></span>
        )}
        {profile.config?.tags && Object.keys(profile.config.tags).length > 0 && (
          <span>タグ: <strong className="text-gray-700 dark:text-gray-300">{Object.keys(profile.config.tags).length}</strong></span>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-3 mb-4">
        作成: {formatDate(profile.created_at)}
        {profile.updated_at !== profile.created_at && (
          <span className="ml-3">更新: {formatDate(profile.updated_at)}</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        {/* Edit */}
        <button
          onClick={() => onEdit(profile)}
          className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          編集
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors disabled:opacity-50"
        >
          {isDeleting ? (
            <svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
          削除
        </button>
      </div>
    </div>
  )
}
