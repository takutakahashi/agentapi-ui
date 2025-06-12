'use client'

import { useState, useEffect, useCallback } from 'react'
import { Session, SessionListParams } from '../../types/agentapi'
import { createAgentAPIClientFromStorage, AgentAPIError } from '../../lib/agentapi-client'
import SessionCard from './SessionCard'
import LoadingSpinner from './LoadingSpinner'
import NewConversationModal from './NewConversationModal'

interface FilterState {
  status: Session['status'] | 'all'
  page: number
  limit: number
}

export default function ConversationList() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalSessions, setTotalSessions] = useState(0)
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    page: 1,
    limit: 20
  })
  const [showNewConversationModal, setShowNewConversationModal] = useState(false)

  const statusOptions: Array<{ value: Session['status'] | 'all'; label: string; count?: number }> = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'error', label: 'Error' },
  ]

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const client = createAgentAPIClientFromStorage()
      const params: SessionListParams = {
        page: filters.page,
        limit: filters.limit,
        ...(filters.status !== 'all' && { status: filters.status }),
      }

      const response = await client.getSessions(params)
      setSessions(response.sessions)
      setTotalSessions(response.total)
    } catch (err) {
      if (err instanceof AgentAPIError) {
        setError(`Failed to load sessions: ${err.message}`)
      } else {
        setError('An unexpected error occurred while loading sessions')
      }
      
      // Set mock data for demo purposes when API is not available
      setSessions(getMockSessions())
      setTotalSessions(getMockSessions().length)
    } finally {
      setLoading(false)
    }
  }, [filters])

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
        description: 'Code review session for React architecture'
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
        description: 'REST API integration assistance'
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
        description: 'Database schema design session'
      }
    },
    {
      session_id: 'session-004',
      user_id: 'user-diana',
      status: 'inactive',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      environment: {
        GITHUB_TOKEN: '***',
        WORKSPACE_NAME: 'testing-strategy'
      },
      metadata: {
        description: 'Frontend testing strategy discussion'
      }
    },
    {
      session_id: 'session-005',
      user_id: 'user-eve',
      status: 'inactive',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      environment: {
        GITHUB_TOKEN: '***',
        WORKSPACE_NAME: 'performance-optimization'
      },
      metadata: {
        description: 'Performance optimization session'
      }
    }
  ]

  const handleStatusFilter = (status: Session['status'] | 'all') => {
    setFilters(prev => ({ ...prev, status, page: 1 }))
  }

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  const handleNewConversationSuccess = () => {
    // Refresh the session list to show the new session
    fetchSessions()
  }

  const filteredSessions = filters.status === 'all' 
    ? (sessions || [])
    : (sessions || []).filter(session => session.status === filters.status)

  const totalPages = Math.ceil(totalSessions / filters.limit)

  if (loading && (!sessions || sessions.length === 0)) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Header with New Conversation Button */}
      <div className="flex justify-between items-center">
        <div></div>
        <button
          onClick={() => setShowNewConversationModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Start New Conversation
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by status:
          </span>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusFilter(option.value)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  filters.status === option.value
                    ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-200'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {totalSessions} session{totalSessions !== 1 ? 's' : ''} total
          </span>
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
        {filteredSessions.length === 0 ? (
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
              {filters.status === 'all' 
                ? 'Start a new session to see it here.'
                : `No sessions with status "${filters.status}".`
              }
            </p>
          </div>
        ) : (
          <div>
            {filteredSessions.map((session) => (
              <SessionCard key={session.session_id} session={session} />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page === 1}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                
                <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                  Page {filters.page} of {totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page === totalPages}
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
      />
    </div>
  )
}