'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, RefreshCw, CheckCircle2, Circle, AlertCircle, ClipboardList, ArrowLeft } from 'lucide-react'
import TopBar from '../components/TopBar'
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client'
import { Task } from '../../types/task'

type FilterStatus = 'all' | 'todo' | 'done'

function TaskItem({
  task,
  onToggle,
  isUpdating,
}: {
  task: Task
  onToggle: (task: Task) => void
  isUpdating: boolean
}) {
  const isDone = task.status === 'done'
  const firstLink = task.links?.[0]

  return (
    <div
      className={`flex items-start gap-3 py-4 px-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-opacity ${
        isDone ? 'opacity-60' : ''
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => onToggle(task)}
        disabled={isUpdating}
        className={`flex-shrink-0 mt-0.5 transition-colors disabled:opacity-50 ${
          isDone
            ? 'text-green-500 hover:text-gray-400'
            : 'text-gray-300 hover:text-green-500 dark:text-gray-600 dark:hover:text-green-400'
        }`}
        title={isDone ? '未完了に戻す' : '完了にする'}
      >
        {isUpdating ? (
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
        ) : isDone ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      {/* Content */}
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

        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Status badge */}
          {isDone ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              完了
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              未完了
            </span>
          )}
          {/* Type badge */}
          {task.task_type === 'agent' ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
              Agent
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              User
            </span>
          )}
        </div>

        {firstLink && (
          <a
            href={firstLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-full"
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{firstLink.title || firstLink.url}</span>
          </a>
        )}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const router = useRouter()
  const [userTasks, setUserTasks] = useState<Task[]>([])
  const [agentTasks, setAgentTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)

  const sortTasks = (tasks: Task[]) =>
    [...tasks].sort((a, b) => {
      // todo → done の順、同じステータス内では作成日時が新しい順
      if (a.status !== b.status) return a.status === 'todo' ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const fetchTasks = useCallback(async () => {
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const [userResult, agentResult] = await Promise.all([
        client.getTasks({ scope: 'user', task_type: 'user' }),
        client.getTasks({ scope: 'user', task_type: 'agent' }),
      ])
      setUserTasks(sortTasks(userResult.tasks))
      setAgentTasks(sortTasks(agentResult.tasks))
      setError(null)
    } catch (err) {
      console.error('[TasksPage] Failed to fetch tasks:', err)
      setError('タスクの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'todo' ? 'done' : 'todo'
    setUpdatingTaskId(task.id)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const updated = await client.updateTask(task.id, { status: newStatus })
      if (task.task_type === 'user') {
        setUserTasks((prev) => sortTasks(prev.map((t) => (t.id === updated.id ? updated : t))))
      } else {
        setAgentTasks((prev) => sortTasks(prev.map((t) => (t.id === updated.id ? updated : t))))
      }
    } catch (err) {
      console.error('[TasksPage] Failed to update task:', err)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const filterTasks = (tasks: Task[]) => {
    if (filterStatus === 'all') return tasks
    return tasks.filter((t) => t.status === filterStatus)
  }

  const filteredUserTasks = filterTasks(userTasks)
  const filteredAgentTasks = filterTasks(agentTasks)
  const totalTodo = [...userTasks, ...agentTasks].filter((t) => t.status === 'todo').length

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <TopBar
        title="タスク"
        showSettingsButton={true}
        showLogoutButton={false}
      />

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          戻る
        </button>

        {/* Summary + filter */}
        <div className="flex items-center justify-between mb-4">
          <div>
            {totalTodo > 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                未完了{' '}
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {totalTodo}
                </span>{' '}
                件
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">すべて完了済み</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'todo', 'done'] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filterStatus === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s === 'all' ? 'すべて' : s === 'todo' ? '未完了' : '完了'}
              </button>
            ))}
            <button
              onClick={fetchTasks}
              className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
              title="更新"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            <button
              onClick={fetchTasks}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              再試行
            </button>
          </div>
        ) : filteredUserTasks.length === 0 && filteredAgentTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {filterStatus === 'all' ? 'タスクはありません' : `${filterStatus === 'todo' ? '未完了' : '完了済み'}のタスクはありません`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User Tasks */}
            {filteredUserTasks.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    ユーザータスク
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                      {filteredUserTasks.length}
                    </span>
                  </h2>
                </div>
                {filteredUserTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleToggleStatus}
                    isUpdating={updatingTaskId === task.id}
                  />
                ))}
              </div>
            )}

            {/* Agent Tasks */}
            {filteredAgentTasks.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    エージェントタスク
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                      {filteredAgentTasks.length}
                    </span>
                  </h2>
                </div>
                {filteredAgentTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleToggleStatus}
                    isUpdating={updatingTaskId === task.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
