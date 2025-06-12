import { Suspense } from 'react'
import LoadingSpinner from '../../components/LoadingSpinner'
import RepositoryConversationList from './RepositoryConversationList'

interface RepositoryChatsPageProps {
  params: Promise<{
    repo_fullname: string
  }>
}

export default async function RepositoryChatsPage({ params }: RepositoryChatsPageProps) {
  // Await params in Next.js 15+
  const resolvedParams = await params
  // Decode the repo_fullname parameter (since it comes URL-encoded)
  const repoFullname = decodeURIComponent(resolvedParams.repo_fullname)
  
  // Parse owner and repo name from the full name (e.g. "users/repo_name" or "orgs/repo_name")
  const [ownerType, repoName] = repoFullname.split('/', 2)
  const displayName = ownerType && repoName ? `${ownerType}/${repoName}` : repoFullname

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Repository Conversations
            </h1>
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