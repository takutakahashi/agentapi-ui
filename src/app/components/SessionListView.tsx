'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Session, AgentStatus } from '../../types/agentapi'
import { createAgentAPIProxyClientFromStorage, AgentAPIProxyError, AgentAPIProxyClient } from '../../lib/agentapi-proxy-client'
import { ProfileManager } from '../../utils/profileManager'
import StatusBadge from './StatusBadge'
import { useBackgroundAwareInterval } from '../hooks/usePageVisibility'
import { formatRelativeTime } from '../../utils/timeUtils'
import { truncateText } from '../../utils/textUtils'

interface TagFilter {
  [key: string]: string[]
}

interface CreatingSession {
  id: string
  message: string
  repository?: string
  status: 'creating' | 'waiting-agent' | 'sending-message' | 'completed' | 'failed'
  startTime: Date
}

interface SessionListViewProps {
  tagFilters: TagFilter
  onSessionsUpdate: () => void
  creatingSessions: CreatingSession[]
}

export default function SessionListView({ tagFilters, onSessionsUpdate, creatingSessions }: SessionListViewProps) {
  const router = useRouter()
  
  // Get current profile and create profile-aware clients
  const [currentProfile, setCurrentProfile] = useState(() => ProfileManager.getDefaultProfile())
  const [agentAPI, setAgentAPI] = useState(() => createAgentAPIProxyClientFromStorage(undefined, currentProfile?.id))
  const [agentAPIProxy, setAgentAPIProxy] = useState(() => createAgentAPIProxyClientFromStorage(undefined, currentProfile?.id))
  
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingSession, setDeletingSession] = useState<string | null>(null)
  const [sessionMessages, setSessionMessages] = useState<{ [sessionId: string]: string }>({})
  const [isMobile, setIsMobile] = useState(false)
  const [sessionAgentStatus, setSessionAgentStatus] = useState<{ [sessionId: string]: AgentStatus }>({})

  const fetchSessionStatusesInitial = useCallback(async (sessionList: Session[]) => {
    if (sessionList.length === 0 || !agentAPIProxy) return
    
    try {
      // セッション数を制限してAPIコールを削減（最新5セッションのみ）
      const limitedSessions = sessionList.slice(0, 5)
      
      // 各セッションのエージェント状態を並列で取得
      const statusPromises = limitedSessions.map(async (session) => {
        try {
          const status = await agentAPIProxy.getSessionStatus(session.session_id)
          return { sessionId: session.session_id, status }
        } catch (err) {
          console.warn(`Failed to fetch status for session ${session.session_id}:`, err)
          // エラーの場合はセッションステータスからデフォルト値を推測
          return {
            sessionId: session.session_id,
            status: {
              status: session.status === 'active' ? 'stable' : 'error',
              last_activity: session.updated_at,
              current_task: undefined
            } as AgentStatus
          }
        }
      })
      
      const statusResults = await Promise.all(statusPromises)
      const statusMap: { [sessionId: string]: AgentStatus } = {}
      
      // 制限されたセッションの結果を設定
      statusResults.forEach(result => {
        statusMap[result.sessionId] = result.status
      })
      
      // 残りのセッションにはデフォルト値を設定（APIコールなし）
      sessionList.slice(5).forEach(session => {
        statusMap[session.session_id] = {
          status: session.status === 'active' ? 'stable' : 'error',
          last_activity: session.updated_at,
          current_task: undefined
        } as AgentStatus
      })
      
      setSessionAgentStatus(statusMap)
    } catch (err) {
      console.warn('Failed to fetch initial session statuses:', err)
    }
  }, [agentAPIProxy])

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await agentAPI.search!({ limit: 1000 })
      const sessionList = response.sessions || []
      setSessions(sessionList)

      // 各セッションの初期メッセージを取得
      const messagePromises = sessionList.map(async (session) => {
        try {
          const messages = await agentAPI.getSessionMessages!(session.session_id, { limit: 10 })
          const userMessages = messages.messages.filter(msg => msg.role === 'user')
          if (userMessages.length > 0) {
            // システムプロンプトを除去したユーザーメッセージのみを取得
            const userMessage = extractUserMessage(userMessages[0].content)
            return { sessionId: session.session_id, message: userMessage }
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
      
      // 初期表示時にすぐにエージェントステータスを取得
      if (sessionList.length > 0) {
        await fetchSessionStatusesInitial(sessionList)
      }
    } catch (err) {
      if (err instanceof AgentAPIProxyError) {
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
      
      // モックデータでもエージェントステータスを初期設定
      if (mockSessions.length > 0) {
        await fetchSessionStatusesInitial(mockSessions)
      }
    } finally {
      setLoading(false)
    }
  }, [agentAPI, fetchSessionStatusesInitial])

  const fetchSessionStatuses = useCallback(async () => {
    if (sessions.length === 0 || !agentAPIProxy) return
    
    try {
      // セッション数を制限してAPIコールを削減（最新5セッションのみ）
      const limitedSessions = sessions.slice(0, 5)
      
      // 各セッションのエージェント状態を並列で取得
      const statusPromises = limitedSessions.map(async (session) => {
        try {
          const status = await agentAPIProxy.getSessionStatus(session.session_id)
          return { sessionId: session.session_id, status }
        } catch (err) {
          console.warn(`Failed to fetch status for session ${session.session_id}:`, err)
          // エラーの場合はセッションステータスからデフォルト値を推測
          return {
            sessionId: session.session_id,
            status: {
              status: session.status === 'active' ? 'stable' : 'error',
              last_activity: session.updated_at,
              current_task: undefined
            } as AgentStatus
          }
        }
      })
      
      const statusResults = await Promise.all(statusPromises)
      const statusMap: { [sessionId: string]: AgentStatus } = {}
      
      // 制限されたセッションの結果を設定
      statusResults.forEach(result => {
        statusMap[result.sessionId] = result.status
      })
      
      // 残りのセッションにはデフォルト値を設定（APIコールなし）
      sessions.slice(5).forEach(session => {
        statusMap[session.session_id] = {
          status: session.status === 'active' ? 'stable' : 'error',
          last_activity: session.updated_at,
          current_task: undefined
        } as AgentStatus
      })
      
      setSessionAgentStatus(statusMap)
    } catch (err) {
      console.warn('Failed to fetch session statuses:', err)
    }
  }, [sessions, agentAPIProxy])

  // バックグラウンド対応の定期更新フック
  const statusPollingControl = useBackgroundAwareInterval(fetchSessionStatuses, 10000, false)

  const getAgentStatusDisplayInfo = (agentStatus: AgentStatus | undefined) => {
    if (!agentStatus) {
      return { text: 'Unknown', colorClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' }
    }
    
    switch (agentStatus.status) {
      case 'stable':
        return { text: 'Available', colorClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
      case 'running':
        return { text: 'Running', colorClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' }
      case 'error':
        return { text: 'Error', colorClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
      default:
        return { text: 'Unknown', colorClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' }
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // エージェントステータスを定期的に更新
  useEffect(() => {
    if (sessions.length > 0) {
      statusPollingControl.start()
    } else {
      statusPollingControl.stop()
    }
    
    return () => {
      statusPollingControl.stop()
    }
  }, [sessions.length, statusPollingControl])


  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Listen for profile changes and recreate clients
  useEffect(() => {
    const handleProfileChange = (event: CustomEvent) => {
      const newProfileId = event.detail.profileId
      const newProfile = ProfileManager.getProfile(newProfileId)
      
      if (newProfile && newProfile.id !== currentProfile?.id) {
        setCurrentProfile(newProfile)
        const newClient = createAgentAPIProxyClientFromStorage(undefined, newProfile.id)
        setAgentAPI(newClient)
        setAgentAPIProxy(newClient)
        
        // Helper function to extract user message
        const extractUserMessageLocal = (combinedMessage: string) => {
          const separator = '\n\n---\n\n'
          const separatorIndex = combinedMessage.indexOf(separator)
          
          if (separatorIndex !== -1) {
            return combinedMessage.substring(separatorIndex + separator.length).trim()
          }
          
          return combinedMessage
        }

        // Helper function to get mock sessions
        const getMockSessionsLocal = (): Session[] => []

        // Helper function to fetch session statuses with specific client
        const fetchSessionStatusesInitialWithClient = async (sessionList: Session[], client: AgentAPIProxyClient) => {
          if (sessionList.length === 0 || !client) return
          
          try {
            // セッション数を制限してAPIコールを削減（最新5セッションのみ）
            const limitedSessions = sessionList.slice(0, 5)
            
            // 各セッションのエージェント状態を並列で取得
            const statusPromises = limitedSessions.map(async (session) => {
              try {
                const status = await client.getSessionStatus(session.session_id)
                return { sessionId: session.session_id, status }
              } catch (err) {
                console.warn(`Failed to fetch status for session ${session.session_id}:`, err)
                // エラーの場合はセッションステータスからデフォルト値を推測
                return {
                  sessionId: session.session_id,
                  status: {
                    status: session.status === 'active' ? 'stable' : 'error',
                    last_activity: session.updated_at,
                    current_task: undefined
                  } as AgentStatus
                }
              }
            })
            
            const statusResults = await Promise.all(statusPromises)
            const statusMap: { [sessionId: string]: AgentStatus } = {}
            
            // 制限されたセッションの結果を設定
            statusResults.forEach(result => {
              statusMap[result.sessionId] = result.status
            })
            
            // 残りのセッションにはデフォルト値を設定（APIコールなし）
            sessionList.slice(5).forEach(session => {
              statusMap[session.session_id] = {
                status: session.status === 'active' ? 'stable' : 'error',
                last_activity: session.updated_at,
                current_task: undefined
              } as AgentStatus
            })
            
            setSessionAgentStatus(statusMap)
          } catch (err) {
            console.warn('Failed to fetch initial session statuses with client:', err)
          }
        }

        // Directly call fetchSessions with the new API client
        const fetchSessionsWithNewAPI = async () => {
          try {
            setLoading(true)
            setError(null)

            const response = await newClient.search!({ limit: 1000 })
            const sessionList = response.sessions || []
            setSessions(sessionList)

            // 各セッションの初期メッセージを取得
            const messagePromises = sessionList.map(async (session) => {
              try {
                const messages = await newClient.getSessionMessages!(session.session_id, { limit: 10 })
                const userMessages = messages.messages.filter(msg => msg.role === 'user')
                if (userMessages.length > 0) {
                  // システムプロンプトを除去したユーザーメッセージのみを取得
                  const userMessage = extractUserMessageLocal(userMessages[0].content)
                  return { sessionId: session.session_id, message: userMessage }
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
            
            // 初期表示時にすぐにエージェントステータスを取得
            if (sessionList.length > 0) {
              await fetchSessionStatusesInitialWithClient(sessionList, newClient)
            }
          } catch (err) {
            if (err instanceof AgentAPIProxyError) {
              setError(`Failed to load sessions: ${err.message}`)
            } else {
              setError('An unexpected error occurred while loading sessions')
            }
            
            // モックデータを使用
            const mockSessions = getMockSessionsLocal()
            setSessions(mockSessions)
            
            // モックセッションの初期メッセージを設定
            const mockMessages: { [sessionId: string]: string } = {}
            mockSessions.forEach(session => {
              mockMessages[session.session_id] = String(session.metadata?.description || 'No description available')
            })
            setSessionMessages(mockMessages)
            
            // モックデータでもエージェントステータスを初期設定
            if (mockSessions.length > 0) {
              await fetchSessionStatusesInitialWithClient(mockSessions, newClient)
            }
          } finally {
            setLoading(false)
          }
        }
        
        fetchSessionsWithNewAPI()
      }
    }

    window.addEventListener('profileChanged', handleProfileChange as EventListener)
    
    return () => {
      window.removeEventListener('profileChanged', handleProfileChange as EventListener)
    }
  }, [currentProfile?.id])

  const getMockSessions = (): Session[] => []

  // タグフィルタを適用してセッションをフィルタリング
  const filteredSessions = sessions.filter(session => {
    return Object.entries(tagFilters).every(([tagKey, selectedValues]) => {
      if (selectedValues.length === 0) return true
      
      // First check tags field
      const sessionTagValue = session.tags?.[tagKey]
      if (sessionTagValue && selectedValues.includes(sessionTagValue)) {
        return true
      }
      
      // Fallback to metadata for backward compatibility
      const sessionMetadataValue = session.metadata?.[tagKey]
      return sessionMetadataValue && selectedValues.includes(String(sessionMetadataValue))
    })
  })

  // ページネーション
  const pageState = { page: 1, limit: 20 }
  const paginatedSessions = filteredSessions.slice(
    (pageState.page - 1) * pageState.limit,
    pageState.page * pageState.limit
  )
  const totalPages = Math.ceil(filteredSessions.length / pageState.limit)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePageChange = (_newPage: number) => {
    // ページ変更の実装は省略（既存の実装があれば使用）
  }


  const navigateToChat = (sessionId: string) => {
    // AgentAPIチャット画面への遷移
    router.push(`/agentapi?session=${sessionId}`)
  }


  const deleteSession = async (sessionId: string) => {
    if (!confirm('このセッションを削除してもよろしいですか？')) return

    try {
      setDeletingSession(sessionId)
      
      await agentAPI.delete!(sessionId)

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

  const extractUserMessage = (combinedMessage: string) => {
    // システムプロンプトと初期メッセージが結合されている場合（\n\n---\n\n で区切られている）
    const separator = '\n\n---\n\n'
    const separatorIndex = combinedMessage.indexOf(separator)
    
    if (separatorIndex !== -1) {
      // セパレータが見つかった場合、セパレータより後の部分を返す
      return combinedMessage.substring(separatorIndex + separator.length).trim()
    }
    
    // セパレータが見つからない場合、元のメッセージをそのまま返す
    return combinedMessage
  }


  const getStatusText = (status: CreatingSession['status']) => {
    switch (status) {
      case 'creating': return 'セッション作成中...'
      case 'waiting-agent': return 'エージェント準備中...'
      case 'sending-message': return 'メッセージ送信中...'
      case 'completed': return '完了'
      case 'failed': return '失敗'
      default: return '処理中...'
    }
  }

  const getStatusColor = (status: CreatingSession['status']) => {
    switch (status) {
      case 'creating': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'waiting-agent': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'sending-message': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
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
          セッション一覧 ({filteredSessions.length + creatingSessions.length})
        </h3>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
        >
          {loading ? '更新中...' : '更新'}
        </button>
      </div>

      {/* 作成中セッション */}
      {creatingSessions.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
            作成中のセッション ({creatingSessions.length})
          </h4>
          {creatingSessions.map((creatingSession) => (
            <div
              key={creatingSession.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(creatingSession.status)}`}>
                      {getStatusText(creatingSession.status)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(creatingSession.startTime.toISOString())}
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <p className="text-gray-900 dark:text-white">
                      {truncateText(creatingSession.message)}
                    </p>
                  </div>

                  {/* リポジトリタグ */}
                  {creatingSession.repository && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">
                        repository: {creatingSession.repository}
                      </span>
                    </div>
                  )}
                </div>

                {/* ステータスアイコン */}
                {creatingSession.status === 'failed' ? (
                  <div className="ml-4">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium">セットアップに失敗しました</span>
                    </div>
                  </div>
                ) : creatingSession.status !== 'completed' ? (
                  <div className="ml-4">
                    <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredSessions.length === 0 && creatingSessions.length === 0 ? (
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
            {sessions.length === 0 && creatingSessions.length === 0
              ? '新しいセッションを開始してください。'
              : 'フィルタ条件に一致するセッションがありません。'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 既存セッション */}
          {filteredSessions.length > 0 && (
            <div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedSessions.map((session) => (
                  <div
                    key={session.session_id}
                    className="px-3 py-4 sm:px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        {/* タイトルとステータス */}
                        <div className="flex items-start gap-3 mb-2">
                          <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white leading-5 sm:leading-6">
                            {truncateText(String(sessionMessages[session.session_id] || session.metadata?.description || 'No description available'), isMobile ? 60 : 80)}
                          </h3>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={session.status} />
                            {sessionAgentStatus[session.session_id] && (
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                sessionAgentStatus[session.session_id].status === 'running'
                                  ? 'bg-yellow-500 animate-pulse'
                                  : sessionAgentStatus[session.session_id].status === 'stable'
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              }`} title={`Agent: ${getAgentStatusDisplayInfo(sessionAgentStatus[session.session_id]).text}`} />
                            )}
                          </div>
                        </div>

                        {/* セッション情報 */}
                        <div className="flex flex-col sm:flex-row sm:items-center text-xs text-gray-500 dark:text-gray-400 space-y-1 sm:space-y-0 sm:space-x-4 mb-3">
                          <span>#{session.session_id.substring(0, 8)}</span>
                          <div className="flex items-center space-x-2 sm:space-x-4">
                            <span>作成: {formatRelativeTime(session.created_at)}</span>
                            <span className="hidden sm:inline">更新: {formatRelativeTime(session.updated_at)}</span>
                            {sessionAgentStatus[session.session_id]?.last_activity && (
                              <span className="hidden sm:inline">Agent活動: {formatRelativeTime(sessionAgentStatus[session.session_id].last_activity!)}</span>
                            )}
                            {sessionAgentStatus[session.session_id]?.current_task && (
                              <span className="hidden sm:inline text-blue-600 dark:text-blue-400">タスク: {sessionAgentStatus[session.session_id].current_task!.substring(0, 30)}...</span>
                            )}
                          </div>
                          <span className="hidden sm:inline">by {session.user_id}</span>
                          {session.environment?.WORKSPACE_NAME && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 self-start">
                              {session.environment.WORKSPACE_NAME}
                            </span>
                          )}
                        </div>

                        {/* タグとメタデータの表示 - モバイルでは最大2個まで表示 */}
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {/* Tags field (priority display) */}
                          {session.tags && Object.entries(session.tags)
                            .slice(0, isMobile ? 2 : 5)
                            .map(([key, value]) => (
                              <span
                                key={`tag-${key}`}
                                className="inline-flex items-center px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full"
                              >
                                <span className="hidden sm:inline">{key}: </span>
                                <span className="sm:hidden">{key.substring(0, 8)}: </span>
                                {value.substring(0, isMobile ? 8 : 20)}
                              </span>
                            ))}
                          
                          {/* Metadata (fallback/additional info) */}
                          {session.metadata && Object.entries(session.metadata)
                            .filter(([key]) => key !== 'description')
                            .slice(0, Math.max(0, (isMobile ? 2 : 10) - (session.tags ? Object.keys(session.tags).length : 0)))
                            .map(([key, value]) => (
                              <span
                                key={`meta-${key}`}
                                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
                              >
                                <span className="hidden sm:inline">{key}: </span>
                                <span className="sm:hidden">{key.substring(0, 8)}: </span>
                                {String(value).substring(0, isMobile ? 8 : 20)}
                              </span>
                            ))}
                          
                          {/* Show "more" indicator if there are additional tags/metadata */}
                          {(() => {
                            const totalTags = (session.tags ? Object.keys(session.tags).length : 0) + 
                                            (session.metadata ? Object.entries(session.metadata).filter(([key]) => key !== 'description').length : 0)
                            const displayed = isMobile ? 2 : 10
                            return totalTags > displayed && isMobile && (
                              <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 rounded-full">
                                +{totalTags - displayed}
                              </span>
                            )
                          })()}
                        </div>
                      </div>

                      {/* アクションボタン - モバイルでは縦並び */}
                      <div className="flex flex-row sm:flex-row items-center space-x-2 sm:space-x-2 sm:ml-4">
                        {session.status === 'active' && (
                          <button
                            onClick={() => navigateToChat(session.session_id)}
                            className="inline-flex items-center justify-center px-3 py-2 sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors min-h-[44px] sm:min-h-0"
                          >
                            <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span className="hidden sm:inline">チャット</span>
                          </button>
                        )}
                        
                        {session.metadata?.pr_url ? (
                          <a
                            href={String(session.metadata.pr_url).replace(/\s+/g, '')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-3 py-2 sm:px-3 sm:py-1.5 border border-purple-300 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-700 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-md transition-colors min-h-[44px] sm:min-h-0"
                          >
                            <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span className="hidden sm:inline">PR表示</span>
                          </a>
                        ) : null}
                        
                        {session.metadata?.claude_login_url ? (
                          <a
                            href={String(session.metadata.claude_login_url).replace(/\s+/g, '')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-3 py-2 sm:px-3 sm:py-1.5 border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-md transition-colors min-h-[44px] sm:min-h-0"
                          >
                            <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="hidden sm:inline">ログイン</span>
                          </a>
                        ) : null}
                        
                        <button
                          onClick={() => deleteSession(session.session_id)}
                          disabled={deletingSession === session.session_id}
                          aria-label={`${deletingSession === session.session_id ? '削除中' : '削除'}: ${sessionMessages[session.session_id] || session.metadata?.description || `セッション ${session.session_id.substring(0, 8)}`}`}
                          className="inline-flex items-center justify-center px-3 py-2 sm:px-3 sm:py-1.5 border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-700 text-red-700 dark:text-red-300 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
                        >
                          {deletingSession === session.session_id ? (
                            <svg className="animate-spin w-4 h-4 sm:mr-1.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          <span className="hidden sm:inline">{deletingSession === session.session_id ? '削除中...' : '削除'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handlePageChange(pageState.page - 1)}
                    disabled={pageState.page === 1}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  
                  <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                    Page {pageState.page} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(pageState.page + 1)}
                    disabled={pageState.page === totalPages}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Next
                  </button>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}