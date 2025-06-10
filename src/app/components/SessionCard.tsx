'use client'

import Link from 'next/link'
import { Session } from '../../types/agentapi'
import StatusBadge from './StatusBadge'

interface SessionCardProps {
  session: Session
}

export default function SessionCard({ session }: SessionCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60 * 1000) {
      return 'Just now'
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))} minutes ago`
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))} hours ago`
    } else {
      return date.toLocaleDateString()
    }
  }


  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Session: {session.session_id.substring(0, 8)}...
            </h3>
            <StatusBadge 
              status={session.status}
            />
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">User:</span>
              <span className="ml-2">{session.user_id}</span>
            </div>
            
            {session.environment?.WORKSPACE_NAME && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Workspace:</span>
                <span className="ml-2">{session.environment.WORKSPACE_NAME}</span>
              </div>
            )}

            {session.metadata?.description && typeof session.metadata.description === 'string' ? (
              <div className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Description:</span>
                <span className="ml-2">{session.metadata.description}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4">
            <span>Created: {formatDate(session.created_at)}</span>
            <span>Updated: {formatDate(session.updated_at)}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {session.status === 'active' && (
            <Link
              href={`/agentapi?session=${session.session_id}`}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </Link>
          )}
          
          <Link
            href={`/sessions/${session.session_id}`}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </Link>
        </div>
      </div>
    </div>
  )
}