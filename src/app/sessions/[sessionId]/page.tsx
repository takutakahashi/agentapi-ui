'use client'

import { Suspense, use } from 'react'
import LoadingSpinner from '../../components/LoadingSpinner'
import AgentAPIChat from '../../components/AgentAPIChat'

interface SessionPageProps {
  params: Promise<{
    sessionId: string
  }>
}

export default function SessionPage({ params }: SessionPageProps) {
  // Use React 18's use() hook to unwrap the Promise
  const resolvedParams = use(params)

  return (
    <div className="h-dvh bg-gray-50" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="w-full h-full flex flex-col px-0 sm:px-6 max-w-[1800px] mx-auto" style={{ minHeight: 0 }}>
        <Suspense fallback={<LoadingSpinner />}>
          <AgentAPIChat sessionId={resolvedParams.sessionId} />
        </Suspense>
      </div>
    </div>
  )
}
