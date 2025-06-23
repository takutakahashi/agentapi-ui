export interface Agent {
  id: string
  name: string
  createdAt: string
  deletedAt: string | null
  duration: number | null
}

export interface Repository {
  repoFullname: string
  agentCount: number
  agents: Agent[]
}

export interface UserStats {
  userId: string
  username: string
  agentCount: number
  repositories: Repository[]
}

export interface StatisticsSummary {
  totalUsers: number
  totalRepositories: number
  totalAgents: number
  activeAgents: number
  completedAgents: number
  averageDuration: number
  timeRange: {
    start: string
    end: string
  }
}

export interface StatisticsData {
  userStats: UserStats[]
  summary: StatisticsSummary
}