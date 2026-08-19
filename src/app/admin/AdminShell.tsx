'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createCurrentDeploymentAgentAPIProxyClient } from '@/lib/agentapi-proxy-client'
import { adminSections } from './config'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    createCurrentDeploymentAgentAPIProxyClient().getUserInfo()
      .then((user) => setAllowed(user?.is_admin === true))
      .catch(() => setAllowed(false))
  }, [])

  if (allowed === null) return <div className="p-12 text-center text-gray-500">管理者権限を確認しています…</div>
  if (!allowed) return (
    <div className="mx-auto max-w-xl p-12 text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">アクセスできません</h1>
      <p className="mt-3 text-gray-600 dark:text-gray-400">このページには管理者権限が必要です。</p>
      <button onClick={() => router.push('/')} className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-white">ホームへ戻る</button>
    </div>
  )

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div><p className="text-sm font-medium text-blue-600">Administration</p><h1 className="text-3xl font-bold text-gray-900 dark:text-white">システム設定</h1><p className="mt-2 text-gray-600 dark:text-gray-400">組織全体の設定をバージョン管理されたKV Storeへ保存します。</p></div>
          <Link href="/settings" className="text-sm text-blue-600 hover:underline">ユーザー設定へ</Link>
        </div>
        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="w-full shrink-0 md:w-64">
            <nav className="space-y-1 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
              {adminSections.map((section) => {
                const href = `/admin/${section.id}`
                const active = pathname === href
                return <Link key={section.id} href={href} className={`block rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}>{section.title}</Link>
              })}
              <Link href="/admin/pools" className={`block rounded-md px-3 py-2 text-sm font-medium ${pathname === '/admin/pools' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}>Session Pools</Link>
              <Link href="/admin/history" className={`block rounded-md px-3 py-2 text-sm font-medium ${pathname === '/admin/history' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}>変更履歴</Link>
            </nav>
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </main>
  )
}
