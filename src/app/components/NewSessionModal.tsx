'use client'

import { useState, useEffect, useRef } from 'react'
import { createAgentAPIClient } from '../../lib/api'
import type { AgentAPIProxyClient } from '../../lib/agentapi-proxy-client'
import { InitialMessageCache } from '../../utils/initialMessageCache'
import { messageTemplateManager } from '../../utils/messageTemplateManager'
import { MessageTemplate } from '../../types/messageTemplate'
import { recentMessagesManager } from '../../utils/recentMessagesManager'
import { OrganizationHistory } from '../../utils/organizationHistory'
import { addRepositoryToHistory } from '../../types/settings'
import SessionCreationProgressModal from './SessionCreationProgressModal'
import { SessionCreationProgress, SessionCreationStatus } from '../../types/sessionProgress'

interface NewSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onSessionStart: (id: string, message: string, repository?: string) => void
  onSessionStatusUpdate: (id: string, status: 'creating' | 'waiting-agent' | 'sending-message' | 'completed' | 'failed') => void
  onSessionCompleted: (id: string) => void
}

export default function NewSessionModal({
  isOpen,
  onClose,
  onSuccess,
  onSessionStart,
  onSessionStatusUpdate,
  onSessionCompleted
}: NewSessionModalProps) {
  const [initialMessage, setInitialMessage] = useState('')
  const [freeFormRepository, setFreeFormRepository] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [cachedMessages, setCachedMessages] = useState<string[]>([])
  const [showCachedMessages, setShowCachedMessages] = useState(false)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [recentMessages, setRecentMessages] = useState<string[]>([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [freeFormRepositorySuggestions, setFreeFormRepositorySuggestions] = useState<string[]>([])
  const [showFreeFormRepositorySuggestions, setShowFreeFormRepositorySuggestions] = useState(false)
  const [sessionMode, setSessionMode] = useState<'repository' | 'chat'>('repository')
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [creationProgress, setCreationProgress] = useState<SessionCreationProgress | null>(null)
  const waitingCounterRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showTemplateModal) {
          setShowTemplateModal(false)
        } else if (isOpen) {
          handleClose()
        }
      }
    }

    if (isOpen || showTemplateModal) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, showTemplateModal])

  useEffect(() => {
    if (isOpen) {
      // キャッシュされたメッセージを読み込む
      const cached = InitialMessageCache.getCachedMessages()
      setCachedMessages(cached)

      // テンプレートを読み込む
      loadTemplates()

      // 最近のメッセージを読み込む
      loadRecentMessages()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    try {
      const allTemplates = await messageTemplateManager.getTemplates()
      setTemplates(allTemplates)
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplates([])
    }
  }

  const loadRecentMessages = async () => {
    try {
      const messages = await recentMessagesManager.getRecentMessages()
      setRecentMessages(messages.map(msg => msg.content))
    } catch (error) {
      console.error('Failed to load recent messages:', error)
    }
  }

  // 進捗状態を更新するヘルパー関数
  const updateProgress = (status: SessionCreationStatus, errorMessage?: string) => {
    setCreationProgress(prev => {
      if (!prev) return null
      return {
        ...prev,
        status,
        errorMessage,
        waitingProgress: status === 'waiting-agent' ? { current: 0, max: 120 } : undefined
      }
    })
  }

  // waiting-agent のカウンターを開始
  const startWaitingCounter = () => {
    if (waitingCounterRef.current) {
      clearInterval(waitingCounterRef.current)
    }
    waitingCounterRef.current = setInterval(() => {
      setCreationProgress(prev => {
        if (!prev || prev.status !== 'waiting-agent' || !prev.waitingProgress) return prev
        const newCurrent = prev.waitingProgress.current + 1
        if (newCurrent >= prev.waitingProgress.max) {
          return prev
        }
        return {
          ...prev,
          waitingProgress: { ...prev.waitingProgress, current: newCurrent }
        }
      })
    }, 1000)
  }

  // waiting-agent のカウンターを停止
  const stopWaitingCounter = () => {
    if (waitingCounterRef.current) {
      clearInterval(waitingCounterRef.current)
      waitingCounterRef.current = null
    }
  }

  const createSessionInBackground = async (client: AgentAPIProxyClient, message: string, repo: string, sessionId: string) => {
    try {
      console.log('Starting background session creation...')
      onSessionStatusUpdate(sessionId, 'creating')
      updateProgress('creating')

      const tags: Record<string, string> = {}

      if (repo) {
        tags.repository = repo
      }

      // 環境変数オブジェクトを構築
      const environment: Record<string, string> = {}

      // リポジトリ情報を環境変数に追加
      if (repo) {
        environment.REPOSITORY = repo
      }

      // セッションを作成
      const session = await client.start({
        environment,
        metadata: {
          description: message
        },
        tags: Object.keys(tags).length > 0 ? tags : undefined
      })
      console.log('Session created:', session)

      // セッション作成後、statusが "Agent Available" になるまで待機
      onSessionStatusUpdate(sessionId, 'waiting-agent')
      updateProgress('waiting-agent')
      startWaitingCounter()

      let retryCount = 0
      const maxRetries = 120 // 最大120回（2分）待機
      const retryInterval = 1000 // 1秒間隔

      while (retryCount < maxRetries) {
        try {
          const status = await client.getSessionStatus(session.session_id)
          console.log(`Session ${session.session_id} status:`, status)
          if (status.status === 'stable') {
            console.log('Agent is now available')
            break
          }
        } catch (err) {
          console.warn(`Status check failed (attempt ${retryCount + 1}):`, err)
        }

        retryCount++
        if (retryCount >= maxRetries) {
          stopWaitingCounter()
          onSessionStatusUpdate(sessionId, 'failed')
          updateProgress('failed', 'セッションの準備がタイムアウトしました。しばらく待ってから再試行してください。')
          onSessionCompleted(sessionId)
          return
        }

        // 1秒待機
        await new Promise(resolve => setTimeout(resolve, retryInterval))
      }

      stopWaitingCounter()

      // Agent Availableになったらメッセージを送信
      onSessionStatusUpdate(sessionId, 'sending-message')
      updateProgress('sending-message')

      // メッセージを送信
      console.log(`Sending message to session ${session.session_id}:`, message)
      try {
        await client.sendSessionMessage(session.session_id, {
          content: message,
          type: 'user'
        })
        console.log('Message sent successfully')

        // 作成完了
        onSessionStatusUpdate(sessionId, 'completed')
        updateProgress('completed')
        onSessionCompleted(sessionId)

        // セッション一覧を更新
        onSuccess()

        // 完了後、少し待ってからモーダルを閉じる
        setTimeout(() => {
          handleCloseProgressModal()
        }, 1500)
      } catch (messageErr) {
        console.error('Failed to send initial message:', messageErr)
        onSessionStatusUpdate(sessionId, 'failed')
        updateProgress('failed', 'メッセージの送信に失敗しました')
        onSessionCompleted(sessionId)
      }
    } catch (err) {
      console.error('Background session creation failed:', err)
      stopWaitingCounter()
      onSessionStatusUpdate(sessionId, 'failed')
      updateProgress('failed', err instanceof Error ? err.message : 'セッション作成に失敗しました')
      onSessionCompleted(sessionId)
    }
  }

  const handleCloseProgressModal = () => {
    stopWaitingCounter()
    setShowProgressModal(false)
    setCreationProgress(null)
    setIsCreating(false)
    onClose()
  }

  const handleRetry = () => {
    setShowProgressModal(false)
    setCreationProgress(null)
    setIsCreating(false)
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!initialMessage.trim()) {
      setError('初期メッセージを入力してください')
      return
    }

    // チャットモードの場合はリポジトリの必須チェックをスキップ
    if (sessionMode === 'repository') {
      if (!freeFormRepository.trim()) {
        setError('リポジトリを指定してください')
        return
      }
    }

    try {
      setIsCreating(true)
      setError(null)
      setStatusMessage('')

      const client = createAgentAPIClient()
      const currentMessage = initialMessage.trim()
      // チャットモードの場合はリポジトリを空にする
      const currentRepository = sessionMode === 'chat' ? '' : freeFormRepository.trim()

      // 初期メッセージをキャッシュに追加
      InitialMessageCache.addMessage(currentMessage)

      // 最近のメッセージに保存
      await recentMessagesManager.saveMessage(currentMessage)

      // リポジトリ履歴にも事前に追加（モーダルが閉じる前に実行）
      if (currentRepository && sessionMode === 'repository') {
        console.log('Adding repository to history before session creation:', { currentRepository })
        try {
          addRepositoryToHistory(currentRepository)
          console.log('Repository added to history successfully (pre-session)')
        } catch (error) {
          console.error('Failed to add repository to history (pre-session):', error)
        }
      }

      // セッションIDを生成
      const sessionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // 作成開始をコールバック
      onSessionStart(sessionId, currentMessage, currentRepository || undefined)

      // 進捗モーダルを表示
      setCreationProgress({
        status: 'creating',
        message: currentMessage,
        repository: currentRepository || undefined,
        startTime: new Date()
      })
      setShowProgressModal(true)

      // 入力値をクリア（モーダルは閉じない）
      setInitialMessage('')
      setFreeFormRepository('')

      // バックグラウンドでセッション作成処理を続行
      createSessionInBackground(client, currentMessage, currentRepository, sessionId)

    } catch {
      setError('セッション開始に失敗しました')
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setInitialMessage('')
    setFreeFormRepository('')
    setSessionMode('repository')
    setError(null)
    setStatusMessage('')
    setShowCachedMessages(false)
    setShowTemplates(false)
    onClose()
  }

  const handleMessageFocus = () => {
    // フォーカス時の自動表示は削除
  }

  const handleMessageBlur = () => {
    // フォーカスアウト時のクリーンアップ
    setTimeout(() => {
      setShowCachedMessages(false)
      setShowTemplates(false)
    }, 150)
  }

  const selectCachedMessage = (message: string) => {
    setInitialMessage(message)
    setShowCachedMessages(false)
  }

  const selectTemplate = (template: MessageTemplate) => {
    setInitialMessage(template.content)
    setShowTemplates(false)
  }

  // リポジトリ入力ハンドラー
  const handleFreeFormRepositoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFreeFormRepository(value)

    if (value.trim()) {
      // グローバル履歴から検索
      const suggestions = OrganizationHistory.getRepositorySuggestions(value)
      setFreeFormRepositorySuggestions(suggestions)
      setShowFreeFormRepositorySuggestions(suggestions.length > 0)
    } else {
      setShowFreeFormRepositorySuggestions(false)
    }
  }

  const handleFreeFormRepositoryFocus = () => {
    // グローバル履歴を表示
    const suggestions = OrganizationHistory.getRepositorySuggestions()
    setFreeFormRepositorySuggestions(suggestions)
    setShowFreeFormRepositorySuggestions(suggestions.length > 0)
  }

  const handleFreeFormRepositoryBlur = () => {
    setTimeout(() => setShowFreeFormRepositorySuggestions(false), 150)
  }

  const selectFreeFormRepositorySuggestion = (suggestion: string) => {
    setFreeFormRepository(suggestion)
    setShowFreeFormRepositorySuggestions(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-lg lg:max-w-2xl xl:max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            新しいセッションを開始
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              セッションタイプ
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="sessionMode"
                  value="repository"
                  checked={sessionMode === 'repository'}
                  onChange={(e) => setSessionMode(e.target.value as 'repository' | 'chat')}
                  className="mr-2 text-blue-600"
                  disabled={isCreating}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  リポジトリ連携
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="sessionMode"
                  value="chat"
                  checked={sessionMode === 'chat'}
                  onChange={(e) => setSessionMode(e.target.value as 'repository' | 'chat')}
                  className="mr-2 text-blue-600"
                  disabled={isCreating}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  チャットモード
                </span>
              </label>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {sessionMode === 'repository'
                ? 'リポジトリに接続してコード作業を行います'
                : 'リポジトリに接続せず、一般的なチャットを行います'
              }
            </p>
          </div>

          <div className="relative">
            <label htmlFor="initialMessage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              初期メッセージ *
            </label>
            <div className="flex items-start gap-2">
              <textarea
                id="initialMessage"
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                onFocus={handleMessageFocus}
                onBlur={handleMessageBlur}
                placeholder="このセッションで何をしたいか説明してください..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-y min-h-[120px] sm:min-h-[100px] lg:min-h-[150px] xl:min-h-[180px] max-h-[50vh]"
                rows={isMobile ? 6 : 4}
                disabled={isCreating}
                required
              />
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center flex-shrink-0"
                title="テンプレートから選択"
                disabled={isCreating}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
            {showTemplates && templates.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  メッセージテンプレート
                </div>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplate(template)}
                    className="w-full text-left px-3 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {template.content}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showCachedMessages && cachedMessages.length > 0 && !showTemplates && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  最近使用したメッセージ
                </div>
                {cachedMessages.map((message, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectCachedMessage(message)}
                    className="w-full text-left px-3 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="line-clamp-2 text-sm">
                      {message}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {sessionMode === 'repository' && (
            <div className="relative">
              <label htmlFor="freeFormRepository" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                対象リポジトリ
              </label>
              <input
                id="freeFormRepository"
                type="text"
                value={freeFormRepository}
                onChange={handleFreeFormRepositoryChange}
                onFocus={handleFreeFormRepositoryFocus}
                onBlur={handleFreeFormRepositoryBlur}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="例: owner/repository-name"
                disabled={isCreating}
                required
              />

              {/* サジェストドロップダウン - 大画面でグリッド表示 */}
              {showFreeFormRepositorySuggestions && freeFormRepositorySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-50 mt-1 max-h-64 lg:max-h-80 overflow-y-auto">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">リポジトリ履歴</span>
                  </div>
                  <div className="p-2 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                    {freeFormRepositorySuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectFreeFormRepositorySuggestion(suggestion)}
                        className="text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-900 dark:text-white font-mono text-sm rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors break-all"
                        title={suggestion}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="break-all">{suggestion}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                owner/repository-name の形式で入力してください
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {statusMessage && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-blue-600 dark:text-blue-400 text-sm">{statusMessage}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={!initialMessage.trim() || isCreating || (
                sessionMode === 'repository' && !freeFormRepository.trim()
              )}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  作成中...
                </>
              ) : (
                'セッション開始'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTemplateModal(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl max-h-[85vh] overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">テンプレートから選択</h2>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-5rem)]">
              {/* Recent Messages Section */}
              {recentMessages.length > 0 && (
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">最近のメッセージ</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {recentMessages.map((message, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInitialMessage(message)
                          setShowTemplateModal(false)
                        }}
                        className="text-left px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors border border-transparent hover:border-blue-300 dark:hover:border-blue-700"
                      >
                        <div className="text-sm text-gray-900 dark:text-white line-clamp-2">
                          {message}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Templates Section */}
              <div className="px-4 sm:px-6 py-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">テンプレート</h3>
                {templates.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setInitialMessage(template.content)
                          setShowTemplateModal(false)
                        }}
                        className="text-left px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700"
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate">{template.name}</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">
                          {template.content}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">テンプレートがありません</p>
                    <a
                      href="/settings?tab=templates"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      テンプレートを作成
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Creation Progress Modal */}
      {showProgressModal && creationProgress && (
        <SessionCreationProgressModal
          isOpen={showProgressModal}
          progress={creationProgress}
          onClose={creationProgress.status === 'failed' ? handleCloseProgressModal : undefined}
          onRetry={creationProgress.status === 'failed' ? handleRetry : undefined}
        />
      )}
    </div>
  )
}
