"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BarChart3, MessageSquare, Clock, CheckCircle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

interface Statistics {
  total_sessions: number
  active_sessions: number
  completed_sessions: number
  total_messages: number
  avg_response_time_ms: number
  sessions_by_status: Record<string, number>
  messages_by_day: Array<{ date: string; count: number }>
}

export default function StatisticsPage() {
  const router = useRouter()
  const [stats, setStats] = React.useState<Statistics | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/statistics", {
          credentials: "include",
        })
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        } else if (response.status === 401) {
          router.push("/login")
        }
      } catch (err) {
        console.error("Failed to fetch statistics:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [router])

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const statCards = [
    {
      title: "Total Sessions",
      value: stats?.total_sessions || 0,
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Active Sessions",
      value: stats?.active_sessions || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Completed Sessions",
      value: stats?.completed_sessions || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Total Messages",
      value: stats?.total_messages || 0,
      icon: MessageSquare,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
  ]

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your AgentAPI usage
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <div
                key={card.title}
                className="p-6 border rounded-lg bg-card"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="text-3xl font-bold mt-1">{card.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${card.bgColor}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {stats?.avg_response_time_ms && (
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="font-medium mb-2">Average Response Time</h3>
              <p className="text-2xl font-bold">
                {(stats.avg_response_time_ms / 1000).toFixed(2)}s
              </p>
            </div>
          )}

          {stats?.sessions_by_status && (
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="font-medium mb-4">Sessions by Status</h3>
              <div className="space-y-3">
                {Object.entries(stats.sessions_by_status).map(
                  ([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm capitalize">{status}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
