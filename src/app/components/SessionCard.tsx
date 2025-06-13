'use client'

import Link from 'next/link'
import { Session } from '../../types/agentapi'
import StatusBadge from './StatusBadge'

interface SessionCardProps {
  session: Session
}

export default function SessionCard({ session }: SessionCardProps) {
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) return `${diffMins}分前`
    if (diffHours < 24) return `${diffHours}時間前`
    return `${diffDays}日前`
  }

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
              {truncateText(String(session.metadata?.description || `Session ${session.session_id.substring(0, 8)}`), 80)}
            </h3>
            <StatusBadge status={session.status} />
          </div>

          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4 mb-2">
            <span>#{session.session_id.substring(0, 8)}</span>
            <span>作成: {formatRelativeTime(session.created_at)}</span>
            <span>更新: {formatRelativeTime(session.updated_at)}</span>
            <span>by {session.user_id}</span>
            {session.environment?.WORKSPACE_NAME && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                {session.environment.WORKSPACE_NAME}
              </span>
            )}
          </div>

          {/* メタデータタグ */}
          {session.metadata && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(session.metadata).map(([key, value]) => {
                if (key === 'description') return null
                return (
                  <span
                    key={key}
                    className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
                  >
                    {key}: {String(value)}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {session.status === 'active' && (
            <Link
              href={`/agentapi?session=${session.session_id}`}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              チャット
            </Link>
          )}
          
          <Link
            href={`/sessions/${session.session_id}`}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            詳細
          </Link>
        </div>
      </div>
    </div>
  )
}