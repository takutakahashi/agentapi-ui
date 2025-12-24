'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Users, ArrowLeft } from 'lucide-react'

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
    </nav>
  )
}
