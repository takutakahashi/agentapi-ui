'use client'

import { useState } from 'react'
import { Schedule } from '../../types/schedule'
import ScheduleStatusBadge from './ScheduleStatusBadge'

interface ScheduleCardProps {
  schedule: Schedule
  onEdit: (schedule: Schedule) => void
  onDelete: (scheduleId: string) => void
  onTogglePause: (scheduleId: string, currentStatus: Schedule['status']) => void
  onTrigger: (scheduleId: string) => void
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return '-'
  try {
    const date = new Date(isoString)
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

function formatCronExpression(cronExpr?: string): string {
  if (!cronExpr) return '-'
  return cronExpr
}

export default function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  onTogglePause,
  onTrigger,
}: ScheduleCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTriggering, setIsTriggering] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`スケジュール「${schedule.name}」を削除してもよろしいですか？`)) {
      return
    }
    setIsDeleting(true)
    try {
      await onDelete(schedule.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTrigger = async () => {
    setIsTriggering(true)
    try {
      await onTrigger(schedule.id)
    } finally {
      setIsTriggering(false)
    }
  }

  const isPaused = schedule.status === 'paused'
  const isCompleted = schedule.status === 'completed'

  return (
    <div className="group card-modern-hover p-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {schedule.name}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <ScheduleStatusBadge status={schedule.status} />
            {schedule.timezone && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">
                {schedule.timezone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Info */}
      <div className="space-y-2.5 text-sm">
        {/* Cron or Scheduled At */}
        <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {schedule.cron_expr ? (
            <span className="font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{formatCronExpression(schedule.cron_expr)}</span>
          ) : (
            <span>{formatDateTime(schedule.scheduled_at)}</span>
          )}
        </div>

        {/* Next Execution */}
        {schedule.next_execution_at && (
          <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <span>次回: <span className="text-gray-800 dark:text-gray-200 font-medium">{formatDateTime(schedule.next_execution_at)}</span></span>
          </div>
        )}

        {/* Last Execution */}
        {schedule.last_execution_at && (
          <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span>前回: {formatDateTime(schedule.last_execution_at)}</span>
          </div>
        )}

        {/* Execution Count */}
        {schedule.execution_count !== undefined && schedule.execution_count > 0 && (
          <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span>実行回数: <span className="text-gray-800 dark:text-gray-200 font-semibold">{schedule.execution_count}</span></span>
          </div>
        )}

        {/* Session Config - Message */}
        {schedule.session_config?.params?.message && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs text-gray-600 dark:text-gray-400 line-clamp-2 border border-gray-100 dark:border-gray-600">
            {schedule.session_config.params.message}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => onEdit(schedule)}
          className="btn-ghost px-3 py-2 text-sm gap-1.5 rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          編集
        </button>

        {!isCompleted && (
          <button
            onClick={() => onTogglePause(schedule.id, schedule.status)}
            className={`btn-base px-3 py-2 text-sm gap-1.5 rounded-lg ${
              isPaused
                ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
            }`}
          >
            {isPaused ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                再開
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                一時停止
              </>
            )}
          </button>
        )}

        <button
          onClick={handleTrigger}
          disabled={isTriggering || isCompleted}
          className="btn-base px-3 py-2 text-sm gap-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTriggering ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              実行中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              今すぐ実行
            </>
          )}
        </button>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="btn-base px-3 py-2 text-sm gap-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 ml-auto"
        >
          {isDeleting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              削除中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              削除
            </>
          )}
        </button>
      </div>
    </div>
  )
}
