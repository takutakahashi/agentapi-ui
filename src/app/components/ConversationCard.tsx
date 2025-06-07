import { Chat } from '../../types/chat'
import StatusBadge from './StatusBadge'

interface ConversationCardProps {
  chat: Chat
}

export default function ConversationCard({ chat }: ConversationCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60)
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null
    
    if (seconds < 60) {
      return `${Math.floor(seconds)}s`
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow duration-200 cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {chat.title || `Conversation ${chat.id.slice(0, 8)}`}
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={chat.status} />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatDate(chat.updated_at)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end text-sm text-gray-500 dark:text-gray-400 ml-4">
          {chat.message_count && (
            <span className="mb-1">{chat.message_count} messages</span>
          )}
          {chat.duration && (
            <span>{formatDuration(chat.duration)}</span>
          )}
        </div>
      </div>

      {chat.summary && (
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed overflow-hidden"
           style={{ 
             display: '-webkit-box', 
             WebkitLineClamp: 2, 
             WebkitBoxOrient: 'vertical' 
           }}>
          {chat.summary}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ID: {chat.id.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
            View Details
          </button>
        </div>
      </div>
    </div>
  )
}