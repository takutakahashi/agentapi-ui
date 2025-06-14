import { Chat } from '../../types/chat'
import { Session } from '../../types/agentapi'

interface StatusBadgeProps {
  status: Chat['status'] | Session['status']
  variant?: 'green' | 'yellow' | 'red' | 'gray'
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const getStatusConfig = (status: Chat['status'] | Session['status']) => {
    switch (status) {
      // Chat statuses
      case 'running':
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900 animate-pulse',
          text: 'text-yellow-800 dark:text-yellow-200 font-semibold',
          border: 'border-yellow-200 dark:border-yellow-700 border-2',
          icon: '🔄',
          label: 'Running'
        }
      case 'completed':
        return {
          bg: 'bg-green-100 dark:bg-green-900',
          text: 'text-green-800 dark:text-green-200',
          border: 'border-green-200 dark:border-green-700',
          icon: '✅',
          label: 'Completed'
        }
      case 'failed':
        return {
          bg: 'bg-red-100 dark:bg-red-900',
          text: 'text-red-800 dark:text-red-200',
          border: 'border-red-200 dark:border-red-700',
          icon: '❌',
          label: 'Failed'
        }
      case 'pending':
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-gray-800 dark:text-gray-200',
          border: 'border-gray-200 dark:border-gray-600',
          icon: '⏸️',
          label: 'Pending'
        }
      case 'cancelled':
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-gray-600 dark:text-gray-400',
          border: 'border-gray-200 dark:border-gray-600',
          icon: '⏹️',
          label: 'Cancelled'
        }
      // Session statuses
      case 'active':
        return {
          bg: 'bg-green-100 dark:bg-green-900',
          text: 'text-green-800 dark:text-green-200',
          border: 'border-green-200 dark:border-green-700',
          icon: '🟢',
          label: 'Active'
        }
      case 'inactive':
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-gray-800 dark:text-gray-200',
          border: 'border-gray-200 dark:border-gray-600',
          icon: '⚪',
          label: 'Inactive'
        }
      case 'error':
        return {
          bg: 'bg-red-100 dark:bg-red-900',
          text: 'text-red-800 dark:text-red-200',
          border: 'border-red-200 dark:border-red-700',
          icon: '🔴',
          label: 'Error'
        }
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-gray-800 dark:text-gray-200',
          border: 'border-gray-200 dark:border-gray-600',
          icon: '❓',
          label: 'Unknown'
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  )
}