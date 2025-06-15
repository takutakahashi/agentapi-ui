'use client'

import { useState, useCallback } from 'react'
import TagFilterSidebar from '../components/TagFilterSidebar'
import SessionListView from '../components/SessionListView'
import NewSessionModal from '../components/NewSessionModal'
import TopBar from '../components/TopBar'

interface TagFilter {
  [key: string]: string[]
}

interface CreatingSession {
  id: string
  message: string
  repository?: string
  status: 'creating' | 'waiting-agent' | 'sending-message' | 'completed' | 'failed'
  startTime: Date
}

export default function ChatsPage() {
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [tagFilters, setTagFilters] = useState<TagFilter>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [creatingSessions, setCreatingSessions] = useState<CreatingSession[]>([])

  const handleNewSessionSuccess = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleSessionsUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleSessionStart = (id: string, message: string, repository?: string) => {
    const newSession: CreatingSession = {
      id,
      message,
      repository,
      status: 'creating',
      startTime: new Date()
    }
    setCreatingSessions(prev => [...prev, newSession])
  }

  const handleSessionStatusUpdate = (id: string, status: CreatingSession['status']) => {
    setCreatingSessions(prev => 
      prev.map(session => 
        session.id === id ? { ...session, status } : session
      )
    )
  }

  const handleSessionCompleted = (id: string) => {
    setCreatingSessions(prev => prev.filter(session => session.id !== id))
    setRefreshKey(prev => prev + 1)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* トップバー */}
      <TopBar
        title="Conversations"
        subtitle="Manage and monitor your conversation sessions with agent status"
        showFilterButton={true}
        filterButtonText={sidebarVisible ? 'フィルタを隠す' : 'フィルタを表示'}
        onFilterToggle={() => setSidebarVisible(!sidebarVisible)}
        showNewSessionButton={true}
        onNewSession={() => setShowNewSessionModal(true)}
        showSettingsButton={true}
      />

      <div className="flex">
        {/* フィルタサイドバー */}
        <TagFilterSidebar
          isVisible={sidebarVisible}
          onToggleVisibility={() => setSidebarVisible(!sidebarVisible)}
          onFiltersChange={setTagFilters}
          currentFilters={tagFilters}
        />

        {/* メインコンテンツ */}
        <div className="flex-1 px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {/* アクティブフィルタの表示 */}
          {Object.keys(tagFilters).length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    アクティブフィルタ:
                  </span>
                  {Object.entries(tagFilters).map(([key, values]) =>
                    values.map(value => (
                      <span
                        key={`${key}-${value}`}
                        className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full"
                      >
                        {key}: {value}
                        <button
                          onClick={() => {
                            const newFilters = { ...tagFilters }
                            newFilters[key] = newFilters[key].filter(v => v !== value)
                            if (newFilters[key].length === 0) {
                              delete newFilters[key]
                            }
                            setTagFilters(newFilters)
                          }}
                          className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <button
                  onClick={() => setTagFilters({})}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  すべてクリア
                </button>
              </div>
            </div>
          )}

          {/* セッション一覧 */}
          <SessionListView
            tagFilters={tagFilters}
            onSessionsUpdate={handleSessionsUpdate}
            creatingSessions={creatingSessions}
            key={refreshKey}
          />

          {/* 新しいセッション作成モーダル */}
          <NewSessionModal
            isOpen={showNewSessionModal}
            onClose={() => setShowNewSessionModal(false)}
            onSuccess={handleNewSessionSuccess}
            onSessionStart={handleSessionStart}
            onSessionStatusUpdate={handleSessionStatusUpdate}
            onSessionCompleted={handleSessionCompleted}
          />
        </div>
      </div>
    </main>
  )
}