'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  SessionProfile,
  CreateSessionProfileRequest,
  UpdateSessionProfileRequest,
} from '../../types/session_profile'
import { NetworkFilterRule } from '../../types/agentapi'
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client'
import { useTeamScope } from '../../contexts/TeamScopeContext'

interface SessionProfileFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingProfile?: SessionProfile | null
}

type KeyValuePair = { key: string; value: string }

type SandboxRuleEdit = {
  id: string
  index: number
  action: 'allow' | 'deny' | 'import' | 'managed_import' | 'managed_import_all'
  domains: string          // newline-separated for allow/deny
  importProfileId: string  // for import action
  importManagedName: string // for managed_import action
}

let ruleEditCounter = 0
const newRuleId = () => `rule-${++ruleEditCounter}`

function rulesFromAPI(apiRules: NetworkFilterRule[] | undefined): SandboxRuleEdit[] {
  if (!apiRules || apiRules.length === 0) return []
  return apiRules.map((r) => ({
    id: newRuleId(),
    index: r.index,
    action: r.action as SandboxRuleEdit['action'],
    domains: (r.domains ?? []).join('\n'),
    importProfileId: r.import_profile_id ?? '',
    importManagedName: r.import_managed_name ?? '',
  }))
}

function rulesToAPI(rules: SandboxRuleEdit[]): NetworkFilterRule[] {
  return rules
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((r) => {
      const base: NetworkFilterRule = { index: r.index, action: r.action }
      if (r.action === 'import') {
        base.import_profile_id = r.importProfileId.trim()
      } else if (r.action === 'managed_import') {
        base.import_managed_name = r.importManagedName.trim()
      } else if (r.action === 'managed_import_all') {
        // no extra fields
      } else {
        base.domains = r.domains
          .split('\n')
          .map((d) => d.trim())
          .filter(Boolean)
      }
      return base
    })
}

const ACTION_LABELS: Record<SandboxRuleEdit['action'], string> = {
  allow: '許可 (allow)',
  deny: '拒否 (deny)',
  import: 'インポート (import)',
  managed_import: 'Managedインポート',
  managed_import_all: 'Managed全インポート',
}

const ACTION_SELECT_COLORS: Record<SandboxRuleEdit['action'], string> = {
  allow: 'border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/25 focus:ring-green-500',
  deny: 'border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/25 focus:ring-red-500',
  import: 'border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/25 focus:ring-blue-500',
  managed_import: 'border-purple-300 dark:border-purple-500 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/25 focus:ring-purple-500',
  managed_import_all: 'border-purple-300 dark:border-purple-500 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/25 focus:ring-purple-500',
}

