'use client'

import { useCallback, useEffect, useState } from 'react'
import { createCurrentDeploymentAgentAPIProxyClient } from '@/lib/agentapi-proxy-client'
import { AdminSettingsDocument, AdminSettingsVersion } from '@/types/admin-settings'
import { useToast } from '@/contexts/ToastContext'

export default function AdminHistoryPage() {
  const [current, setCurrent] = useState<AdminSettingsDocument | null>(null)
  const [versions, setVersions] = useState<AdminSettingsVersion[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  const { showToast } = useToast()
  const load = useCallback(async () => {
    const client = createCurrentDeploymentAgentAPIProxyClient()
    const [document, history] = await Promise.all([client.getAdminSettings(), client.listAdminSettingsVersions()])
    setCurrent(document); setVersions(history.versions)
  }, [])
  useEffect(() => { load().catch((error) => console.error('Failed to load admin settings history', error)) }, [load])
  const restore = async (version: number) => {
    if (!current || !window.confirm(`version ${version} の内容を新しいversionとして復元しますか？`)) return
    setBusy(version)
    try {
      const client = createCurrentDeploymentAgentAPIProxyClient()
      const old = await client.getAdminSettings(version)
      await client.updateAdminSettings({ base_version: current.version, sections: old.sections })
      await load(); showToast(`version ${version} の内容を復元しました`, 'success')
    } catch { showToast('復元に失敗しました', 'error') } finally { setBusy(null) }
  }
  return <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"><h2 className="text-2xl font-bold text-gray-900 dark:text-white">変更履歴</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">各更新時点の完全な settings.json がKV Storeに保持されます。</p><div className="mt-6 divide-y divide-gray-200 dark:divide-gray-700">{versions.map((item) => <div key={item.version} className="flex items-center justify-between py-4"><div><span className="font-medium text-gray-900 dark:text-white">version {item.version}</span>{current?.version === item.version && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">current</span>}<p className="mt-1 text-xs text-gray-500">{new Date(item.updated_at).toLocaleString()}</p></div><button disabled={current?.version === item.version || busy !== null} onClick={() => restore(item.version)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200">{busy === item.version ? '復元中…' : 'この内容を復元'}</button></div>)}</div></div>
}
