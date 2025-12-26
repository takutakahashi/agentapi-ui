'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab {
  label: string
  href: string
  icon?: React.ReactNode
  requiresDebug?: boolean
}

interface NavigationTabsProps {
  className?: string
}

const allTabs: Tab[] = [
  {
    label: 'Sessions',
    href: '/chats',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    label: 'Schedules',
    href: '/schedules',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    requiresDebug: true,
  },
]

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('agentapi_debug') !== null
}

export default function NavigationTabs({ className = '' }: NavigationTabsProps) {
  const pathname = usePathname()
  const [debugEnabled, setDebugEnabled] = useState(false)

  useEffect(() => {
    setDebugEnabled(isDebugEnabled())
  }, [])

  const tabs = allTabs.filter(tab => !tab.requiresDebug || debugEnabled)

  const isActive = (href: string) => {
    if (href === '/chats') {
      return pathname === '/chats' || pathname.startsWith('/chats/')
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  // Don't render if only one tab is visible
  if (tabs.length <= 1) {
    return null
  }

  return (
    <div className={`flex space-x-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg ${className}`}>
      {tabs.map((tab) => {
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${active
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-600'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
