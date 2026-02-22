'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ExternalLink, Terminal, RefreshCw, AlertCircle, ClipboardList } from 'lucide-react'
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client'
import { Task } from '../../types/task'

const REFRESH_INTERVAL_MS = 30000

function StatusBadge({ status }: { status: Task['status'] }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        完了
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
      未完了
    </span>
  )
}

function TypeBadge({ type }: { type: Task['task_type'] }) {
  if (type === 'agent') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
        Agent
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
      User
    </span>
  )
}

function TaskItem({ task }: { task: Task }) {
  const isDone = task.status === 'done'

  return (
    <div
      className={`py-3 px-1 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
        isDone ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-snug ${
              isDone
                ? 'line-through text-gray-400 dark:text-gray-500'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <StatusBadge status={task.status} />
            <TypeBadge type={task.task_type} />
          </div>
          {(task.session_id || task.links?.length > 0) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {task.session_id && (
                <Link
                  href={`/sessions/${task.session_id}`}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Terminal className="w-3 h-3 flex-shrink-0" />
                  <span>セッション</span>
                </Link>
              )}
              {task.links?.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{link.title || link.url}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskSection({
  title,
  tasks,
  emptyMessage,
}: {
  title: string
  tasks: Task[]
  emptyMessage?: string
}) {
  if (tasks.length === 0 && !emptyMessage) return null

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </h3>
        {tasks.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
            {tasks.length}
          </span>
        )}
      </div>
      {tasks.length > 0 ? (
        <div>
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      ) : (
        emptyMessage && (
          <p className="text-xs text-gray-400 dark:text-gray-500 py-2">{emptyMessage}</p>
        )
      )}
    </div>
  )
}

export default function TaskListPanel() {
  const [userTasks, setUserTasks] = useState<Task[]>([])
  const [agentTasks, setAgentTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const client = createAgentAPIProxyClientFromStorage()

      const [userResult, agentResult] = await Promise.all([
        client.getTasks({ scope: 'user', task_type: 'user' }),
        client.getTasks({ scope: 'user', task_type: 'agent' }),
      ])

      // Sort: todo first, then done; within same status, newest first
      const sortTasks = (tasks: Task[]) =>
        [...tasks].sort((a, b) => {
          if (a.status !== b.status) return a.status === 'todo' ? -1 : 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

      setUserTasks(sortTasks(userResult.tasks))
      setAgentTasks(sortTasks(agentResult.tasks))
      setError(null)
    } catch (err) {
      console.error('[TaskListPanel] Failed to fetch tasks:', err)
      setError('タスクの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchTasks])

  const totalTodo = [...userTasks, ...agentTasks].filter((t) => t.status === 'todo').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button
          onClick={fetchTasks}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          再試行
        </button>
      </div>
    )
  }

  if (userTasks.length === 0 && agentTasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <ClipboardList className="w-8 h-8 text-gray-300 dark:text-gray-600" />
        <p className="text-sm text-gray-400 dark:text-gray-500">タスクはありません</p>
      </div>
    )
  }

  return (
    <div>
      {/* Summary */}
      {totalTodo > 0 && (
        <div className="mb-3 px-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            未完了のタスクが{' '}
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">
              {totalTodo}
            </span>{' '}
            件あります
          </p>
        </div>
      )}

      {/* Refresh button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={fetchTasks}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          title="更新"
        >
          <RefreshCw className="w-3 h-3" />
          更新
        </button>
      </div>

      {/* User Tasks (Primary) */}
      <TaskSection
        title="ユーザータスク"
        tasks={userTasks}
        emptyMessage={agentTasks.length > 0 ? undefined : undefined}
      />

      {/* Agent Tasks */}
      {agentTasks.length > 0 && (
        <TaskSection title="エージェントタスク" tasks={agentTasks} />
      )}
    </div>
  )
}
