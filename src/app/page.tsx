'use client'

import { Suspense } from 'react'
import ConversationList from './components/ConversationList'
import LoadingSpinner from './components/LoadingSpinner'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and monitor your conversation sessions
          </p>
        </div>

        {/* Session List */}
        <div className="w-full">
          <Suspense fallback={<LoadingSpinner />}>
            <ConversationList />
          </Suspense>
        </div>
      </div>
    </main>
  )
}