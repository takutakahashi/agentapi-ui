'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createAgentAPIClient } from '../../../lib/api'
import type { AgentAPIProxyClient } from '../../../lib/agentapi-proxy-client'
import { InitialMessageCache } from '../../../utils/initialMessageCache'
import { messageTemplateManager } from '../../../utils/messageTemplateManager'
import { MessageTemplate } from '../../../types/messageTemplate'
import { recentMessagesManager } from '../../../utils/recentMessagesManager'
import { OrganizationHistory } from '../../../utils/organizationHistory'
import { addRepositoryToHistory } from '../../../types/settings'
import TopBar from '../../components/TopBar'
import SessionCreationProgressModal from '../../components/SessionCreationProgressModal'
import { SessionCreationProgress, SessionCreationStatus } from '../../../types/sessionProgress'

export default function NewSessionPage() {
  const router = useRouter()
  const [initialMessage, setInitialMessage] = useState('')
  const [freeFormRepository, setFreeFormRepository] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [recentMessages, setRecentMessages] = useState<string[]>([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [freeFormRepositorySuggestions, setFreeFormRepositorySuggestions] = useState<string[]>([])
  const [showFreeFormRepositorySuggestions, setShowFreeFormRepositorySuggestions] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [creationProgress, setCreationProgress] = useState<SessionCreationProgress | null>(null)

  useEffect(() => {
    loadTemplates()
    loadRecentMessages()
  }, [])

  // ESCキーで戻る
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showTemplateModal) {
          setShowTemplateModal(false)
        } else {
          router.back()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showTemplateModal, router])

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
        errorMessage
      }
    })
  }

  const createSession = async (
    client: AgentAPIProxyClient,
    message: string,
    repo: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Starting session creation with initial message...')
      updateProgress('creating')

      const tags: Record<string, string> = {}
      if (repo) {
        tags.repository = repo
      }

      const environment: Record<string, string> = {}
      if (repo) {
        environment.REPOSITORY = repo
      }

      const session = await client.start({
        environment,
        metadata: {
          description: message
        },
        tags: Object.keys(tags).length > 0 ? tags : undefined,
        params: {
          message: message
        }
      })
      console.log('Session created with initial message:', session)

      updateProgress('completed')
      return { success: true }
    } catch (err) {
      console.error('Session creation failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'セッション作成に失敗しました'
      updateProgress('failed', errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!initialMessage.trim()) {
      setError('初期メッセージを入力してください')
      return
    }

    setIsCreating(true)
    setError(null)
    setStatusMessage('')

    const client = createAgentAPIClient()
    const currentMessage = initialMessage.trim()
    const currentRepository = freeFormRepository.trim()

    InitialMessageCache.addMessage(currentMessage)
    await recentMessagesManager.saveMessage(currentMessage)

    if (currentRepository) {
      console.log('Adding repository to history before session creation:', { currentRepository })
      try {
        addRepositoryToHistory(currentRepository)
        console.log('Repository added to history successfully (pre-session)')
      } catch (error) {
        console.error('Failed to add repository to history (pre-session):', error)
      }
    }

    // 進捗モーダルを表示
    setCreationProgress({
      status: 'creating',
      message: currentMessage,
      repository: currentRepository || undefined,
      startTime: new Date()
    })
    setShowProgressModal(true)

    // セッション作成を待機
    const result = await createSession(
      client,
      currentMessage,
      currentRepository
    )

    if (result.success) {
      // 成功したら少し待ってから /chats に遷移
      setTimeout(() => {
        router.push('/chats')
      }, 1500)
    } else {
      // 失敗した場合はモーダルにエラーが表示される
      setIsCreating(false)
    }
  }

  const handleCloseProgressModal = () => {
    setShowProgressModal(false)
    setCreationProgress(null)
    setIsCreating(false)
  }

  const handleRetry = () => {
    setShowProgressModal(false)
    setCreationProgress(null)
    setIsCreating(false)
  }

  const handleCancel = () => {
    router.back()
  }

  const handleFreeFormRepositoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFreeFormRepository(value)

    if (value.trim()) {
      const suggestions = OrganizationHistory.getRepositorySuggestions(value)
      setFreeFormRepositorySuggestions(suggestions)
      setShowFreeFormRepositorySuggestions(suggestions.length > 0)
    } else {
      setShowFreeFormRepositorySuggestions(false)
    }
  }

  const handleFreeFormRepositoryFocus = () => {
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

  const selectTemplate = (template: MessageTemplate) => {
    setInitialMessage(template.content)
    setShowTemplateModal(false)
  }

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <TopBar
        title="新しいセッション"
        showSettingsButton={true}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          {/* ヘッダー */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              新しいセッションを開始
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              セッションの設定を入力してください
            </p>
          </div>

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* 初期メッセージ */}
            <div className="relative">
              <label htmlFor="initialMessage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                初期メッセージ <span className="text-red-500">*</span>
              </label>
              <div className="flex items-start gap-3">
                <textarea
                  id="initialMessage"
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="このセッションで何をしたいか説明してください..."
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-y min-h-[200px] text-base"
                  disabled={isCreating}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center flex-shrink-0"
                  title="テンプレートから選択"
                  disabled={isCreating}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* リポジトリ入力 */}
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-base"
                placeholder="例: owner/repository-name"
                disabled={isCreating}
              />

              {/* サジェストドロップダウン */}
              {showFreeFormRepositorySuggestions && freeFormRepositorySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-50 mt-1 max-h-80 overflow-y-auto">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">リポジトリ履歴</span>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                リポジトリを指定しない場合は一般的なチャットになります
              </p>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* ステータス表示 */}
            {statusMessage && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-blue-600 dark:text-blue-400 text-sm">{statusMessage}</p>
              </div>
            )}

            {/* ボタン */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!initialMessage.trim() || isCreating}
                className="px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center"
              >
                {isCreating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      </div>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTemplateModal(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">テンプレートから選択</h2>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-5rem)]">
              {/* Recent Messages Section */}
              {recentMessages.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">最近のメッセージ</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recentMessages.map((message, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInitialMessage(message)
                          setShowTemplateModal(false)
                        }}
                        className="text-left px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-300 dark:hover:border-blue-700"
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
              <div className="px-6 py-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">テンプレート</h3>
                {templates.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => selectTemplate(template)}
                        className="text-left px-4 py-4 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700"
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
    </main>
  )
}
