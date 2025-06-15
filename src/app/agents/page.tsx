'use client'

import { useEffect, useState, useCallback } from 'react'
import { Agent, AgentListResponse } from '@/types/agentapi'
import { agentAPIProxy } from '@/lib/agentapi-proxy-client'

// Simple badge component
function Badge({ children, variant }: { children: React.ReactNode; variant: string }) {
  const variants: Record<string, string> = {
    default: 'bg-green-100 text-green-800',
    secondary: 'bg-gray-100 text-gray-800',
    destructive: 'bg-red-100 text-red-800',
    outline: 'bg-white text-gray-600 border border-gray-300',
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.outline}`}>
      {children}
    </span>
  )
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAgents = useCallback(async () => {
    try {
      setError(null)
      const response: AgentListResponse = await agentAPIProxy.getAgents({
        limit: 50,
        page: 1,
      })
      setAgents(response.agents)
    } catch (err) {
      console.error('Failed to fetch agents:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch agents')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAgents()
  }

  useEffect(() => {
    fetchAgents()

    // Set up periodic refresh every 10 seconds
    const interval = setInterval(() => {
      fetchAgents()
    }, 10000)

    return () => clearInterval(interval)
  }, [fetchAgents])

  const getStatusBadgeVariant = (status: Agent['status']) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'error':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getRunningStatus = (agent: Agent) => {
    // Check if agent has metrics to determine if it's running
    if (!agent.metrics) {
      return { status: 'idle', variant: 'secondary' as const }
    }

    // Check last activity to determine if agent is running
    const lastActivity = agent.metrics.last_activity
    if (!lastActivity) {
      return { status: 'idle', variant: 'secondary' as const }
    }

    const lastActivityDate = new Date(lastActivity)
    const now = new Date()
    const diffInSeconds = (now.getTime() - lastActivityDate.getTime()) / 1000

    // If last activity was within 30 seconds, consider it running
    if (diffInSeconds < 30) {
      return { status: 'running', variant: 'default' as const }
    } else if (diffInSeconds < 300) {
      // If within 5 minutes, consider it idle
      return { status: 'idle', variant: 'secondary' as const }
    } else {
      // Otherwise, consider it stopped
      return { status: 'stopped', variant: 'outline' as const }
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center">Loading agents...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center text-red-600">
            Error: {error}
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Agents</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        <div className="p-6">
          {agents.length === 0 ? (
            <div className="text-center text-gray-500 p-8">
              No agents found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Running</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {agents.map((agent) => {
                  const runningStatus = getRunningStatus(agent)
                  return (
                    <tr key={agent.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {agent.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusBadgeVariant(agent.status)}>
                          {agent.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={runningStatus.variant}>
                          {runningStatus.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.config.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {agent.metrics
                          ? `${(agent.metrics.success_rate * 100).toFixed(1)}%`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {agent.metrics?.last_activity
                          ? new Date(agent.metrics.last_activity).toLocaleString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
    </div>
  )
}