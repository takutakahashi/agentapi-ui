'use client'

import { Suspense, useState } from 'react'
import ConversationList from '../components/ConversationList'
import LoadingSpinner from '../components/LoadingSpinner'
import AgentAPIChat from '../components/AgentAPIChat'

type TabType = 'conversations' | 'agentapi'

export default function ChatsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('conversations')

  const tabs = [
    {
      key: 'conversations' as TabType,
      label: 'Conversations',
      description: 'Manage and monitor your conversation sessions'
    },
    {
      key: 'agentapi' as TabType,
      label: 'AgentAPI',
      description: 'Real-time chat with AgentAPI from browser'
    }
  ]

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Chats
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {tabs.find(tab => tab.key === activeTab)?.description}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="w-full">
          {activeTab === 'conversations' && (
            <Suspense fallback={<LoadingSpinner />}>
              <ConversationList />
            </Suspense>
          )}
          
          {activeTab === 'agentapi' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg min-h-[600px] h-[calc(100vh-16rem)]">
              <AgentAPIChat />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}