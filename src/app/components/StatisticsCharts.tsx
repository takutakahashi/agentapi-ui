'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'
import { statisticsApi } from '../../lib/api'
import { StatisticsData, UserStats } from '../../types/statistics'
import LoadingSpinner from './LoadingSpinner'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

interface UserAgentData {
  username: string
  agentCount: number
  activeAgents: number
  completedAgents: number
}

interface RepoAgentData {
  repoName: string
  agentCount: number
}

interface DurationData {
  username: string
  avgDuration: number
}

export default function StatisticsCharts() {
  const [data, setData] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const statsData = await statisticsApi.getStatistics()
        setData(statsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [])

  if (loading) return <LoadingSpinner />
  if (error) return <div className="text-red-500 p-4">Error: {error}</div>
  if (!data) return <div className="p-4">No data available</div>

  const userAgentData: UserAgentData[] = data.userStats.map((user: UserStats) => {
    const activeAgents = user.repositories.reduce(
      (acc, repo) => acc + repo.agents.filter(agent => agent.deletedAt === null).length,
      0
    )
    const completedAgents = user.repositories.reduce(
      (acc, repo) => acc + repo.agents.filter(agent => agent.deletedAt !== null).length,
      0
    )
    
    return {
      username: user.username,
      agentCount: user.agentCount,
      activeAgents,
      completedAgents,
    }
  })

  const repoAgentData: RepoAgentData[] = data.userStats.flatMap((user: UserStats) =>
    user.repositories.map(repo => ({
      repoName: repo.repoFullname.split('/')[1] || repo.repoFullname,
      agentCount: repo.agentCount,
    }))
  )

  const durationData: DurationData[] = data.userStats.map((user: UserStats) => {
    const completedAgents = user.repositories.flatMap(repo =>
      repo.agents.filter(agent => agent.duration !== null)
    )
    const avgDuration = completedAgents.length > 0
      ? completedAgents.reduce((acc, agent) => acc + (agent.duration || 0), 0) / completedAgents.length
      : 0

    return {
      username: user.username,
      avgDuration: Math.round(avgDuration),
    }
  })

  const statusData = [
    { name: 'Active', value: data.summary.activeAgents },
    { name: 'Completed', value: data.summary.completedAgents },
  ]

  return (
    <div className="p-6 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600">Total Users</h3>
          <p className="text-2xl font-bold text-blue-900">{data.summary.totalUsers}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-600">Total Repositories</h3>
          <p className="text-2xl font-bold text-green-900">{data.summary.totalRepositories}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-600">Total Agents</h3>
          <p className="text-2xl font-bold text-purple-900">{data.summary.totalAgents}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-orange-600">Avg Duration (min)</h3>
          <p className="text-2xl font-bold text-orange-900">{data.summary.averageDuration}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Agents by User</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={userAgentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="username" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="activeAgents" stackId="a" fill="#0088FE" name="Active" />
              <Bar dataKey="completedAgents" stackId="a" fill="#00C49F" name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Agent Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Agents by Repository</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={repoAgentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="repoName" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="agentCount" fill="#FFBB28" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Average Duration by User (minutes)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={durationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="username" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="avgDuration" stroke="#FF8042" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}