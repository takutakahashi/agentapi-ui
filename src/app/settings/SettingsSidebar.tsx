'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User, Users, ArrowLeft, LogOut } from 'lucide-react'
import { useState } from 'react'

const settingsNavItems = [
  {
    label: 'Personal',
    href: '/settings/personal',
    icon: User,
  },
  {
    label: 'Team',
    href: '/settings/team',
    icon: Users,
  },
]

export function SettingsSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })
      if (response.ok) {
        router.push('/login')
      }
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <nav className="w-full md:w-64 flex-shrink-0">
      <div className="mb-4">
        <Link
          href="/chats"
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Chats</span>
        </Link>
      </div>
      <ul className="space-y-1">
        {settingsNavItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">{loggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </nav>
  )
}
