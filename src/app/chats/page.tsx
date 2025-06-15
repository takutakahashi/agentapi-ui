'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TagFilterSidebar from '../components/TagFilterSidebar'
import SessionListView from '../components/SessionListView'
import NewSessionModal from '../components/NewSessionModal'
import { Agent, AgentListResponse } from '@/types/agentapi'
import { agentAPIProxy } from '@/lib/agentapi-proxy-client'

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

export default function ChatsPage() {
  const router = useRouter()
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [tagFilters, setTagFilters] = useState<TagFilter>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [creatingSessions, setCreatingSessions] = useState<CreatingSession[]>([])
  const [activeTab, setActiveTab] = useState<'conversations' | 'agents'>('conversations')
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)

  const handleNewSessionSuccess = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleSessionsUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleSessionStart = (id: string, message: string, repository?: string) => {
    const newSession: CreatingSession = {
      id,
      message,
      repository,
      status: 'creating',
      startTime: new Date()
    }
    setCreatingSessions(prev => [...prev, newSession])
  }

  const handleSessionStatusUpdate = (id: string, status: CreatingSession['status']) => {
    setCreatingSessions(prev => 
      prev.map(session => 
        session.id === id ? { ...session, status } : session
      )
    )
  }

  const handleSessionCompleted = (id: string) => {
    setCreatingSessions(prev => prev.filter(session => session.id !== id))
    setRefreshKey(prev => prev + 1)
  }

  const fetchAgents = useCallback(async () => {
    try {
      setAgentsError(null)
      const response: AgentListResponse = await agentAPIProxy.getAgents({
        limit: 50,
        page: 1,
      })
      setAgents(response.agents)
    } catch (err) {
      console.error('Failed to fetch agents:', err)
      setAgentsError(err instanceof Error ? err.message : 'Failed to fetch agents')
    } finally {
      setAgentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'agents') {
      fetchAgents()
      // Set up periodic refresh every 10 seconds for agents
      const interval = setInterval(() => {
        fetchAgents()
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [activeTab, fetchAgents])

  const getStatusBadgeVariant = (status: Agent['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-white text-gray-600 border border-gray-300'
    }
  }

  const getRunningStatus = (agent: Agent) => {
    if (!agent.metrics) {
      return { status: 'idle', variant: 'bg-gray-100 text-gray-800' }
    }

    const lastActivity = agent.metrics.last_activity
    if (!lastActivity) {
      return { status: 'idle', variant: 'bg-gray-100 text-gray-800' }
    }

    const lastActivityDate = new Date(lastActivity)
    const now = new Date()
    const diffInSeconds = (now.getTime() - lastActivityDate.getTime()) / 1000

    if (diffInSeconds < 30) {
      return { status: 'running', variant: 'bg-green-100 text-green-800' }
    } else if (diffInSeconds < 300) {
      return { status: 'idle', variant: 'bg-gray-100 text-gray-800' }
    } else {
      return { status: 'stopped', variant: 'bg-red-100 text-red-800' }
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* フィルタサイドバー */}
        {activeTab === 'conversations' && (
          <TagFilterSidebar
            isVisible={sidebarVisible}
            onToggleVisibility={() => setSidebarVisible(!sidebarVisible)}
            onFiltersChange={setTagFilters}
            currentFilters={tagFilters}
          />
        )}

        {/* メインコンテンツ */}
        <div className="flex-1 px-4 md:px-6 lg:px-8 py-6 md:py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {activeTab === 'conversations' ? 'Conversations' : 'Agents'}
              </h1>
              <button
                onClick={() => router.push('/settings')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div className="flex space-x-1 mb-4">
              <button
                onClick={() => setActiveTab('conversations')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'conversations'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Conversations
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'agents'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Agents
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {activeTab === 'conversations' 
                ? 'Manage and monitor your conversation sessions'
                : 'Monitor agent status and performance'
              }
            </p>
          </div>

          {/* セッション開始ボタン */}
          {activeTab === 'conversations' && (
            <div className="mb-6">
              <button
                onClick={() => setShowNewSessionModal(true)}
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                新しいセッションを開始
              </button>
            </div>
          )}

          {/* フィルタトグルボタン (デスクトップ) */}
          {activeTab === 'conversations' && (
            <div className="hidden md:block mb-6">
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="inline-flex items-center px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
              </svg>
                {sidebarVisible ? 'フィルタを隠す' : 'フィルタを表示'}
              </button>
            </div>
          )}

          {/* アクティブフィルタの表示 */}
          {activeTab === 'conversations' && Object.keys(tagFilters).length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    アクティブフィルタ:
                  </span>
                  {Object.entries(tagFilters).map(([key, values]) =>
                    values.map(value => (
                      <span
                        key={`${key}-${value}`}
                        className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full"
                      >
                        {key}: {value}
                        <button
                          onClick={() => {
                            const newFilters = { ...tagFilters }
                            newFilters[key] = newFilters[key].filter(v => v !== value)
                            if (newFilters[key].length === 0) {
                              delete newFilters[key]
                            }
                            setTagFilters(newFilters)
                          }}
                          className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <button
                  onClick={() => setTagFilters({})}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  すべてクリア
                </button>
              </div>
            </div>
          )}

          {/* コンテンツ表示 */}
          {activeTab === 'conversations' ? (
            <SessionListView
              tagFilters={tagFilters}
              onSessionsUpdate={handleSessionsUpdate}
              creatingSessions={creatingSessions}
              key={refreshKey}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Agents</h2>
                <button
                  onClick={fetchAgents}
                  disabled={agentsLoading}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <svg className={`h-4 w-4 mr-2 ${agentsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
              <div className="p-6">
                {agentsLoading && agents.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 p-8">
                    Loading agents...
                  </div>
                ) : agentsError ? (
                  <div className="text-center text-red-600 dark:text-red-400 p-8">
                    Error: {agentsError}
                  </div>
                ) : agents.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 p-8">
                    No agents found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Running</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Success Rate</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Activity</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {agents.map((agent) => {
                          const runningStatus = getRunningStatus(agent)
                          return (
                            <tr key={agent.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {agent.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(agent.status)}`}>
                                  {agent.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${runningStatus.variant}`}>
                                  {runningStatus.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{agent.config.type}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {agent.metrics
                                  ? `${(agent.metrics.success_rate * 100).toFixed(1)}%`
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {agent.metrics?.last_activity
                                  ? new Date(agent.metrics.last_activity).toLocaleString()
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {new Date(agent.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 新しいセッション作成モーダル */}
          {activeTab === 'conversations' && (
            <NewSessionModal
              isOpen={showNewSessionModal}
              onClose={() => setShowNewSessionModal(false)}
              onSuccess={handleNewSessionSuccess}
              onSessionStart={handleSessionStart}
              onSessionStatusUpdate={handleSessionStatusUpdate}
              onSessionCompleted={handleSessionCompleted}
            />
          )}
        </div>
      </div>
    </main>
  )
}