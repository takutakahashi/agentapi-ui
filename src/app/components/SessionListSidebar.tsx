'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client'
import { Session, SessionStatus } from '../../types/agentapi'
import { useTeamScope } from '../../contexts/TeamScopeContext'

interface SessionListSidebarProps {
  currentSessionId: string
  isVisible?: boolean
  onClose?: () => void
}

function getStatusDotClass(status: SessionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-500'
    case 'starting':
      return 'bg-yellow-400 animate-pulse'
    case 'creating':
      return 'bg-blue-400 animate-pulse'
    case 'unhealthy':
      return 'bg-red-500'
    case 'stopped':
      return 'bg-gray-400'
    default:
      return 'bg-gray-300'
  }
}

function isRunningStatus(status: SessionStatus): boolean {
  return status === 'active' || status === 'starting' || status === 'creating'
}

function getStatusLabel(status: SessionStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'starting':
      return '起動中'
    case 'creating':
      return '作成中'
    case 'unhealthy':
      return 'Unhealthy'
    case 'stopped':
      return 'Stopped'
    default:
      return status
  }
}

function getSessionTitle(session: Session): string {
  // Try various description fields
  if (session.tags?.description && session.tags.description.trim()) {
    return session.tags.description.trim()
  }
  const metaDesc = session.metadata?.description
  if (metaDesc && typeof metaDesc === 'string' && metaDesc.trim()) {
    return metaDesc.trim()
  }
  if (session.description && session.description.trim()) {
    return session.description.trim()
  }
  return `Session #${session.session_id.substring(0, 8)}`
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}時間前`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}日前`
}

export default function SessionListSidebar({
  currentSessionId,
  isVisible = true,
  onClose,
}: SessionListSidebarProps) {
  const router = useRouter()
  const { selectedTeam } = useTeamScope()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const scopeParams: { scope: 'user' | 'team'; team_id?: string } = selectedTeam
        ? { scope: 'team', team_id: selectedTeam }
        : { scope: 'user' }

      const response = await client.search({ limit: 100, ...scopeParams })
      const sorted = (response.sessions || []).sort((a, b) => {
        const aTime = new Date(a.updated_at || a.started_at).getTime()
        const bTime = new Date(b.updated_at || b.started_at).getTime()
        return bTime - aTime
      })
      setSessions(sorted)
    } catch (err) {
      console.error('[SessionListSidebar] Failed to fetch sessions:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedTeam])

  useEffect(() => {
    if (!isVisible) return
    fetchSessions()
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [fetchSessions, isVisible])

  if (!isVisible) return null

  return (
    <div className="flex flex-col w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">セッション一覧</h2>
        </div>
        <div className="flex items-center space-x-1">
          {/* New session button */}
          <button
            onClick={() => router.push('/sessions/new')}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="新しいセッション"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {/* Close sidebar button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              title="サイドバーを閉じる"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-3 text-center">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs text-gray-500 dark:text-gray-400">セッションがありません</p>
          </div>
        ) : (
          <ul className="py-1">
            {sessions.map((session) => {
              const isActive = session.session_id === currentSessionId
              const running = isRunningStatus(session.status)
              const title = getSessionTitle(session)
              const timeStr = formatRelativeTime(session.updated_at || session.started_at)

              return (
                <li key={session.session_id}>
                  <button
                    onClick={() => router.push(`/sessions/${session.session_id}`)}
                    className={`w-full text-left px-3 py-2.5 flex items-start space-x-2.5 transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-r-2 border-blue-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {/* Status dot */}
                    <div className="mt-1.5 flex-shrink-0 relative">
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusDotClass(session.status)}`}
                        title={getStatusLabel(session.status)}
                      />
                      {/* Extra pulse ring for running sessions */}
                      {running && session.status === 'active' && (
                        <div className="absolute inset-0 rounded-full bg-green-400 opacity-40 animate-ping" />
                      )}
                    </div>

                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs font-medium truncate leading-tight ${
                          isActive
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                        title={title}
                      >
                        {title}
                      </div>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        {/* Running indicator */}
                        {running ? (
                          <span
                            className={`inline-flex items-center text-xs ${
                              session.status === 'active'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-yellow-600 dark:text-yellow-400'
                            }`}
                          >
                            {session.status !== 'active' && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse mr-1 flex-shrink-0" />
                            )}
                            {getStatusLabel(session.status)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {getStatusLabel(session.status)}
                          </span>
                        )}
                        {timeStr && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {timeStr}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer: session count */}
      {!loading && sessions.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            {sessions.filter(s => isRunningStatus(s.status)).length} 件稼働中 / {sessions.length} 件
          </p>
        </div>
      )}
    </div>
  )
}
