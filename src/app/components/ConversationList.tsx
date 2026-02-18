'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Session, SessionListParams } from '../../types/agentapi'
import { createAgentAPIProxyClientFromStorage, AgentAPIProxyError } from '../../lib/agentapi-proxy-client'
import {
  extractFilterGroups,
  applySessionFilters,
  parseFiltersFromURL,
  filtersToURLParams,
  getFilterValuesForSessionCreation,
  SessionFilter
} from '../../lib/filter-utils'
import SessionCard from './SessionCard'
import LoadingSpinner from './LoadingSpinner'
import NewConversationModal from './NewConversationModal'
import SessionFilterSidebar from './SessionFilterSidebar'
import { useTeamScope } from '../../contexts/TeamScopeContext'

interface PageState {
  page: number
  limit: number
}

type SortField = 'started_at' | 'updated_at'
type SortOrder = 'asc' | 'desc'

export default function ConversationList() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { selectedTeam } = useTeamScope()

  // Extract repository from query parameters
  const repositoryParam = searchParams.get('repository')

  // Create global API client
  const [agentAPI] = useState(() => createAgentAPIProxyClientFromStorage(repositoryParam || undefined))

  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionFilters, setSessionFilters] = useState<SessionFilter>(() => parseFiltersFromURL(searchParams))
  const [pageState, setPageState] = useState<PageState>({
    page: 1,
    limit: 20
  })
  const [showNewConversationModal, setShowNewConversationModal] = useState(false)
  const [quickStartMessage, setQuickStartMessage] = useState('')
  const [isCreatingQuickSession, setIsCreatingQuickSession] = useState(false)
  const [deletingSession, setDeletingSession] = useState<string | null>(null)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [sortBy, setSortBy] = useState<SortField>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('conversationListSortBy') as SortField) || 'updated_at'
    }
    return 'updated_at'
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('conversationListSortOrder') as SortOrder) || 'desc'
    }
    return 'desc'
  })

  // Extract filter groups from all sessions
  const filterGroups = extractFilterGroups(allSessions)

  // Apply filters to get filtered sessions
  const filteredSessionsBeforeSort = applySessionFilters(allSessions, sessionFilters)

  // Apply sorting
  const filteredSessions = [...filteredSessionsBeforeSort].sort((a, b) => {
    const aValue = a[sortBy] || ''
    const bValue = b[sortBy] || ''

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  // Apply pagination to filtered sessions
  const paginatedSessions = filteredSessions.slice(
    (pageState.page - 1) * pageState.limit,
    pageState.page * pageState.limit
  )

  const totalPages = Math.ceil(filteredSessions.length / pageState.limit)

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Compute scope parameters directly from selectedTeam to avoid stale closure
      const scopeParams: { scope: 'user' | 'team'; team_id?: string } = selectedTeam
        ? { scope: 'team', team_id: selectedTeam }
        : { scope: 'user' }

      console.log('[ConversationList] Fetching sessions with scope params:', scopeParams)

      // Fetch all sessions (or a large number) to enable client-side filtering
      // TODO: When backend supports metadata filtering, add those params here
      const params: SessionListParams = {
        limit: 1000, // Fetch many sessions for client-side filtering
        ...scopeParams,
      }

      const response = await agentAPI.search(params)
      console.log('[ConversationList] Received sessions:', response.sessions?.length || 0)
      setAllSessions(response.sessions || [])
    } catch (err) {
      if (err instanceof AgentAPIProxyError) {
        setError(`Failed to load sessions: ${err.message}`)
      } else {
        setError('An unexpected error occurred while loading sessions')
      }

      // Set mock data for demo purposes when API is not available
      setAllSessions(getMockSessions())
    } finally {
      setLoading(false)
    }
  }, [agentAPI, selectedTeam])

  // Refetch sessions when team scope changes
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions, selectedTeam])

  const getMockSessions = (): Session[] => []

  // Update URL when filters change
  const updateURL = useCallback((filters: SessionFilter) => {
    const params = filtersToURLParams(filters)
    const newURL = params.toString() ? `?${params.toString()}` : '/chats'
    router.replace(newURL, { scroll: false })
  }, [router])

  const handleFiltersChange = (newFilters: SessionFilter) => {
    setSessionFilters(newFilters)
    setPageState(prev => ({ ...prev, page: 1 })) // Reset to first page
    updateURL(newFilters)
  }

  const handlePageChange = (newPage: number) => {
    setPageState(prev => ({ ...prev, page: newPage }))
  }

  const handleNewConversationSuccess = () => {
    // Refresh the session list to show the new session
    fetchSessions()
  }

  const handleQuickStart = async () => {
    if (!quickStartMessage.trim()) return

    try {
      setIsCreatingQuickSession(true)
      setError(null)

      // Get current filter values to use as default parameters for new session
      const { metadata, environment } = getFilterValuesForSessionCreation(sessionFilters)

      // Compute scope parameters directly from selectedTeam
      const scopeParams: { scope: 'user' | 'team'; team_id?: string } = selectedTeam
        ? { scope: 'team', team_id: selectedTeam }
        : { scope: 'user' }

      console.log('[ConversationList] Creating session with scope params:', scopeParams)

      await agentAPI.start({
        metadata: {
          ...metadata,
          description: quickStartMessage.trim()
        },
        environment: {
          ...environment
        },
        params: {
          message: quickStartMessage.trim()
        },
        ...scopeParams
      })

      setQuickStartMessage('')
      fetchSessions() // Refresh the session list
    } catch (err) {
      if (err instanceof AgentAPIProxyError) {
        setError(`Failed to start session: ${err.message}`)
      } else {
        setError('An unexpected error occurred while starting session')
      }
    } finally {
      setIsCreatingQuickSession(false)
    }
  }

  const handleQuickStartKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleQuickStart()
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('このセッションを削除してもよろしいですか？')) return

    try {
      setDeletingSession(sessionId)

      await agentAPI.delete(sessionId)

      // セッション一覧を更新
      fetchSessions()
    } catch (err) {
      console.error('Failed to delete session:', err)
      setError('セッションの削除に失敗しました')
    } finally {
      setDeletingSession(null)
    }
  }

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedSessions.size === paginatedSessions.length && paginatedSessions.length > 0) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(paginatedSessions.map(s => s.session_id)))
    }
  }

  const deleteSelectedSessions = async () => {
    const count = selectedSessions.size
    if (count === 0) return
    if (!confirm(`${count}件のセッションを削除してもよろしいですか？`)) return

    try {
      setIsBulkDeleting(true)
      setError(null)

      await agentAPI.deleteBatch(Array.from(selectedSessions))

      setSelectedSessions(new Set())
      fetchSessions()
    } catch (err) {
      console.error('Failed to bulk delete sessions:', err)
      setError('セッションの一括削除に失敗しました')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Initialize filters from URL on mount
  useEffect(() => {
    const urlFilters = parseFiltersFromURL(searchParams)
    setSessionFilters(urlFilters)
  }, [searchParams])

  // ソート設定を localStorage に保存
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('conversationListSortBy', sortBy)
    }
  }, [sortBy])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('conversationListSortOrder', sortOrder)
    }
  }, [sortOrder])


  if (loading && allSessions.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="flex">
      {/* Sidebar */}
      <SessionFilterSidebar
        filterGroups={filterGroups}
        currentFilters={sessionFilters}
        onFiltersChange={handleFiltersChange}
        isVisible={sidebarVisible}
        onToggleVisibility={() => setSidebarVisible(!sidebarVisible)}
      />
      
      {/* Main Content */}
      <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Quick Start Input */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={quickStartMessage}
            onChange={(e) => setQuickStartMessage(e.target.value)}
            onKeyPress={handleQuickStartKeyPress}
            placeholder="Type your message to start a new session..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            disabled={isCreatingQuickSession}
          />
          <button
            onClick={handleQuickStart}
            disabled={!quickStartMessage.trim() || isCreatingQuickSession}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isCreatingQuickSession ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Starting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Start
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Press Enter or click Start to begin a new conversation session
        </p>
      </div>

      {/* Header with New Conversation Button */}
      <div className="flex justify-between items-center">
        <div></div>
        <button
          onClick={() => setShowNewConversationModal(true)}
          className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
          </svg>
          Advanced Options
        </button>
      </div>

        {/* 一括操作バー */}
        {selectedSessions.size > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {selectedSessions.size}件選択中
              </span>
              <button
                onClick={() => setSelectedSessions(new Set())}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
              >
                選択解除
              </button>
            </div>
            <button
              onClick={deleteSelectedSessions}
              disabled={isBulkDeleting}
              className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              {isBulkDeleting ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  削除中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  選択したセッションを削除
                </>
              )}
            </button>
          </div>
        )}

        {/* Filter Summary Bar */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paginatedSessions.length > 0 && selectedSessions.size === paginatedSessions.length}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selectedSessions.size > 0 && selectedSessions.size < paginatedSessions.length
                    }
                  }}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                  aria-label="全て選択"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">全て選択</span>
              </label>

              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                </svg>
                {sidebarVisible ? 'Hide Filters' : 'Show Filters'}
              </button>

              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredSessions.length} of {allSessions.length} sessions
                {sessionFilters.status && ` • Status: ${sessionFilters.status}`}
                {Object.keys(sessionFilters.metadataFilters).length > 0 && ` • ${Object.keys(sessionFilters.metadataFilters).length} metadata filters`}
                {Object.keys(sessionFilters.environmentFilters).length > 0 && ` • ${Object.keys(sessionFilters.environmentFilters).length} environment filters`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort Controls */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="started_at">開始日時順</option>
                <option value="updated_at">更新日時順</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="inline-flex items-center justify-center px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                title={sortOrder === 'asc' ? '昇順' : '降順'}
              >
                {sortOrder === 'asc' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
              <button
                onClick={fetchSessions}
                disabled={loading}
                className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 font-medium"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? '更新中...' : '更新'}
              </button>
            </div>
          </div>
        </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
          </div>
        </div>
      )}

        {/* Session List */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          {paginatedSessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                No sessions found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {allSessions.length === 0
                  ? 'Start a new session to see it here.'
                  : 'No sessions match the current filters. Try adjusting your filters.'
                }
              </p>
            </div>
          ) : (
            <div>
              {paginatedSessions.map((session) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  onDelete={deleteSession}
                  isDeleting={deletingSession === session.session_id}
                  isSelected={selectedSessions.has(session.session_id)}
                  onToggleSelect={toggleSessionSelection}
                />
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
          )}
        </div>

        {/* New Conversation Modal */}
        <NewConversationModal
          isOpen={showNewConversationModal}
          onClose={() => setShowNewConversationModal(false)}
          onSuccess={handleNewConversationSuccess}
          currentFilters={sessionFilters}
          initialRepository={repositoryParam || undefined}
        />
      </div>
    </div>
  )
}