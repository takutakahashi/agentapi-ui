'use client'

import { useState, useEffect } from 'react'
import {
  Webhook,
  CreateWebhookRequest,
  WebhookTrigger,
  WebhookType,
  WebhookSignatureType,
  GitHubConditions,
  JSONPathCondition,
  GITHUB_EVENTS,
  GITHUB_ACTIONS,
} from '../../types/webhook'
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client'
import { OrganizationHistory } from '../../utils/organizationHistory'
import { useTeamScope } from '../../contexts/TeamScopeContext'

interface WebhookFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingWebhook?: Webhook | null
}

interface TriggerFormData {
  id?: string
  name: string
  enabled: boolean
  // GitHub conditions
  events: string[]
  actions: string[]
  baseBranches: string[]
  // JSONPath conditions
  jsonpathConditions: JSONPathCondition[]
  initialMessageTemplate: string
}

const emptyTrigger: TriggerFormData = {
  name: '',
  enabled: true,
  events: [],
  actions: [],
  baseBranches: [],
  jsonpathConditions: [],
  initialMessageTemplate: '',
}

const emptyJSONPathCondition: JSONPathCondition = {
  path: '',
  operator: 'eq',
  value: '',
}

export default function WebhookFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingWebhook,
}: WebhookFormModalProps) {
  const { getScopeParams } = useTeamScope()
  const [name, setName] = useState('')
  const [webhookType, setWebhookType] = useState<WebhookType>('github')
  const [signatureHeader, setSignatureHeader] = useState('X-Signature')
  const [signatureType, setSignatureType] = useState<WebhookSignatureType>('hmac')

  // GitHub-specific fields
  const [allowedEvents, setAllowedEvents] = useState<string[]>([])
  const [allowedRepositories, setAllowedRepositories] = useState('')

  const [triggers, setTriggers] = useState<TriggerFormData[]>([{ ...emptyTrigger }])
  const [repositorySuggestions, setRepositorySuggestions] = useState<string[]>([])
  const [showRepositorySuggestions, setShowRepositorySuggestions] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTrigger, setExpandedTrigger] = useState<number | null>(0)

  const isEditing = !!editingWebhook

  // Initialize form when editing
  useEffect(() => {
    if (editingWebhook) {
      setName(editingWebhook.name)
      setWebhookType(editingWebhook.type)
      setSignatureHeader(editingWebhook.signature_header || 'X-Signature')
      setSignatureType(editingWebhook.signature_type || 'hmac')
      setAllowedEvents(editingWebhook.github?.allowed_events || [])
      setAllowedRepositories(editingWebhook.github?.allowed_repositories?.join(', ') || '')

      if (editingWebhook.triggers && editingWebhook.triggers.length > 0) {
        setTriggers(
          editingWebhook.triggers.map((t) => ({
            id: t.id,
            name: t.name,
            enabled: t.enabled ?? true,
            events: t.conditions.github?.events || [],
            actions: t.conditions.github?.actions || [],
            baseBranches: t.conditions.github?.base_branches || [],
            jsonpathConditions: t.conditions.jsonpath || [],
            initialMessageTemplate: t.session_config?.initial_message_template || '',
          }))
        )
      } else {
        setTriggers([{ ...emptyTrigger }])
      }
    } else {
      resetForm()
    }
  }, [editingWebhook, isOpen])

  // ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const resetForm = () => {
    setName('')
    setWebhookType('github')
    setSignatureHeader('X-Signature')
    setSignatureType('hmac')
    setAllowedEvents([])
    setAllowedRepositories('')
    setTriggers([{ ...emptyTrigger }])
    setError(null)
    setExpandedTrigger(0)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleRepositoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setAllowedRepositories(value)

    if (value.trim()) {
      const suggestions = OrganizationHistory.getRepositorySuggestions(value)
      setRepositorySuggestions(suggestions)
      setShowRepositorySuggestions(suggestions.length > 0)
    } else {
      setShowRepositorySuggestions(false)
    }
  }

  const handleRepositoryFocus = () => {
    const suggestions = OrganizationHistory.getRepositorySuggestions()
    setRepositorySuggestions(suggestions)
    setShowRepositorySuggestions(suggestions.length > 0)
  }

  const handleRepositoryBlur = () => {
    setTimeout(() => setShowRepositorySuggestions(false), 150)
  }

  const selectRepositorySuggestion = (suggestion: string) => {
    const current = allowedRepositories.trim()
    if (current) {
      setAllowedRepositories(current + ', ' + suggestion)
    } else {
      setAllowedRepositories(suggestion)
    }
    setShowRepositorySuggestions(false)
  }

  const toggleAllowedEvent = (event: string) => {
    setAllowedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  const addTrigger = () => {
    setTriggers((prev) => [...prev, { ...emptyTrigger }])
    setExpandedTrigger(triggers.length)
  }

  const removeTrigger = (index: number) => {
    if (triggers.length <= 1) return
    setTriggers((prev) => prev.filter((_, i) => i !== index))
    if (expandedTrigger === index) {
      setExpandedTrigger(null)
    } else if (expandedTrigger !== null && expandedTrigger > index) {
      setExpandedTrigger(expandedTrigger - 1)
    }
  }

  const updateTrigger = (index: number, field: keyof TriggerFormData, value: unknown) => {
    setTriggers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    )
  }

  const toggleTriggerEvent = (index: number, event: string) => {
    const trigger = triggers[index]
    const newEvents = trigger.events.includes(event)
      ? trigger.events.filter((e) => e !== event)
      : [...trigger.events, event]
    updateTrigger(index, 'events', newEvents)
  }

  const toggleTriggerAction = (index: number, action: string) => {
    const trigger = triggers[index]
    const newActions = trigger.actions.includes(action)
      ? trigger.actions.filter((a) => a !== action)
      : [...trigger.actions, action]
    updateTrigger(index, 'actions', newActions)
  }

  const getAvailableActions = (events: string[]): { label: string; value: string }[] => {
    const allActions: { label: string; value: string }[] = []
    const seen = new Set<string>()

    for (const event of events) {
      const actions = GITHUB_ACTIONS[event as keyof typeof GITHUB_ACTIONS]
      if (actions) {
        for (const action of actions) {
          if (!seen.has(action.value)) {
            seen.add(action.value)
            allActions.push(action)
          }
        }
      }
    }

    return allActions
  }

  // JSONPath condition management
  const addJSONPathCondition = (triggerIndex: number) => {
    const trigger = triggers[triggerIndex]
    const newConditions = [...trigger.jsonpathConditions, { ...emptyJSONPathCondition }]
    updateTrigger(triggerIndex, 'jsonpathConditions', newConditions)
  }

  const removeJSONPathCondition = (triggerIndex: number, conditionIndex: number) => {
    const trigger = triggers[triggerIndex]
    const newConditions = trigger.jsonpathConditions.filter((_, i) => i !== conditionIndex)
    updateTrigger(triggerIndex, 'jsonpathConditions', newConditions)
  }

  const updateJSONPathCondition = (
    triggerIndex: number,
    conditionIndex: number,
    field: keyof JSONPathCondition,
    value: string
  ) => {
    const trigger = triggers[triggerIndex]
    const newConditions = trigger.jsonpathConditions.map((cond, i) =>
      i === conditionIndex ? { ...cond, [field]: value } : cond
    )
    updateTrigger(triggerIndex, 'jsonpathConditions', newConditions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Webhook名を入力してください')
      return
    }

    const validTriggers = triggers.filter((t) => t.name.trim())
    if (validTriggers.length === 0) {
      setError('少なくとも1つのトリガーを設定してください')
      return
    }

    // Validate JSONPath conditions for custom webhooks
    if (webhookType === 'custom') {
      for (const trigger of validTriggers) {
        if (trigger.jsonpathConditions.length === 0) {
          setError('Custom webhookには少なくとも1つのJSONPath条件が必要です')
          return
        }
        for (const condition of trigger.jsonpathConditions) {
          if (!condition.path.trim()) {
            setError('JSONPathを入力してください')
            return
          }
        }
      }
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const client = createAgentAPIProxyClientFromStorage()

      // Get scope parameters from context
      const scopeParams = getScopeParams()

      // Parse allowed repositories
      const repoList = allowedRepositories
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r)

      const webhookTriggers: WebhookTrigger[] = validTriggers.map((t) => {
        const trigger: WebhookTrigger = {
          id: t.id,
          name: t.name.trim(),
          enabled: t.enabled,
          conditions: {},
          session_config: t.initialMessageTemplate.trim()
            ? { initial_message_template: t.initialMessageTemplate.trim() }
            : undefined,
        }

        if (webhookType === 'github') {
          const githubConditions: GitHubConditions = {}
          if (t.events.length > 0) {
            githubConditions.events = t.events
          }
          if (t.actions.length > 0) {
            githubConditions.actions = t.actions
          }
          if (t.baseBranches.length > 0) {
            githubConditions.base_branches = t.baseBranches
          }
          trigger.conditions.github = githubConditions
        } else {
          // Custom webhook - use JSONPath conditions
          trigger.conditions.jsonpath = t.jsonpathConditions.filter((c) => c.path.trim())
        }

        return trigger
      })

      const webhookData: CreateWebhookRequest = {
        name: name.trim(),
        type: webhookType,
        signature_header: signatureHeader.trim() || undefined,
        signature_type: signatureType,
        triggers: webhookTriggers,
        ...scopeParams,
      }

      // Add GitHub-specific config only for github type
      if (webhookType === 'github') {
        webhookData.github = {
          allowed_events: allowedEvents.length > 0 ? allowedEvents : undefined,
          allowed_repositories: repoList.length > 0 ? repoList : undefined,
        }
      }

      if (isEditing && editingWebhook) {
        await client.updateWebhook(editingWebhook.id, webhookData)
      } else {
        await client.createWebhook(webhookData)
      }

      onSuccess()
      handleClose()
    } catch (err) {
      console.error('Failed to save webhook:', err)
      setError(err instanceof Error ? err.message : 'Webhookの保存に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Webhookを編集' : '新しいWebhook'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
              基本情報
            </h3>

            {/* Webhook Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Webhook名 *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: PR Review Bot"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            {/* Webhook Type */}
            <div>
              <label htmlFor="webhookType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Webhookタイプ *
              </label>
              <select
                id="webhookType"
                value={webhookType}
                onChange={(e) => setWebhookType(e.target.value as WebhookType)}
                disabled={isSubmitting || isEditing}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="github">GitHub</option>
                <option value="custom">Custom</option>
              </select>
              {isEditing && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  編集中はWebhookタイプを変更できません
                </p>
              )}
            </div>
          </div>

          {/* Signature Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
              署名設定
            </h3>

            {/* Signature Type */}
            <div>
              <label htmlFor="signatureType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                署名タイプ
              </label>
              <select
                id="signatureType"
                value={signatureType}
                onChange={(e) => setSignatureType(e.target.value as WebhookSignatureType)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="hmac">HMAC（推奨）</option>
                <option value="static">Static Token</option>
                <option value="none">None（検証なし）</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                HMAC: HMAC-SHA256署名検証（GitHub, Slackなど）、Static: トークン比較、None: 検証なし（開発用）
              </p>
            </div>

            {/* Signature Header */}
            <div>
              <label htmlFor="signatureHeader" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                署名ヘッダー名
              </label>
              <input
                id="signatureHeader"
                type="text"
                value={signatureHeader}
                onChange={(e) => setSignatureHeader(e.target.value)}
                placeholder="例: X-Signature, X-Hub-Signature-256"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                署名を含むHTTPヘッダー名。デフォルト: X-Signature
              </p>
            </div>
          </div>

          {/* GitHub Settings - Only for github type */}
          {webhookType === 'github' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
                GitHub設定
              </h3>

              {/* Allowed Events */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  許可イベント
                </label>
                <div className="flex flex-wrap gap-2">
                  {GITHUB_EVENTS.map((event) => (
                    <button
                      key={event.value}
                      type="button"
                      onClick={() => toggleAllowedEvent(event.value)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        allowedEvents.includes(event.value)
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                      title={event.description}
                    >
                      {event.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  空の場合、すべてのイベントを許可します
                </p>
              </div>

              {/* Allowed Repositories */}
              <div className="relative">
                <label htmlFor="allowedRepositories" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  許可リポジトリ
                </label>
                <input
                  id="allowedRepositories"
                  type="text"
                  value={allowedRepositories}
                  onChange={handleRepositoryChange}
                  onFocus={handleRepositoryFocus}
                  onBlur={handleRepositoryBlur}
                  placeholder="例: owner/repo, owner/*"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />

                {/* Repository Suggestions */}
                {showRepositorySuggestions && repositorySuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {repositorySuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectRepositorySuggestion(suggestion)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-mono"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  カンマ区切りで複数指定可。空の場合、すべてのリポジトリを許可します
                </p>
              </div>
            </div>
          )}

          {/* Triggers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                トリガー
              </h3>
              <button
                type="button"
                onClick={addTrigger}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                トリガーを追加
              </button>
            </div>

            <div className="space-y-3">
              {triggers.map((trigger, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden"
                >
                  {/* Trigger Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 cursor-pointer"
                    onClick={() => setExpandedTrigger(expandedTrigger === index ? null : index)}
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${
                          expandedTrigger === index ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {trigger.name || `トリガー ${index + 1}`}
                      </span>
                      {!trigger.enabled && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                          無効
                        </span>
                      )}
                    </div>
                    {triggers.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTrigger(index)
                        }}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Trigger Body */}
                  {expandedTrigger === index && (
                    <div className="px-4 py-4 space-y-4">
                      {/* Trigger Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          トリガー名 *
                        </label>
                        <input
                          type="text"
                          value={trigger.name}
                          onChange={(e) => updateTrigger(index, 'name', e.target.value)}
                          placeholder="例: Review PR on open"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>

                      {/* Enabled Toggle */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`trigger-enabled-${index}`}
                          checked={trigger.enabled}
                          onChange={(e) => updateTrigger(index, 'enabled', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`trigger-enabled-${index}`} className="text-sm text-gray-700 dark:text-gray-300">
                          このトリガーを有効にする
                        </label>
                      </div>

                      {/* GitHub Conditions */}
                      {webhookType === 'github' && (
                        <>
                          {/* Events */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              イベント
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {GITHUB_EVENTS.map((event) => (
                                <button
                                  key={event.value}
                                  type="button"
                                  onClick={() => toggleTriggerEvent(index, event.value)}
                                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                    trigger.events.includes(event.value)
                                      ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  {event.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Actions */}
                          {trigger.events.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                アクション
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {getAvailableActions(trigger.events).map((action) => (
                                  <button
                                    key={action.value}
                                    type="button"
                                    onClick={() => toggleTriggerAction(index, action.value)}
                                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                      trigger.actions.includes(action.value)
                                        ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Base Branches */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              ベースブランチ
                            </label>
                            <input
                              type="text"
                              value={trigger.baseBranches.join(', ')}
                              onChange={(e) =>
                                updateTrigger(
                                  index,
                                  'baseBranches',
                                  e.target.value.split(',').map((b) => b.trim()).filter((b) => b)
                                )
                              }
                              placeholder="例: main, develop"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              PRのベースブランチでフィルタ（カンマ区切り）
                            </p>
                          </div>
                        </>
                      )}

                      {/* JSONPath Conditions - for custom webhooks */}
                      {webhookType === 'custom' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              JSONPath条件 *
                            </label>
                            <button
                              type="button"
                              onClick={() => addJSONPathCondition(index)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              + 条件を追加
                            </button>
                          </div>

                          {trigger.jsonpathConditions.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                              条件が設定されていません
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {trigger.jsonpathConditions.map((condition, condIndex) => (
                                <div
                                  key={condIndex}
                                  className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                                >
                                  <div className="flex-1 space-y-2">
                                    {/* JSONPath */}
                                    <input
                                      type="text"
                                      value={condition.path}
                                      onChange={(e) =>
                                        updateJSONPathCondition(index, condIndex, 'path', e.target.value)
                                      }
                                      placeholder="例: $.event.type"
                                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                                    />

                                    <div className="flex gap-2">
                                      {/* Operator */}
                                      <select
                                        value={condition.operator}
                                        onChange={(e) =>
                                          updateJSONPathCondition(index, condIndex, 'operator', e.target.value)
                                        }
                                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      >
                                        <option value="eq">等しい (==)</option>
                                        <option value="ne">等しくない (!=)</option>
                                        <option value="contains">含む</option>
                                        <option value="matches">正規表現</option>
                                        <option value="in">いずれか</option>
                                        <option value="exists">存在する</option>
                                      </select>

                                      {/* Value */}
                                      {condition.operator !== 'exists' && (
                                        <input
                                          type="text"
                                          value={String(condition.value)}
                                          onChange={(e) =>
                                            updateJSONPathCondition(index, condIndex, 'value', e.target.value)
                                          }
                                          placeholder="値"
                                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {/* Remove button */}
                                  <button
                                    type="button"
                                    onClick={() => removeJSONPathCondition(index, condIndex)}
                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 mt-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            JSONPath形式でペイロードの条件を指定します。例: $.event.type, $.data[0].status
                          </p>
                        </div>
                      )}

                      {/* Initial Message Template */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          初期メッセージテンプレート
                        </label>
                        <textarea
                          value={trigger.initialMessageTemplate}
                          onChange={(e) => updateTrigger(index, 'initialMessageTemplate', e.target.value)}
                          placeholder={
                            webhookType === 'github'
                              ? '例: Review PR #{{.pull_request.Number}} in {{.repository.FullName}}'
                              : '例: Handle event: {{.event.type}}'
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono resize-y"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {webhookType === 'github'
                            ? "Goテンプレート形式。例: {{.pull_request.Number}}"
                            : 'Goテンプレート形式でペイロードの値を参照できます'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </>
              ) : (
                isEditing ? '更新' : '作成'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
