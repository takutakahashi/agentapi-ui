'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { User, Users, Bell } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  debugOnly?: boolean
}

const settingsNavItems: NavItem[] = [
  {
    label: 'プッシュ通知',
    href: '/settings/notifications',
    icon: Bell,
    debugOnly: false,
  },
  {
    label: 'Personal',
    href: '/settings/personal',
    icon: User,
    debugOnly: true,
  },
  {
    label: 'Team',
    href: '/settings/team',
    icon: Users,
    debugOnly: true,
  },
]

export function SettingsSidebar() {
  const pathname = usePathname()
  const [isDebugMode, setIsDebugMode] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 環境変数が設定されている場合は常にtrue
    if (process.env.AGENTAPI_DEBUG === 'true') {
      setIsDebugMode(true)
      return
    }
    // localStorageのフラグをチェック
    const debugFlag = localStorage.getItem('agentapi_debug')
    setIsDebugMode(debugFlag === 'true')
  }, [])

  const visibleItems = settingsNavItems.filter(
    (item) => !item.debugOnly || isDebugMode
  )

  return (
    <nav className="w-full md:w-64 flex-shrink-0">
      <ul className="space-y-1">
        {visibleItems.map((item) => {
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
    </nav>
  )
}
