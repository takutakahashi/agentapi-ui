'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import LoadingSpinner from '../components/LoadingSpinner'
import ChatInterface from '../components/ChatInterface'

function AgentAPIPageContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  if (!sessionId) {
    return (
      <div className="h-dvh bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat Interface</h1>
          <p className="text-gray-600 mb-4">No session ID provided</p>
          <Link 
            href="/chats" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            ← Back to Conversations
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh bg-gray-50">
      <div className="w-full h-full flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Chat Interface</h1>
            <p className="text-sm text-gray-600">Session: {sessionId.substring(0, 8)}...</p>
          </div>
          <Link 
            href="/chats" 
            className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            ← Back to Conversations
          </Link>
        </div>
        
        <div className="flex-1 bg-white">
          <ChatInterface sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}

export default function AgentAPIPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AgentAPIPageContent />
    </Suspense>
  )
}