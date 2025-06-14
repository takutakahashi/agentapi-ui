'use client'

import { useEffect, useState, useCallback } from 'react'
import { Agent, AgentListResponse } from '@/types/agentapi'
import { agentAPIProxy } from '@/lib/agentapi-proxy-client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

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
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading agents...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">
              Error: {error}
            </div>
            <div className="mt-4 text-center">
              <Button onClick={handleRefresh}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Agents</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              No agents found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Running</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => {
                  const runningStatus = getRunningStatus(agent)
                  return (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">
                        {agent.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(agent.status)}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={runningStatus.variant}>
                          {runningStatus.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{agent.config.type}</TableCell>
                      <TableCell>
                        {agent.metrics
                          ? `${(agent.metrics.success_rate * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {agent.metrics?.last_activity
                          ? format(new Date(agent.metrics.last_activity), 'PPp')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(agent.created_at), 'PP')}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}