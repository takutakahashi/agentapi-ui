'use client'

import { Suspense, use, useState, useEffect } from 'react'
import LoadingSpinner from '../../components/LoadingSpinner'
import AgentAPIChat from '../../components/AgentAPIChat'
import SessionListSidebar from '../../components/SessionListSidebar'

const SIDEBAR_VISIBLE_KEY = 'session_list_sidebar_visible'

interface SessionPageProps {
  params: Promise<{
    sessionId: string
  }>
}

export default function SessionPage({ params }: SessionPageProps) {
  // Use React 18's use() hook to unwrap the Promise
  const resolvedParams = use(params)

  // Sidebar visibility state — read from localStorage after mount
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarMounted, setSidebarMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_VISIBLE_KEY)
    if (saved === 'false') setSidebarVisible(false)
    setSidebarMounted(true)
  }, [])

  const toggleSidebar = () => {
    setSidebarVisible((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_VISIBLE_KEY, String(next))
      return next
    })
  }

  return (
    <div className="h-dvh bg-gray-50 flex" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Session list sidebar (hidden on mobile by default) */}
      {sidebarMounted && (
        <div className={`hidden md:flex ${sidebarVisible ? '' : 'md:hidden'}`}>
          <SessionListSidebar
            currentSessionId={resolvedParams.sessionId}
            isVisible={sidebarVisible}
            onClose={toggleSidebar}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0" style={{ minHeight: 0 }}>
        <Suspense fallback={<LoadingSpinner />}>
          <AgentAPIChat
            sessionId={resolvedParams.sessionId}
            onToggleSidebar={toggleSidebar}
            sidebarVisible={sidebarVisible}
          />
        </Suspense>
      </div>
    </div>
  )
}
