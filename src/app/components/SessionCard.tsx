'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Session } from '../../types/agentapi'
import StatusBadge from './StatusBadge'
import { formatRelativeTime } from '../../utils/timeUtils'
import { truncateText } from '../../utils/textUtils'

interface SessionCardProps {
  session: Session
  onDelete?: (sessionId: string) => Promise<void>
  isDeleting?: boolean
}

export default function SessionCard({ session, onDelete, isDeleting }: SessionCardProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


  return (
    <div className="group card-modern-hover p-4 sm:p-5 mb-3 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
        <div className="flex-1 min-w-0">
          {/* タイトルとステータス */}
          <div className="flex items-start gap-3 mb-2">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-5 sm:leading-6 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {truncateText(String(session.tags?.description || session.metadata?.description || `Session ${session.session_id.substring(0, 8)}`), isMobile ? 100 : 120)}
            </h3>
            <StatusBadge status={session.status} />
          </div>

          {/* セッション情報 */}
          <div className="flex flex-col sm:flex-row sm:items-center text-xs text-gray-500 dark:text-gray-400 space-y-1 sm:space-y-0 sm:space-x-4 mb-3">
            <span className="font-mono text-gray-400 dark:text-gray-500">#{session.session_id.substring(0, 8)}</span>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatRelativeTime(session.created_at)}
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {formatRelativeTime(session.updated_at)}
              </span>
            </div>
            <span className="hidden sm:inline text-gray-400 dark:text-gray-500">by {session.user_id}</span>
            {session.environment?.WORKSPACE_NAME && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 self-start font-medium">
                {session.environment.WORKSPACE_NAME}
              </span>
            )}
          </div>

          {/* メタデータタグ - モバイルでは最大2個まで表示 */}
          {session.metadata && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {Object.entries(session.metadata)
                .filter(([key]) => key !== 'description')
                .slice(0, isMobile ? 2 : 10)
                .map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md font-medium border border-blue-100 dark:border-blue-800"
                  >
                    <span className="hidden sm:inline text-blue-500 dark:text-blue-400">{key}: </span>
                    <span className="sm:hidden text-blue-500 dark:text-blue-400">{key.substring(0, 8)}: </span>
                    {String(value).substring(0, isMobile ? 8 : 20)}
                  </span>
                ))}
              {Object.entries(session.metadata).filter(([key]) => key !== 'description').length > 2 && isMobile && (
                <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-md font-medium">
                  +{Object.entries(session.metadata).filter(([key]) => key !== 'description').length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        {/* アクションボタン - モバイルでは横並び */}
        <div className="flex flex-row sm:flex-row items-center gap-2 sm:ml-4">
          {session.status === 'active' && (
            <Link
              href={`/agentapi?session=${session.session_id}`}
              className="btn-primary px-3 py-2 sm:px-4 sm:py-2 text-sm min-h-[44px] sm:min-h-0 gap-1.5"
              prefetch={true}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">チャット</span>
            </Link>
          )}

          <Link
            href={`/sessions/${session.session_id}`}
            className="btn-secondary px-3 py-2 sm:px-4 sm:py-2 text-sm min-h-[44px] sm:min-h-0 gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="hidden sm:inline">詳細</span>
          </Link>

          {onDelete && (
            <button
              onClick={() => onDelete(session.session_id)}
              disabled={isDeleting}
              aria-label={`${isDeleting ? '削除中' : '削除'}: ${session.metadata?.description || `セッション ${session.session_id.substring(0, 8)}`}`}
              className="btn-danger px-3 py-2 sm:px-4 sm:py-2 text-sm min-h-[44px] sm:min-h-0 gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <svg className="animate-spin w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              <span className="hidden sm:inline">{isDeleting ? '削除中...' : '削除'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}