export default function SessionProfileFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingProfile,
}: SessionProfileFormModalProps) {
  const { getScopeParams } = useTeamScope()

  // Basic fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isManaged, setIsManaged] = useState(false)

  // Config fields
  const [envPairs, setEnvPairs] = useState<KeyValuePair[]>([{ key: '', value: '' }])
  const [tagPairs, setTagPairs] = useState<KeyValuePair[]>([{ key: '', value: '' }])
  const [agentType, setAgentType] = useState('')

  // Sandbox fields (rules-based)
  const [sandboxEnabled, setSandboxEnabled] = useState(false)
  const [sandboxRules, setSandboxRules] = useState<SandboxRuleEdit[]>([])

  // Profiles for import action dropdowns
  const [availableProfiles, setAvailableProfiles] = useState<SessionProfile[]>([])
  const [managedProfiles, setManagedProfiles] = useState<SessionProfile[]>([])

  // Current user admin status
  const [isAdmin, setIsAdmin] = useState(false)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const isEditing = !!editingProfile

  // Fetch current user admin status
  useEffect(() => {
    if (!isOpen) return
    const client = createAgentAPIProxyClientFromStorage()
    client.getUserInfo().then((info) => {
      setIsAdmin(info.is_admin === true)
    }).catch(() => {})
  }, [isOpen])

  // Fetch profiles for import dropdown when sandbox is open
  useEffect(() => {
    if (!isOpen || !sandboxEnabled) return
    const client = createAgentAPIProxyClientFromStorage()
    const hasImport = sandboxRules.some((r) => r.action === 'import')
    const hasManagedImport = sandboxRules.some((r) => r.action === 'managed_import')
    if (hasImport) {
      client.getSessionProfiles().then((res) => {
        const profiles = Array.isArray(res) ? res : res.session_profiles ?? []
        setAvailableProfiles(profiles.filter((p) => p.id !== editingProfile?.id))
      }).catch(() => {})
    }
    if (hasManagedImport) {
      client.getManagedSessionProfiles().then((res) => {
        const profiles = Array.isArray(res) ? res : res.session_profiles ?? []
        setManagedProfiles(profiles)
      }).catch(() => {})
    }
  }, [isOpen, sandboxEnabled, sandboxRules, editingProfile?.id])

  // Initialize form when editing
  useEffect(() => {
    if (editingProfile) {
      setName(editingProfile.name)
      setDescription(editingProfile.description ?? '')
      setIsDefault(editingProfile.is_default ?? false)
      setIsManaged(editingProfile.is_managed ?? false)

      const cfg = editingProfile.config
      setAgentType(cfg?.params?.agent_type ?? '')

      if (cfg?.environment && Object.keys(cfg.environment).length > 0) {
        setEnvPairs(Object.entries(cfg.environment).map(([key, value]) => ({ key, value })))
        setShowAdvanced(true)
      } else {
        setEnvPairs([{ key: '', value: '' }])
      }

      if (cfg?.tags && Object.keys(cfg.tags).length > 0) {
        setTagPairs(Object.entries(cfg.tags).map(([key, value]) => ({ key, value })))
        setShowAdvanced(true)
      } else {
        setTagPairs([{ key: '', value: '' }])
      }

      if (cfg?.params?.agent_type) {
        setShowAdvanced(true)
      }

      const sandbox = cfg?.params?.sandbox
      if (sandbox) {
        setSandboxEnabled(sandbox.enabled)
        if (sandbox.rules && sandbox.rules.length > 0) {
          setSandboxRules(rulesFromAPI(sandbox.rules))
        } else if (sandbox.allowed_domains && sandbox.allowed_domains.length > 0) {
          // Migrate legacy allowlist to rules
          setSandboxRules([
            { id: newRuleId(), index: 0, action: 'deny', domains: '*', importProfileId: '', importManagedName: '' },
            { id: newRuleId(), index: 10, action: 'allow', domains: sandbox.allowed_domains.join('\n'), importProfileId: '', importManagedName: '' },
          ])
        } else if (sandbox.denied_domains && sandbox.denied_domains.length > 0) {
          setSandboxRules([
            { id: newRuleId(), index: 0, action: 'deny', domains: sandbox.denied_domains.join('\n'), importProfileId: '', importManagedName: '' },
          ])
        } else {
          setSandboxRules([])
        }
        if (sandbox.enabled) setShowAdvanced(true)
      } else {
        setSandboxEnabled(false)
        setSandboxRules([])
      }
    } else {
      setName('')
      setDescription('')
      setIsDefault(false)
      setIsManaged(false)
      setEnvPairs([{ key: '', value: '' }])
      setTagPairs([{ key: '', value: '' }])
      setAgentType('')
      setSandboxEnabled(false)
      setSandboxRules([])
      setShowAdvanced(false)
    }
    setError(null)
  }, [editingProfile, isOpen])

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  // Key-value pair helpers
  const updatePair = (
    pairs: KeyValuePair[],
    setPairs: React.Dispatch<React.SetStateAction<KeyValuePair[]>>,
    index: number,
    field: 'key' | 'value',
    val: string
  ) => {
    const next = [...pairs]
    next[index] = { ...next[index], [field]: val }
    setPairs(next)
  }

  const addPair = (setPairs: React.Dispatch<React.SetStateAction<KeyValuePair[]>>) => {
    setPairs((prev) => [...prev, { key: '', value: '' }])
  }

  const removePair = (
    pairs: KeyValuePair[],
    setPairs: React.Dispatch<React.SetStateAction<KeyValuePair[]>>,
    index: number
  ) => {
    if (pairs.length === 1) {
      setPairs([{ key: '', value: '' }])
    } else {
      setPairs((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const pairsToRecord = (pairs: KeyValuePair[]): Record<string, string> => {
    const record: Record<string, string> = {}
    pairs.forEach(({ key, value }) => {
      if (key.trim()) record[key.trim()] = value
    })
    return record
  }

  // Sandbox rule helpers
  const nextRuleIndex = () => {
    if (sandboxRules.length === 0) return 0
    return Math.max(...sandboxRules.map((r) => r.index)) + 10
  }

  const addRule = (action: SandboxRuleEdit['action']) => {
    setSandboxRules((prev) => [
      ...prev,
      { id: newRuleId(), index: nextRuleIndex(), action, domains: '', importProfileId: '', importManagedName: '' },
    ])
  }

  const updateRule = (id: string, patch: Partial<SandboxRuleEdit>) => {
    setSandboxRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeRule = (id: string) => {
    setSandboxRules((prev) => prev.filter((r) => r.id !== id))
  }

  const addDenyAllRule = () => {
    const minIndex = sandboxRules.length > 0 ? Math.min(...sandboxRules.map((r) => r.index)) - 10 : 0
    setSandboxRules((prev) => [
      { id: newRuleId(), index: minIndex < 0 ? 0 : minIndex, action: 'deny', domains: '*', importProfileId: '', importManagedName: '' },
      ...prev,
    ])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('名前は必須です')
      return
    }

    setIsSubmitting(true)
    try {
      const client = createAgentAPIProxyClientFromStorage()

      const environment = pairsToRecord(envPairs)
      const tags = pairsToRecord(tagPairs)

      // Build sandbox config
      let sandboxConfig: { enabled: boolean; rules?: NetworkFilterRule[] } | undefined
      if (sandboxEnabled) {
        sandboxConfig = {
          enabled: true,
          ...(sandboxRules.length > 0 ? { rules: rulesToAPI(sandboxRules) } : {}),
        }
      }

      const hasParams = agentType.trim() || sandboxConfig
      const params = hasParams ? {
        ...(agentType.trim() ? { agent_type: agentType.trim() } : {}),
        ...(sandboxConfig ? { sandbox: sandboxConfig } : {}),
      } : undefined

      const config = {
        ...(Object.keys(environment).length > 0 ? { environment } : {}),
        ...(Object.keys(tags).length > 0 ? { tags } : {}),
        ...(params ? { params } : {}),
      }

      if (isEditing && editingProfile) {
        const updateData: UpdateSessionProfileRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          is_default: isDefault,
          ...(isAdmin ? { is_managed: isManaged } : {}),
          config: Object.keys(config).length > 0 ? config : undefined,
        }
        await client.updateSessionProfile(editingProfile.id, updateData)
      } else {
        const scopeParams = getScopeParams()
        const createData: CreateSessionProfileRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          is_default: isDefault,
          ...(isAdmin ? { is_managed: isManaged } : {}),
          ...(Object.keys(config).length > 0 ? { config } : {}),
          ...scopeParams,
        }
        await client.createSessionProfile(createData)
      }

      onSuccess()
    } catch (err) {
      console.error('Failed to save session profile:', err)
      setError(err instanceof Error ? err.message : 'セッションプロファイルの保存に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const sortedRules = sandboxRules.slice().sort((a, b) => a.index - b.index)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'プロファイルを編集' : '新しいプロファイル'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto overflow-x-hidden">
            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: my-profile"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                説明
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="このプロファイルの用途を説明してください"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            {/* is_default */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    デフォルトプロファイルに設定する
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    セッション作成時にこのプロファイルをデフォルトとして使用します。
                  </p>
                </div>
              </label>
            </div>

            {/* is_managed (admin only) */}
            {isAdmin && (
              <div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isManaged}
                    onChange={(e) => setIsManaged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Managedプロファイルとして登録する
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-normal">管理者専用</span>
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Managedプロファイルはシステム管理者が提供するルールセットです。他のプロファイルからmanaged_importアクションで参照できます。
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Config Section */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                設定（Config）
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-5 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                  {/* Environment Variables */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      環境変数
                    </label>
                    <div className="space-y-2">
                      {envPairs.map((pair, idx) => (
                        <div key={idx} className="rounded border border-gray-200 dark:border-gray-600 p-2 space-y-1.5 bg-gray-50 dark:bg-gray-900/40">
                          <input
                            type="text"
                            value={pair.key}
                            onChange={(e) => updatePair(envPairs, setEnvPairs, idx, 'key', e.target.value)}
                            placeholder="KEY"
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={pair.value}
                              onChange={(e) => updatePair(envPairs, setEnvPairs, idx, 'value', e.target.value)}
                              placeholder="value"
                              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => removePair(envPairs, setEnvPairs, idx)}
                              className="shrink-0 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addPair(setEnvPairs)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        追加
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      タグ
                    </label>
                    <div className="space-y-2">
                      {tagPairs.map((pair, idx) => (
                        <div key={idx} className="rounded border border-gray-200 dark:border-gray-600 p-2 space-y-1.5 bg-gray-50 dark:bg-gray-900/40">
                          <input
                            type="text"
                            value={pair.key}
                            onChange={(e) => updatePair(tagPairs, setTagPairs, idx, 'key', e.target.value)}
                            placeholder="key"
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={pair.value}
                              onChange={(e) => updatePair(tagPairs, setTagPairs, idx, 'value', e.target.value)}
                              placeholder="value"
                              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => removePair(tagPairs, setTagPairs, idx)}
                              className="shrink-0 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addPair(setTagPairs)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        追加
                      </button>
                    </div>
                  </div>

                  {/* Agent Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      エージェントタイプ
                    </label>
                    <div className="space-y-2">
                      {([
                        { value: '', label: 'デフォルト', description: 'agent_type を送信しない' },
                        { value: 'claude-agentapi', label: 'Claude AgentAPI', description: 'agent_type=claude-agentapi を送信' },
                        { value: 'codex-agentapi', label: 'Codex AgentAPI', description: 'agent_type=codex-agentapi を送信' },
                        { value: 'claude-acp', label: 'Claude ACP', description: 'agent_type=claude-acp を送信' },
                        { value: 'codex-acp', label: 'Codex ACP', description: 'agent_type=codex-acp を送信' },
                      ]).map(({ value: v, label, description }) => (
                        <label key={v} className="flex items-start cursor-pointer group">
                          <input
                            type="radio"
                            name="profile-agent-type"
                            value={v}
                            checked={agentType === v}
                            onChange={() => setAgentType(v)}
                            className="mt-0.5 w-3.5 h-3.5 text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                          />
                          <span className="ml-2">
                            <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">
                              {label}
                            </span>
                            <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Sandbox */}
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sandboxEnabled}
                        onChange={(e) => setSandboxEnabled(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          サンドボックス（ネットワーク制限）を有効にする
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          セッションのアウトバウンドネットワークアクセスをドメインレベルで制限します。
                        </p>
                      </div>
                    </label>

                    {sandboxEnabled && (
                      <div className="mt-3 ml-6 space-y-3">
                        {/* Explanation */}
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400">
                          ルールは <strong>index 昇順</strong> に評価され、<strong>最後にマッチしたルールが適用</strong>されます。どのルールにもマッチしない場合は<strong>拒否</strong>（デフォルト拒否）。
                          <br />
                          <span className="mt-1 block">例: index 0 で全拒否 → index 10 で別プロファイルをインポート → index 20 で特定ドメインを拒否</span>
                        </div>

                        {/* Quick presets */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={addDenyAllRule}
                            className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
                          >
                            + 全拒否ルール追加 (deny *)
                          </button>
                        </div>

                        {/* Rule list */}
                        {sortedRules.length > 0 && (
                          <div className="space-y-2">
                            {sortedRules.map((rule) => (
                              <div
                                key={rule.id}
                                className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/50 p-2.5 space-y-2"
                              >
                                {/* Main row: index | action dropdown | inline content | delete
                                    On mobile, import selectors wrap to a second line (order-last + w-full).
                                    On sm+, they stay inline (order-none + flex-1). */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Index */}
                                  <input
                                    type="number"
                                    value={rule.index}
                                    onChange={(e) => updateRule(rule.id, { index: parseInt(e.target.value) || 0 })}
                                    className="w-14 shrink-0 px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-gray-400 text-center"
                                    title="評価順 (低い値が先)"
                                  />

                                  {/* Action dropdown */}
                                  <select
                                    value={rule.action}
                                    onChange={(e) => updateRule(rule.id, { action: e.target.value as SandboxRuleEdit['action'] })}
                                    className={`shrink-0 px-2 py-1.5 border rounded text-xs font-medium focus:outline-none focus:ring-1 cursor-pointer ${ACTION_SELECT_COLORS[rule.action]}`}
                                  >
                                    <option value="allow">許可 (allow)</option>
                                    <option value="deny">拒否 (deny)</option>
                                    <option value="import">インポート</option>
                                    <option value="managed_import">Managedインポート</option>
                                    <option value="managed_import_all">Managed全インポート</option>
                                  </select>

                                  {/* managed_import_all / spacers: always inline */}
                                  {rule.action === 'managed_import_all' && (
                                    <span className="flex-1 text-xs text-purple-600 dark:text-purple-400 italic">
                                      全Managedプロファイルをインポート（追加設定なし）
                                    </span>
                                  )}
                                  {(rule.action === 'allow' || rule.action === 'deny') && (
                                    <div className="flex-1" />
                                  )}

                                  {/* Delete — stays on the first row */}
                                  <button
                                    type="button"
                                    onClick={() => removeRule(rule.id)}
                                    className="shrink-0 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                    title="このルールを削除"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>

                                  {/* Import selectors: inline on sm+, wrap to 2nd row on mobile */}
                                  {rule.action === 'import' && (
                                    <div className="order-last w-full sm:order-none sm:flex-1 sm:w-auto min-w-0">
                                      {availableProfiles.length > 0 ? (
                                        <select
                                          value={rule.importProfileId}
                                          onChange={(e) => updateRule(rule.id, { importProfileId: e.target.value })}
                                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                          <option value="">プロファイルを選択...</option>
                                          {availableProfiles.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type="text"
                                          value={rule.importProfileId}
                                          onChange={(e) => updateRule(rule.id, { importProfileId: e.target.value })}
                                          placeholder="プロファイルID..."
                                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      )}
                                    </div>
                                  )}

                                  {rule.action === 'managed_import' && (
                                    <div className="order-last w-full sm:order-none sm:flex-1 sm:w-auto min-w-0">
                                      {managedProfiles.length > 0 ? (
                                        <select
                                          value={rule.importManagedName}
                                          onChange={(e) => updateRule(rule.id, { importManagedName: e.target.value })}
                                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        >
                                          <option value="">Managedプロファイルを選択...</option>
                                          {managedProfiles.map((p) => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type="text"
                                          value={rule.importManagedName}
                                          onChange={(e) => updateRule(rule.id, { importManagedName: e.target.value })}
                                          placeholder="Managedプロファイル名..."
                                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Domains textarea for allow/deny (below the main row) */}
                                {(rule.action === 'allow' || rule.action === 'deny') && (
                                  <textarea
                                    value={rule.domains}
                                    onChange={(e) => updateRule(rule.id, { domains: e.target.value })}
                                    placeholder={rule.action === 'deny' ? '* （全ドメイン拒否）\nbad.example.com' : 'api.github.com\n*.npm.com'}
                                    rows={2}
                                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y"
                                    aria-label="ドメイン（1行に1つ、*.example.com のワイルドカード使用可、* で全ドメイン）"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add rule buttons */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => addRule('allow')}
                            className="text-xs px-2.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            ルールを追加
                          </button>
                          <button
                            type="button"
                            onClick={addDenyAllRule}
                            className="text-xs px-2.5 py-1 rounded border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            全拒否ルール追加 (deny *)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {isEditing ? '保存' : '作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
