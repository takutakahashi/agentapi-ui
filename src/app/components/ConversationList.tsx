'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Session, SessionListParams } from '../../types/agentapi'
import { createAgentAPIProxyClientFromStorage, AgentAPIProxyError } from '../../lib/agentapi-proxy-client'
import { ProfileManager } from '../../utils/profileManager'
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

interface PageState {
  page: number
  limit: number
}

export default function ConversationList() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Extract repository from query parameters
  const repositoryParam = searchParams.get('repository')
  
  // Get current profile and create profile-aware client
  const [currentProfile, setCurrentProfile] = useState(() => ProfileManager.getDefaultProfile())
  const [agentAPI, setAgentAPI] = useState(() => createAgentAPIProxyClientFromStorage(repositoryParam || undefined, currentProfile?.id))
  
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
  const [sidebarVisible, setSidebarVisible] = useState(false)

  // Extract filter groups from all sessions
  const filterGroups = extractFilterGroups(allSessions)
  
  // Apply filters to get filtered sessions
  const filteredSessions = applySessionFilters(allSessions, sessionFilters)
  
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

      // Fetch all sessions (or a large number) to enable client-side filtering
      // TODO: When backend supports metadata filtering, add those params here
      const params: SessionListParams = {
        limit: 1000, // Fetch many sessions for client-side filtering
      }

      const response = await agentAPI.search(params)
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
  }, [agentAPI])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

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
      
      await agentAPI.start({
        ...metadata,
        description: quickStartMessage.trim(),
        environment: {
          ...environment,
          // Add any default environment variables if needed
        }
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

  // Initialize filters from URL on mount
  useEffect(() => {
    const urlFilters = parseFiltersFromURL(searchParams)
    setSessionFilters(urlFilters)
  }, [searchParams])

  // Listen for profile changes and recreate client
  useEffect(() => {
    const handleProfileChange = (event: CustomEvent) => {
      const newProfileId = event.detail.profileId
      const newProfile = ProfileManager.getProfile(newProfileId)
      
      if (newProfile) {
        setCurrentProfile(newProfile)
        setAgentAPI(createAgentAPIProxyClientFromStorage(repositoryParam || undefined, newProfile.id))
        // Refresh sessions with new profile settings
        fetchSessions()
      }
    }

    window.addEventListener('profileChanged', handleProfileChange as EventListener)
    
    return () => {
      window.removeEventListener('profileChanged', handleProfileChange as EventListener)
    }
  }, [repositoryParam, fetchSessions])

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

        {/* Filter Summary Bar */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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
            
            <button
              onClick={fetchSessions}
              disabled={loading}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
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