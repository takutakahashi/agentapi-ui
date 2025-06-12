'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TopNavigationBar() {
  const pathname = usePathname()

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Title */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                AgentAPI UI
              </h1>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                href="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/'
                    ? 'bg-gray-900 text-white dark:bg-gray-700'
                    : 'text-gray-500 hover:bg-gray-700 hover:text-white dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Sessions
              </Link>
              <Link
                href="/agentapi"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/agentapi'
                    ? 'bg-gray-900 text-white dark:bg-gray-700'
                    : 'text-gray-500 hover:bg-gray-700 hover:text-white dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Chat
              </Link>
            </div>
          </div>

          {/* Settings Button */}
          <div className="flex items-center">
            <Link
              href="/settings"
              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md transition-colors ${
                pathname === '/settings'
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}