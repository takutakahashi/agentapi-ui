'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client'
import { Session, SessionStatus } from '../../types/agentapi'
import { useTeamScope } from '../../contexts/TeamScopeContext'

interface SessionListSidebarProps {
  currentSessionId: string
  isVisible?: boolean
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
      return 'bg-gray-300 dark:bg-gray-600'
    default:
      return 'bg-gray-300 dark:bg-gray-600'
  }
}

function isRunningStatus(status: SessionStatus): boolean {
  return status === 'active' || status === 'starting' || status === 'creating'
}

function getSessionTitle(session: Session): string {
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
  return `#${session.session_id.substring(0, 8)}`
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h前`
  return `${Math.floor(diffHour / 24)}d前`
}

export default function SessionListSidebar({
  currentSessionId,
  isVisible = true,
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
      const sorted = (response.sessions || []).sort((a, b) =>
        new Date(b.updated_at || b.started_at).getTime() -
        new Date(a.updated_at || a.started_at).getTime()
      )
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

  const runningCount = sessions.filter(s => isRunningStatus(s.status)).length

  return (
    <div className="flex flex-col w-56 h-full bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex-shrink-0 overflow-hidden">
      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-8 px-3">
            セッションなし
          </p>
        ) : (
          <ul>
            {sessions.map((session) => {
              const isActive = session.session_id === currentSessionId
              const running = isRunningStatus(session.status)
              const title = getSessionTitle(session)
              const timeStr = formatRelativeTime(session.updated_at || session.started_at)

              return (
                <li key={session.session_id}>
                  <button
                    onClick={() => router.push(`/sessions/${session.session_id}`)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors group ${
                      isActive
                        ? 'bg-white dark:bg-gray-900 border-r-2 border-blue-500'
                        : 'hover:bg-white/60 dark:hover:bg-gray-900/60'
                    }`}
                  >
                    {/* Status dot */}
                    <div className="mt-[5px] flex-shrink-0 relative">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${getStatusDotClass(session.status)}`}
                      />
                      {session.status === 'active' && (
                        <div className="absolute inset-0 rounded-full bg-green-400 opacity-50 animate-ping" />
                      )}
                    </div>

                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs truncate leading-snug ${
                          isActive
                            ? 'text-gray-900 dark:text-gray-100 font-medium'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                        title={title}
                      >
                        {title}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 leading-none">
                        {running && session.status !== 'active' ? (
                          <span className="text-yellow-500 dark:text-yellow-400">
                            {session.status === 'starting' ? '起動中' : '作成中'}
                          </span>
                        ) : (
                          timeStr
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      {!loading && sessions.length > 0 && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-gray-200 dark:border-gray-800">
          <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center">
            {runningCount > 0 ? (
              <><span className="text-green-500">{runningCount}</span> 件稼働中 / {sessions.length} 件</>
            ) : (
              `${sessions.length} 件`
            )}
          </p>
        </div>
      )}
    </div>
  )
}
