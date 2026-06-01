'use client'

import { useState, useCallback, useEffect } from 'react'
import { SandboxPolicy, CreateSandboxPolicyRequest, UpdateSandboxPolicyRequest } from '../../types/sandbox_policy'
import { createAgentAPIProxyClientFromStorage, AgentAPIProxyError } from '../../lib/agentapi-proxy-client'
import { useTeamScope } from '../../contexts/TeamScopeContext'
import TopBar from '../components/TopBar'
import NavigationTabs from '../components/NavigationTabs'

// ---- Session Domain Import Modal ----
interface SessionDomainImportModalProps {
  isOpen: boolean
  onClose: () => void
  policy: SandboxPolicy
  onImported: () => void
}

function SessionDomainImportModal({ isOpen, onClose, policy, onImported }: SessionDomainImportModalProps) {
  const [domains, setDomains] = useState<{ allowed: string[]; denied: string[]; updated_at?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set())
  // Track domains already registered in the policy (pre-existing + just added this session)
  const [registeredDomains, setRegisteredDomains] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'denied' | 'allowed'>('denied')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchDomains = useCallback(async () => {
    setLoading(true)
    setDomains(null)
    setSelectedDomains(new Set())
    setError(null)
    setSuccess(null)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const result = await client.getSandboxPolicyDomains(policy.id)
      setDomains(result)
    } catch (err) {
      if (err instanceof AgentAPIProxyError && err.status === 501) {
        setError('ドメイン収集機能が利用できません')
      } else {
        setError('ドメインデータの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [policy.id])

  useEffect(() => {
    if (!isOpen) return
    setActiveTab('denied')
    // Seed registered set from the policy's current domain list
    const isAllowlist = (policy.allowed_domains?.length ?? 0) > 0 || (policy.denied_domains?.length ?? 0) === 0
    setRegisteredDomains(new Set(isAllowlist ? (policy.allowed_domains ?? []) : (policy.denied_domains ?? [])))
    fetchDomains()
  }, [isOpen, fetchDomains, policy.allowed_domains, policy.denied_domains])

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  const handleAddToPolicy = async () => {
    if (selectedDomains.size === 0) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const toAdd = Array.from(selectedDomains)
      const isAllowlist = (policy.allowed_domains?.length ?? 0) > 0 || (policy.denied_domains?.length ?? 0) === 0
      const update: UpdateSandboxPolicyRequest = isAllowlist
        ? { allowed_domains: [...new Set([...(policy.allowed_domains ?? []), ...toAdd])] }
        : { denied_domains: (policy.denied_domains ?? []).filter((d) => !toAdd.includes(d)) }
      await client.updateSandboxPolicy(policy.id, update)
      setSuccess(`${toAdd.length} 件のドメインをポリシーに追加しました`)
      setSelectedDomains(new Set())
      setRegisteredDomains((prev) => new Set([...prev, ...toAdd]))
      onImported()
    } catch (err) {
      setError(err instanceof AgentAPIProxyError ? err.message : 'ポリシーの更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const currentDomains = (activeTab === 'denied' ? (domains?.denied ?? []) : (domains?.allowed ?? []))
    .filter((d) => !registeredDomains.has(d))

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">セッションからドメインを取り込む</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                ポリシー: {policy.name}
                {!loading && domains?.updated_at && ` — 最終更新: ${new Date(domains.updated_at).toLocaleString('ja-JP')}`}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm">セッションのアクセスログを収集中...</span>
              </div>
            )}

            {!loading && domains && domains.allowed.length === 0 && domains.denied.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                まだドメインが収集されていません。このポリシーを使用したセッションが起動されると自動的に収集されます。
              </p>
            )}

            {!loading && domains && (domains.allowed.length > 0 || domains.denied.length > 0) && (
              <>
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('denied')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'denied'
                        ? 'border-red-500 text-red-600 dark:text-red-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    ブロック済み ({domains.denied.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('allowed')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'allowed'
                        ? 'border-green-500 text-green-600 dark:text-green-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    許可済み ({domains.allowed.length})
                  </button>
                </div>

                {currentDomains.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">
                    {activeTab === 'denied' ? 'ブロックされたドメインはありません' : '許可されたドメインはありません'}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {currentDomains.map((domain) => (
                      <label key={domain} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDomains.has(domain)}
                          onChange={() => toggleDomain(domain)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shrink-0"
                        />
                        <span className={`text-sm font-mono flex-1 truncate ${
                          activeTab === 'denied' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                          {domain}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {selectedDomains.size > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={handleAddToPolicy}
                      disabled={isSaving}
                      className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                      {isSaving ? '追加中...' : `選択した ${selectedDomains.size} 件をポリシーに追加`}
                    </button>
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      {(policy.allowed_domains?.length ?? 0) > 0 ? '許可リストに追加されます' : '拒否リストから除外されます'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={fetchDomains}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
            >
              再取得
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Form Modal ----
interface SandboxPolicyFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editing?: SandboxPolicy | null
}

function SandboxPolicyFormModal({ isOpen, onClose, onSuccess, editing }: SandboxPolicyFormModalProps) {
  const { getScopeParams } = useTeamScope()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'allowlist' | 'denylist'>('allowlist')
  const [domains, setDomains] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setDescription(editing.description ?? '')
      if (editing.allowed_domains && editing.allowed_domains.length > 0) {
        setMode('allowlist')
        setDomains(editing.allowed_domains.join('\n'))
      } else if (editing.denied_domains && editing.denied_domains.length > 0) {
        setMode('denylist')
        setDomains(editing.denied_domains.join('\n'))
      } else {
        setMode('allowlist')
        setDomains('')
      }
    } else {
      setName('')
      setDescription('')
      setMode('allowlist')
      setDomains('')
    }
    setError(null)
  }, [editing, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('名前は必須です'); return }
    setIsSubmitting(true)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const domainList = domains.split('\n').map((d) => d.trim()).filter(Boolean)
      if (editing) {
        const data: UpdateSandboxPolicyRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          ...(mode === 'allowlist' ? { allowed_domains: domainList, denied_domains: [] } : { denied_domains: domainList, allowed_domains: [] }),
        }
        await client.updateSandboxPolicy(editing.id, data)
      } else {
        const scopeParams = getScopeParams()
        const data: CreateSandboxPolicyRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          ...(mode === 'allowlist' ? { allowed_domains: domainList } : { denied_domains: domainList }),
          scope: (scopeParams as { scope?: 'user' | 'team' }).scope ?? 'user',
          ...(scopeParams as { team_id?: string }).team_id ? { team_id: (scopeParams as { team_id?: string }).team_id } : {},
        }
        await client.createSandboxPolicy(data)
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editing ? 'ポリシーを編集' : '新しいサンドボックスポリシー'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: github-access"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: GitHub と npm へのアクセスを許可"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">モード</label>
              <div className="flex gap-4">
                {(['allowlist', 'denylist'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={m} checked={mode === m} onChange={() => setMode(m)} className="h-4 w-4 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {m === 'allowlist' ? '許可リスト（指定ドメインのみ許可）' : '拒否リスト（指定ドメインをブロック）'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ドメインリスト <span className="text-gray-400 font-normal">（1行に1ドメイン、ワイルドカード *.example.com 可）</span>
              </label>
              <textarea
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder={mode === 'allowlist' ? 'github.com\n*.github.com\nregistry.npmjs.org' : 'example.com\nbad-domain.com'}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
              />
            </div>
          </form>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">
              キャンセル
            </button>
            <button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
              {editing ? '保存' : '作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Policy Card ----
function PolicyCard({
  policy,
  onEdit,
  onDelete,
  onImportDomains,
}: {
  policy: SandboxPolicy
  onEdit: () => void
  onDelete: () => void
  onImportDomains: () => void
}) {
  const domains = policy.allowed_domains?.length
    ? { mode: '許可リスト', list: policy.allowed_domains }
    : policy.denied_domains?.length
    ? { mode: '拒否リスト', list: policy.denied_domains }
    : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{policy.name}</h3>
          {policy.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{policy.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onImportDomains} title="セッションからドメインを取り込む" className="text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
            取り込む
          </button>
          <button onClick={onEdit} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">編集</button>
          <button onClick={onDelete} className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">削除</button>
        </div>
      </div>
      {domains ? (
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 mb-2">{domains.mode}</span>
          <ul className="text-xs font-mono text-gray-600 dark:text-gray-400 space-y-0.5">
            {domains.list.slice(0, 5).map((d) => <li key={d}>{d}</li>)}
            {domains.list.length > 5 && <li className="text-gray-400">... 他 {domains.list.length - 5} 件</li>}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-400">ドメイン未設定</p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">ID: {policy.id}</p>
    </div>
  )
}

// ---- Main Page ----
export default function SandboxPoliciesPage() {
  const [policies, setPolicies] = useState<SandboxPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<SandboxPolicy | null>(null)
  const [importTarget, setImportTarget] = useState<SandboxPolicy | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const res = await client.getSandboxPolicies()
      setPolicies(res.sandbox_policies || [])
    } catch {
      setPolicies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (policy: SandboxPolicy) => {
    if (!confirm(`「${policy.name}」を削除しますか？`)) return
    try {
      const client = createAgentAPIProxyClientFromStorage()
      await client.deleteSandboxPolicy(policy.id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <TopBar title="Sandbox Policies" showSettingsButton={true}>
        <div className="md:hidden">
          <NavigationTabs />
        </div>
      </TopBar>

      <div className="px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-6 md:pb-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">サンドボックスポリシー</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                名前付きのネットワークフィルタールールセットを定義し、セッションプロファイルから参照できます。
              </p>
            </div>
            {/* Desktop button */}
            <button
              onClick={() => { setEditing(null); setIsFormOpen(true) }}
              className="hidden md:inline-flex shrink-0 items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              新しいポリシー
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : policies.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">ポリシーがまだありません</p>
            <button
              onClick={() => { setEditing(null); setIsFormOpen(true) }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              最初のポリシーを作成
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {policies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onEdit={() => { setEditing(policy); setIsFormOpen(true) }}
                onDelete={() => handleDelete(policy)}
                onImportDomains={() => setImportTarget(policy)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => { setEditing(null); setIsFormOpen(true) }}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-colors"
        aria-label="新しいポリシー"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>

      <SandboxPolicyFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditing(null) }}
        onSuccess={() => { setIsFormOpen(false); setEditing(null); load() }}
        editing={editing}
      />

      {importTarget && (
        <SessionDomainImportModal
          isOpen={!!importTarget}
          onClose={() => setImportTarget(null)}
          policy={importTarget}
          onImported={load}
        />
      )}
    </main>
  )
}
