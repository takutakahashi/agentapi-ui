'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Session } from '../../types/agentapi'
import { createAgentAPIClientFromStorage, AgentAPIError } from '../../lib/agentapi-client'
import StatusBadge from './StatusBadge'

interface TagFilter {
  [key: string]: string[]
}

interface SessionListViewProps {
  tagFilters: TagFilter
  onSessionsUpdate: () => void
}

export default function SessionListView({ tagFilters, onSessionsUpdate }: SessionListViewProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  const [sendingMessages, setSendingMessages] = useState<Set<string>>(new Set())
  const [messageInputs, setMessageInputs] = useState<{ [sessionId: string]: string }>({})
  const [deletingSession, setDeletingSession] = useState<string | null>(null)
  const [sessionMessages, setSessionMessages] = useState<{ [sessionId: string]: string }>({})

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const client = createAgentAPIClientFromStorage()
      const response = await client.getSessions({ limit: 1000 })
      const sessionList = response.sessions || []
      setSessions(sessionList)

      // 各セッションの初期メッセージを取得
      const messagePromises = sessionList.map(async (session) => {
        try {
          const messages = await client.getSessionMessages(session.session_id, { limit: 10 })
          const userMessages = messages.messages.filter(msg => msg.role === 'user')
          if (userMessages.length > 0) {
            return { sessionId: session.session_id, message: userMessages[0].content }
          }
        } catch (err) {
          console.warn(`Failed to fetch messages for session ${session.session_id}:`, err)
        }
        return { sessionId: session.session_id, message: String(session.metadata?.description || 'No description available') }
      })

      const messageResults = await Promise.all(messagePromises)
      const messageMap: { [sessionId: string]: string } = {}
      messageResults.forEach(result => {
        messageMap[result.sessionId] = result.message
      })
      setSessionMessages(messageMap)
    } catch (err) {
      if (err instanceof AgentAPIError) {
        setError(`Failed to load sessions: ${err.message}`)
      } else {
        setError('An unexpected error occurred while loading sessions')
      }
      
      // モックデータを使用
      const mockSessions = getMockSessions()
      setSessions(mockSessions)
      
      // モックセッションの初期メッセージを設定
      const mockMessages: { [sessionId: string]: string } = {}
      mockSessions.forEach(session => {
        mockMessages[session.session_id] = String(session.metadata?.description || 'No description available')
      })
      setSessionMessages(mockMessages)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const getMockSessions = (): Session[] => [
    {
      session_id: 'session-001',
      user_id: 'user-alice',
      status: 'active',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      environment: {
        GITHUB_TOKEN: '***',
        WORKSPACE_NAME: 'code-review-project'
      },
      metadata: {
        description: 'コードレビューセッションでReactアーキテクチャについて議論し、最適化の提案を行っています。',
        project_type: 'frontend',
        technology: 'React',
        repository: 'owner/react-project'
      }
    },
    {
      session_id: 'session-002',
      user_id: 'user-bob',
      status: 'active',
      created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      environment: {
        GITHUB_TOKEN: '***',
        WORKSPACE_NAME: 'api-integration-help'
      },
      metadata: {
        description: 'REST API統合の支援を行っています',
        project_type: 'backend',
        technology: 'Node.js',
        repository: 'owner/api-project'
      }
    },
    {
      session_id: 'session-003',
      user_id: 'user-charlie',
      status: 'error',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
      environment: {
        GITHUB_TOKEN: '***',
        WORKSPACE_NAME: 'database-design'
      },
      metadata: {
        description: 'データベーススキーマ設計セッション',
        project_type: 'database',
        technology: 'PostgreSQL'
      }
    }
  ]

  // タグフィルタを適用してセッションをフィルタリング
  const filteredSessions = sessions.filter(session => {
    if (!session.metadata) return true
    
    return Object.entries(tagFilters).every(([tagKey, selectedValues]) => {
      if (selectedValues.length === 0) return true
      const sessionValue = session.metadata?.[tagKey]
      return sessionValue && selectedValues.includes(String(sessionValue))
    })
  })

  const toggleDescription = (sessionId: string) => {
    const newExpanded = new Set(expandedDescriptions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedDescriptions(newExpanded)
  }

  const handleMessageInputChange = (sessionId: string, value: string) => {
    setMessageInputs(prev => ({
      ...prev,
      [sessionId]: value
    }))
  }

  const sendMessage = async (sessionId: string) => {
    const message = messageInputs[sessionId]?.trim()
    if (!message) return

    try {
      setSendingMessages(prev => new Set([...prev, sessionId]))
      
      const client = createAgentAPIClientFromStorage()
      // メッセージ送信のAPIを呼び出し（実際のAPIに応じて調整が必要）
      await client.sendSessionMessage(sessionId, {
        content: message,
        type: 'user'
      })

      setMessageInputs(prev => ({
        ...prev,
        [sessionId]: ''
      }))

      // セッション一覧を更新
      onSessionsUpdate()
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('メッセージの送信に失敗しました')
    } finally {
      setSendingMessages(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionId)
        return newSet
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(sessionId)
    }
  }

  const navigateToChat = (sessionId: string) => {
    // AgentAPIチャット画面への遷移
    router.push(`/agentapi?session=${sessionId}`)
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('このセッションを削除してもよろしいですか？')) return

    try {
      setDeletingSession(sessionId)
      
      const client = createAgentAPIClientFromStorage()
      await client.deleteSession(sessionId)

      // セッション一覧を更新
      fetchSessions()
      onSessionsUpdate()
    } catch (err) {
      console.error('Failed to delete session:', err)
      setError('セッションの削除に失敗しました')
    } finally {
      setDeletingSession(null)
    }
  }

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          セッション一覧 ({filteredSessions.length})
        </h3>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
        >
          {loading ? '更新中...' : '更新'}
        </button>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            セッションが見つかりません
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {sessions.length === 0
              ? '新しいセッションを開始してください。'
              : 'フィルタ条件に一致するセッションがありません。'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session.session_id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
            >
              {/* セッション概要と状態 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={session.status} />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(session.updated_at)}
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    {(() => {
                      const description = String(sessionMessages[session.session_id] || session.metadata?.description || 'No description available')
                      const displayText = expandedDescriptions.has(session.session_id) 
                        ? description
                        : truncateText(description)
                      const hasLongDescription = description.length > 100
                      
                      return (
                        <p className="text-gray-900 dark:text-white">
                          {displayText}
                          {hasLongDescription && (
                            <button
                              onClick={() => toggleDescription(session.session_id)}
                              className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                            >
                              {expandedDescriptions.has(session.session_id) ? '閉じる' : '続きを読む'}
                            </button>
                          )}
                        </p>
                      )
                    })()}
                  </div>

                  {/* メタデータタグ */}
                  {session.metadata && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {Object.entries(session.metadata).map(([key, value]) => {
                        if (key === 'description') return null
                        return (
                          <span
                            key={key}
                            className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full"
                          >
                            {key}: {String(value)}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* アクションボタン */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => navigateToChat(session.session_id)}
                    className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    チャット
                  </button>
                  <button
                    onClick={() => deleteSession(session.session_id)}
                    disabled={deletingSession === session.session_id}
                    className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors disabled:cursor-not-allowed"
                  >
                    {deletingSession === session.session_id ? '削除中...' : '削除'}
                  </button>
                </div>
              </div>

              {/* メッセージ送信エリア */}
              <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  value={messageInputs[session.session_id] || ''}
                  onChange={(e) => handleMessageInputChange(session.session_id, e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, session.session_id)}
                  placeholder="追加のメッセージを入力..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  disabled={sendingMessages.has(session.session_id) || session.status === 'error'}
                />
                <button
                  onClick={() => sendMessage(session.session_id)}
                  disabled={
                    !messageInputs[session.session_id]?.trim() || 
                    sendingMessages.has(session.session_id) ||
                    session.status === 'error'
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors"
                >
                  {sendingMessages.has(session.session_id) ? '送信中...' : '送信'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}