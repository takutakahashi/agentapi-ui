'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  SlackBot,
  CreateSlackBotRequest,
  UpdateSlackBotRequest,
  SLACK_EVENT_TYPES,
} from '../../types/slackbot'
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client'
import { useTeamScope } from '../../contexts/TeamScopeContext'

interface SlackbotFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingSlackbot?: SlackBot | null
}

type KeyValuePair = { key: string; value: string }

export default function SlackbotFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingSlackbot,
}: SlackbotFormModalProps) {
  const { getScopeParams } = useTeamScope()

  // Basic fields
  const [name, setName] = useState('')
  const [signingSecret, setSigningSecret] = useState('')
  const [botTokenSecretName, setBotTokenSecretName] = useState('')
  const [botTokenSecretKey, setBotTokenSecretKey] = useState('')
  const [maxSessions, setMaxSessions] = useState<number>(10)

  // Allowed event types
  const [allowedEventTypes, setAllowedEventTypes] = useState<string[]>([])

  // Allowed channel IDs (chip/tag input)
  const [allowedChannelIds, setAllowedChannelIds] = useState<string[]>([])
  const [channelIdInput, setChannelIdInput] = useState('')

  // Session config
  const [initialMessageTemplate, setInitialMessageTemplate] = useState('')
  const [reuseMessageTemplate, setReuseMessageTemplate] = useState('')
  const [envPairs, setEnvPairs] = useState<KeyValuePair[]>([{ key: '', value: '' }])
  const [tagPairs, setTagPairs] = useState<KeyValuePair[]>([{ key: '', value: '' }])

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const isEditing = !!editingSlackbot

  // Initialize form when editing
  useEffect(() => {
    if (editingSlackbot) {
      setName(editingSlackbot.name)
      setSigningSecret('') // Don't prefill secret on edit
      setBotTokenSecretName(editingSlackbot.bot_token_secret_name || '')
      setBotTokenSecretKey(editingSlackbot.bot_token_secret_key || '')
      setMaxSessions(editingSlackbot.max_sessions ?? 10)
      setAllowedEventTypes(editingSlackbot.allowed_event_types || [])
      setAllowedChannelIds(editingSlackbot.allowed_channel_ids || [])

      const sc = editingSlackbot.session_config
      setInitialMessageTemplate(sc?.initial_message_template || '')
      setReuseMessageTemplate(sc?.reuse_message_template || '')

      if (sc?.environment && Object.keys(sc.environment).length > 0) {
        setEnvPairs(Object.entries(sc.environment).map(([key, value]) => ({ key, value })))
        setShowAdvanced(true)
      } else {
        setEnvPairs([{ key: '', value: '' }])
      }

      if (sc?.tags && Object.keys(sc.tags).length > 0) {
        setTagPairs(Object.entries(sc.tags).map(([key, value]) => ({ key, value })))
        setShowAdvanced(true)
      } else {
        setTagPairs([{ key: '', value: '' }])
      }
    } else {
      // Reset form
      setName('')
      setSigningSecret('')
      setBotTokenSecretName('')
      setBotTokenSecretKey('')
      setMaxSessions(10)
      setAllowedEventTypes([])
      setAllowedChannelIds([])
      setChannelIdInput('')
      setInitialMessageTemplate('')
      setReuseMessageTemplate('')
      setEnvPairs([{ key: '', value: '' }])
      setTagPairs([{ key: '', value: '' }])
      setShowAdvanced(false)
    }
    setError(null)
  }, [editingSlackbot, isOpen])

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

  // Allowed event types toggle
  const toggleEventType = (value: string) => {
    setAllowedEventTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  // Channel ID chip input
  const addChannelId = () => {
    const trimmed = channelIdInput.trim()
    if (trimmed && !allowedChannelIds.includes(trimmed)) {
      setAllowedChannelIds((prev) => [...prev, trimmed])
    }
    setChannelIdInput('')
  }

  const handleChannelIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addChannelId()
    }
  }

  const removeChannelId = (id: string) => {
    setAllowedChannelIds((prev) => prev.filter((c) => c !== id))
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!name.trim()) {
      setError('名前は必須です')
      return
    }
    if (!isEditing && !signingSecret.trim()) {
      setError('Signing Secret は必須です')
      return
    }

    setIsSubmitting(true)
    try {
      const client = createAgentAPIProxyClientFromStorage()

      const environment = pairsToRecord(envPairs)
      const tags = pairsToRecord(tagPairs)

      const sessionConfig = {
        ...(initialMessageTemplate.trim() ? { initial_message_template: initialMessageTemplate.trim() } : {}),
        ...(reuseMessageTemplate.trim() ? { reuse_message_template: reuseMessageTemplate.trim() } : {}),
        ...(Object.keys(environment).length > 0 ? { environment } : {}),
        ...(Object.keys(tags).length > 0 ? { tags } : {}),
      }

      if (isEditing && editingSlackbot) {
        const updateData: UpdateSlackBotRequest = {
          name: name.trim(),
          ...(signingSecret.trim() ? { signing_secret: signingSecret.trim() } : {}),
          ...(botTokenSecretName.trim() ? { bot_token_secret_name: botTokenSecretName.trim() } : {}),
          ...(botTokenSecretKey.trim() ? { bot_token_secret_key: botTokenSecretKey.trim() } : {}),
          allowed_event_types: allowedEventTypes,
          allowed_channel_ids: allowedChannelIds,
          max_sessions: maxSessions,
          ...(Object.keys(sessionConfig).length > 0 ? { session_config: sessionConfig } : {}),
        }
        await client.updateSlackBot(editingSlackbot.id, updateData)
      } else {
        const scopeParams = getScopeParams()
        const createData: CreateSlackBotRequest = {
          name: name.trim(),
          signing_secret: signingSecret.trim(),
          ...(botTokenSecretName.trim() ? { bot_token_secret_name: botTokenSecretName.trim() } : {}),
          ...(botTokenSecretKey.trim() ? { bot_token_secret_key: botTokenSecretKey.trim() } : {}),
          allowed_event_types: allowedEventTypes,
          allowed_channel_ids: allowedChannelIds,
          max_sessions: maxSessions,
          ...(Object.keys(sessionConfig).length > 0 ? { session_config: sessionConfig } : {}),
          ...scopeParams,
        }
        await client.createSlackBot(createData)
      }

      onSuccess()
    } catch (err) {
      console.error('Failed to save slackbot:', err)
      setError(err instanceof Error ? err.message : 'Slackbotの保存に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

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
              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5zm2-8a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5zm8 2a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2v-2zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5zm-2 8a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Slackbot を編集' : '新しいSlackbot'}
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
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
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
                placeholder="例: my-slackbot"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                required
              />
            </div>

            {/* Signing Secret */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Signing Secret {!isEditing && <span className="text-red-500">*</span>}
                {isEditing && <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">（変更する場合のみ入力）</span>}
              </label>
              <input
                type="password"
                value={signingSecret}
                onChange={(e) => setSigningSecret(e.target.value)}
                placeholder={isEditing ? '変更する場合のみ入力してください' : 'Slack App の Signing Secret'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                {...(!isEditing ? { required: true } : {})}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Slack App の「Basic Information」→「App Credentials」から取得できます
              </p>
            </div>

            {/* Allowed Event Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                許可するイベント種別
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                未選択の場合はすべてのイベントを処理します
              </p>
              <div className="space-y-2">
                {SLACK_EVENT_TYPES.map((eventType) => (
                  <label
                    key={eventType.value}
                    className="flex items-start gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={allowedEventTypes.includes(eventType.value)}
                      onChange={() => toggleEventType(eventType.value)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                        {eventType.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{eventType.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Allowed Channel IDs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                許可するチャンネル ID
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                未指定の場合はすべてのチャンネルを処理します。Enter または カンマ で追加
              </p>
              {/* Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {allowedChannelIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-mono"
                  >
                    {id}
                    <button
                      type="button"
                      onClick={() => removeChannelId(id)}
                      className="ml-1 text-purple-500 hover:text-purple-700 dark:hover:text-purple-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={channelIdInput}
                  onChange={(e) => setChannelIdInput(e.target.value)}
                  onKeyDown={handleChannelIdKeyDown}
                  onBlur={addChannelId}
                  placeholder="C1234567890"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addChannelId}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  追加
                </button>
              </div>
            </div>

            {/* Initial Message Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                初期メッセージテンプレート
              </label>
              <textarea
                value={initialMessageTemplate}
                onChange={(e) => setInitialMessageTemplate(e.target.value)}
                placeholder="例: Slackから「{{.event.text}}」というメッセージが届きました。対応してください。"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Go テンプレート形式。<code className="font-mono">{'{{.event.text}}'}</code>、<code className="font-mono">{'{{.event.channel}}'}</code> などが使用可能
              </p>
            </div>

            {/* Advanced Section */}
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
                詳細設定
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-5 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                  {/* Max Sessions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      最大セッション数
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxSessions}
                      onChange={(e) => setMaxSessions(Number(e.target.value))}
                      className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Bot Token Secret */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bot Token Secret Name
                    </label>
                    <input
                      type="text"
                      value={botTokenSecretName}
                      onChange={(e) => setBotTokenSecretName(e.target.value)}
                      placeholder="例: my-slack-bot-token"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Slack Bot Token (xoxb-...) を格納する Kubernetes Secret 名。未指定の場合はグローバルデフォルトを使用
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bot Token Secret Key
                    </label>
                    <input
                      type="text"
                      value={botTokenSecretKey}
                      onChange={(e) => setBotTokenSecretKey(e.target.value)}
                      placeholder="bot-token"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Secret 内のキー名（デフォルト: bot-token）
                    </p>
                  </div>

                  {/* Reuse Message Template */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      再利用メッセージテンプレート
                    </label>
                    <textarea
                      value={reuseMessageTemplate}
                      onChange={(e) => setReuseMessageTemplate(e.target.value)}
                      placeholder="既存セッションを再利用する際のメッセージ"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Environment Variables */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      環境変数
                    </label>
                    <div className="space-y-2">
                      {envPairs.map((pair, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pair.key}
                            onChange={(e) => updatePair(envPairs, setEnvPairs, idx, 'key', e.target.value)}
                            placeholder="KEY"
                            className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-gray-400 dark:text-gray-500 text-xs">=</span>
                          <input
                            type="text"
                            value={pair.value}
                            onChange={(e) => updatePair(envPairs, setEnvPairs, idx, 'value', e.target.value)}
                            placeholder="value"
                            className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => removePair(envPairs, setEnvPairs, idx)}
                            className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
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
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pair.key}
                            onChange={(e) => updatePair(tagPairs, setTagPairs, idx, 'key', e.target.value)}
                            placeholder="key"
                            className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-gray-400 dark:text-gray-500 text-xs">=</span>
                          <input
                            type="text"
                            value={pair.value}
                            onChange={(e) => updatePair(tagPairs, setTagPairs, idx, 'value', e.target.value)}
                            placeholder="value"
                            className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => removePair(tagPairs, setTagPairs, idx)}
                            className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
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
              form="slackbot-form"
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
