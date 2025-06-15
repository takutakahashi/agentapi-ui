'use client'

import { Suspense, use } from 'react'
import LoadingSpinner from '../../components/LoadingSpinner'
import RepositoryConversationList from './RepositoryConversationList'
import TopBar from '../../components/TopBar'

interface RepositoryChatsPageProps {
  params: Promise<{
    repo_fullname: string
  }>
}

export default function RepositoryChatsPage({ params }: RepositoryChatsPageProps) {
  // Use React 18's use() hook to unwrap the Promise
  const resolvedParams = use(params)
  // Decode the repo_fullname parameter (since it comes URL-encoded)
  const repoFullname = decodeURIComponent(resolvedParams.repo_fullname)
  
  // Parse owner and repo name from the full name (e.g. "users/repo_name" or "orgs/repo_name")
  const [ownerType, repoName] = repoFullname.split('/', 2)
  const displayName = ownerType && repoName ? `${ownerType}/${repoName}` : repoFullname

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar
        title="Repository Conversations"
        subtitle={`Conversations filtered for repository: ${displayName}`}
        showSettingsButton={true}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {displayName}
          </span>
        </div>
      </TopBar>

      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <Suspense fallback={<LoadingSpinner />}>
          <RepositoryConversationList repository={repoFullname} />
        </Suspense>
      </div>
    </main>
  )
}