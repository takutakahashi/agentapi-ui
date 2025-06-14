'use client'

import { Suspense, use } from 'react'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '../../components/LoadingSpinner'
import RepositoryConversationList from './RepositoryConversationList'

interface RepositoryChatsPageProps {
  params: Promise<{
    repo_fullname: string
  }>
}

export default function RepositoryChatsPage({ params }: RepositoryChatsPageProps) {
  const router = useRouter()
  // Use React 18's use() hook to unwrap the Promise
  const resolvedParams = use(params)
  // Decode the repo_fullname parameter (since it comes URL-encoded)
  const repoFullname = decodeURIComponent(resolvedParams.repo_fullname)
  
  // Parse owner and repo name from the full name (e.g. "users/repo_name" or "orgs/repo_name")
  const [ownerType, repoName] = repoFullname.split('/', 2)
  const displayName = ownerType && repoName ? `${ownerType}/${repoName}` : repoFullname

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Repository Conversations
            </h1>
            <button
              onClick={() => router.push('/settings')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {displayName}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Conversations filtered for repository: {displayName}
          </p>
        </div>

        <Suspense fallback={<LoadingSpinner />}>
          <RepositoryConversationList repository={repoFullname} />
        </Suspense>
      </div>
    </main>
  )
}