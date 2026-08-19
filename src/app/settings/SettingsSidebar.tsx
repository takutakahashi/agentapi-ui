'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Bot, Blocks, LayoutDashboard, LockKeyhole, MonitorCog, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'

const categories = [
  { label: '概要', hash: 'settings-overview', icon: LayoutDashboard },
  { label: 'AI・認証', hash: 'ai-authentication', icon: Bot },
  { label: '拡張機能', hash: 'extensions', icon: Blocks },
  { label: 'セッション', hash: 'session-settings', icon: MonitorCog },
  { label: '通知', hash: 'notification-settings', icon: Bell },
  { label: 'セキュリティ', hash: 'security-settings', icon: LockKeyhole },
]

export function SettingsSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [teams, setTeams] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeCategory, setActiveCategory] = useState('settings-overview')
  const [scope, setScope] = useState(pathname === '/settings/team' ? 'team:' : 'personal')

  useEffect(() => {
    const loadScopeOptions = async () => {
      try {
        const userInfo = await createAgentAPIProxyClientFromStorage().getUserInfo()
        setUserName(userInfo?.username || '')
        setTeams(userInfo?.teams || [])
        setIsAdmin(userInfo?.is_admin === true)

        if (pathname === '/settings/team') {
          const selectedTeam = new URLSearchParams(window.location.search).get('team')
          setScope(`team:${selectedTeam || userInfo?.teams?.[0] || ''}`)
        } else {
          setScope('personal')
        }
      } catch {
        setIsAdmin(false)
      }
    }

    loadScopeOptions()
  }, [pathname])

  useEffect(() => {
    const updateHash = () => setActiveCategory(window.location.hash.slice(1) || 'settings-overview')
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])

  const handleScopeChange = (value: string) => {
    setScope(value)
    if (value === 'personal') {
      router.push('/settings/personal')
      return
    }
    router.push(`/settings/team?team=${encodeURIComponent(value.slice(5))}`)
  }

  return (
    <aside className="w-full flex-shrink-0 md:sticky md:top-6 md:w-60 md:self-start">
      <Link
        href="/chats"
        className="mb-5 hidden items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white md:flex"
      >
        <ArrowLeft className="h-4 w-4" />
        チャットに戻る
      </Link>

      <div className="mb-4">
        <label htmlFor="settings-scope" className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
          編集スコープ
        </label>
        <select
          id="settings-scope"
          value={scope}
          onChange={(event) => handleScopeChange(event.target.value)}
          className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="personal">個人設定{userName ? ` — ${userName}` : ''}</option>
          {teams.map((team) => (
            <option key={team} value={`team:${team}`}>チーム設定 — {team}</option>
          ))}
        </select>
      </div>

      <nav aria-label="設定カテゴリ" className="-mx-4 overflow-x-auto border-y border-gray-200 px-4 dark:border-gray-700 md:mx-0 md:overflow-visible md:border-0 md:px-0">
        <ul className="flex min-w-max gap-1 py-2 md:block md:min-w-0 md:space-y-1 md:py-0">
          {categories.map(({ label, hash, icon: Icon }) => {
            const active = activeCategory === hash
            return (
              <li key={hash}>
                <a
                  href={`#${hash}`}
                  onClick={() => setActiveCategory(hash)}
                  className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors md:w-full ${
                    active
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {isAdmin && (
        <Link href="/admin" className="mt-4 hidden items-center gap-2 px-3 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white md:flex">
          <ShieldCheck className="h-4 w-4" />
          管理者設定
        </Link>
      )}
    </aside>
  )
}
