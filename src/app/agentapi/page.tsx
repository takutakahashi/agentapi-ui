'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'

function AgentAPIPageContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  if (!sessionId) {
    return (
      <div className="h-dvh bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat Interface</h1>
          <p className="text-gray-600">No session ID provided</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh bg-gray-50">
      <div className="w-full h-full flex flex-col px-0 sm:container sm:mx-auto sm:px-4">
        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b border-gray-200 p-4">
            <h1 className="text-xl font-semibold text-gray-900">Chat Interface</h1>
            <p className="text-sm text-gray-600">Session: {sessionId}</p>
          </div>
          
          <div className="flex-1 flex flex-col p-4">
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center justify-center">
              <div className="text-center">
                <div className="mb-4">
                  <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-gray-900 mb-2">Chat Interface</h2>
                <p className="text-gray-600 mb-4">
                  This is a simplified chat interface for session management.
                </p>
                <div className="text-sm text-gray-500">
                  <p>Session ID: <code className="bg-gray-100 px-2 py-1 rounded">{sessionId}</code></p>
                </div>
              </div>
            </div>
          </div>
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