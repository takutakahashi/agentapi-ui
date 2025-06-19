'use client'

import { useState, useEffect } from 'react'
import { createAgentAPIClient } from '../../lib/api'
import type { AgentAPIProxyClient } from '../../lib/agentapi-proxy-client'
import { RepositoryHistory } from '../../utils/repositoryHistory'
import { ProfileManager } from '../../utils/profileManager'
import { ProfileListItem } from '../../types/profile'
import { InitialMessageCache } from '../../utils/initialMessageCache'
import { messageTemplateManager } from '../../utils/messageTemplateManager'
import { MessageTemplate } from '../../types/messageTemplate'

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
  const [repository, setRepository] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [profiles, setProfiles] = useState<ProfileListItem[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [repositorySuggestions, setRepositorySuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [cachedMessages, setCachedMessages] = useState<string[]>([])
  const [showCachedMessages, setShowCachedMessages] = useState(false)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isOpen) {
      ProfileManager.migrateExistingSettings()
      const profilesList = ProfileManager.getProfiles()
      setProfiles(profilesList)
      
      const defaultProfile = ProfileManager.getDefaultProfile()
      if (defaultProfile) {
        setSelectedProfileId(defaultProfile.id)
      } else if (profilesList.length > 0) {
        setSelectedProfileId(profilesList[0].id)
      }
      
      // キャッシュされたメッセージを読み込む
      const cached = InitialMessageCache.getCachedMessages()
      setCachedMessages(cached)
      
      // プロファイル変更時にテンプレートを読み込む
      if (selectedProfileId) {
        loadTemplatesForProfile(selectedProfileId);
      }
    }
  }, [isOpen, selectedProfileId])

  useEffect(() => {
    if (selectedProfileId) {
      loadTemplatesForProfile(selectedProfileId)
    }
  }, [selectedProfileId])

  const loadTemplatesForProfile = async (profileId: string) => {
    if (!profileId) {
      setTemplates([])
      return
    }
    
    try {
      const profileTemplates = await messageTemplateManager.getTemplatesForProfile(profileId)
      setTemplates(profileTemplates)
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplates([])
    }
  }

  const createSessionInBackground = async (client: AgentAPIProxyClient, message: string, repo: string, sessionId: string) => {
    try {
      console.log('Starting background session creation...')
      onSessionStatusUpdate(sessionId, 'creating')
      
      const tags: Record<string, string> = {}
      
      if (repo) {
        tags.repository = repo
      }

      // セッションを作成 (createSession -> start)
      const session = await client.start({
        environment: repo ? {
          REPOSITORY: repo
        } : {},
        metadata: {
          description: message
        },
        tags: Object.keys(tags).length > 0 ? tags : undefined
      })
      console.log('Session created:', session)

      // セッション作成後、statusが "Agent Available" になるまで待機
      onSessionStatusUpdate(sessionId, 'waiting-agent')
      let retryCount = 0
      const maxRetries = 30 // 最大30回（30秒）待機
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
          onSessionStatusUpdate(sessionId, 'failed')
          onSessionCompleted(sessionId)
          throw new Error('セッションの準備がタイムアウトしました。しばらく待ってから再試行してください。')
        }
        
        // 1秒待機
        await new Promise(resolve => setTimeout(resolve, retryInterval))
      }

      // Agent Availableになったらメッセージを送信
      onSessionStatusUpdate(sessionId, 'sending-message')
      
      // 選択されたプロファイルからシステムプロンプトを取得
      let profile = null
      if (selectedProfileId) {
        profile = ProfileManager.getProfile(selectedProfileId)
      }
      
      // システムプロンプトと初期メッセージを結合
      let combinedMessage = message
      if (profile?.systemPrompt?.trim()) {
        combinedMessage = `${profile.systemPrompt}\n\n---\n\n${message}`
        console.log(`Combined system prompt with initial message for session ${session.session_id}`)
      }
      
      // 結合されたメッセージを送信
      console.log(`Sending combined message to session ${session.session_id}:`, combinedMessage)
      try {
        await client.sendSessionMessage(session.session_id, {
          content: combinedMessage,
          type: 'user'
        })
        console.log('Combined message sent successfully')
        
        // リポジトリ履歴に追加
        if (repo && selectedProfileId) {
          console.log('Adding repository to profile history:', { repo, selectedProfileId })
          try {
            ProfileManager.addRepositoryToProfile(selectedProfileId, repo)
            console.log('Repository added to profile history successfully')
          } catch (error) {
            console.error('Failed to add repository to profile history:', error)
          }
        } else {
          console.warn('Repository or selectedProfileId is missing:', { repo, selectedProfileId })
        }
        
        // プロファイル使用記録更新
        if (selectedProfileId) {
          ProfileManager.markProfileUsed(selectedProfileId)
        }
        
        // 作成完了
        onSessionStatusUpdate(sessionId, 'completed')
        onSessionCompleted(sessionId)
        
        // セッション一覧を更新
        onSuccess()
      } catch (messageErr) {
        console.error('Failed to send initial message:', messageErr)
        onSessionStatusUpdate(sessionId, 'failed')
        onSessionCompleted(sessionId)
      }
    } catch (err) {
      console.error('Background session creation failed:', err)
      onSessionStatusUpdate(sessionId, 'failed')
      onSessionCompleted(sessionId)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!initialMessage.trim()) {
      setError('初期メッセージを入力してください')
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      setStatusMessage('セッションを作成中...')

      const client = createAgentAPIClient(undefined, selectedProfileId)
      const currentMessage = initialMessage.trim()
      const currentRepository = repository.trim()
      
      // 初期メッセージをキャッシュに追加
      InitialMessageCache.addMessage(currentMessage)
      
      // セッションIDを生成
      const sessionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 作成開始をコールバック
      onSessionStart(sessionId, currentMessage, currentRepository || undefined)
      
      // 入力値をクリアしてモーダルを閉じる
      setInitialMessage('')
      setRepository('')
      setStatusMessage('')
      setIsCreating(false)
      onClose()
      
      // バックグラウンドでセッション作成処理を続行
      createSessionInBackground(client, currentMessage, currentRepository, sessionId)
      
    } catch {
      setError('セッション開始に失敗しました')
      setIsCreating(false)
    }
  }

  const handleRepositoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setRepository(value)
    
    if (value.trim()) {
      let suggestions: string[] = []
      
      if (selectedProfileId) {
        const profile = ProfileManager.getProfile(selectedProfileId)
        if (profile) {
          suggestions = profile.repositoryHistory
            .filter(item => item.repository.toLowerCase().includes(value.toLowerCase()))
            .map(item => item.repository)
        }
      }
      
      if (suggestions.length === 0) {
        suggestions = RepositoryHistory.searchRepositories(value)
      }
      
      setRepositorySuggestions(suggestions)
      setShowSuggestions(suggestions.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleRepositoryFocus = () => {
    let suggestions: string[] = []
    
    if (selectedProfileId) {
      const profile = ProfileManager.getProfile(selectedProfileId)
      if (profile) {
        suggestions = profile.repositoryHistory.map(item => item.repository)
      }
    }
    
    if (suggestions.length === 0) {
      suggestions = RepositoryHistory.getHistory().map(item => item.repository)
    }
    
    setRepositorySuggestions(suggestions)
    setShowSuggestions(suggestions.length > 0)
  }

  const handleRepositoryBlur = () => {
    // 少し遅延させてクリックイベントが発生するようにする
    setTimeout(() => setShowSuggestions(false), 150)
  }

  const selectRepository = (repo: string) => {
    setRepository(repo)
    setShowSuggestions(false)
  }

  const handleClose = () => {
    setInitialMessage('')
    setRepository('')
    setSelectedProfileId('')
    setError(null)
    setStatusMessage('')
    setShowSuggestions(false)
    setShowCachedMessages(false)
    setShowTemplates(false)
    onClose()
  }
  
  const handleMessageFocus = () => {
    if (templates.length > 0 && !initialMessage.trim()) {
      setShowTemplates(true)
    } else if (cachedMessages.length > 0 && !initialMessage.trim()) {
      setShowCachedMessages(true)
    }
  }
  
  const handleMessageBlur = () => {
    // 少し遅延させてクリックイベントが発生するようにする
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4">
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
            <label htmlFor="profile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              プロファイル
            </label>
            <div className="flex gap-2">
              <select
                id="profile"
                value={selectedProfileId}
                onChange={(e) => {
                  const newProfileId = e.target.value;
                  console.log('Profile changed:', { old: selectedProfileId, new: newProfileId });
                  setSelectedProfileId(newProfileId);
                  
                  // プロファイル変更時にリポジトリサジェストを更新
                  if (!repository.trim()) {
                    let suggestions: string[] = [];
                    if (newProfileId) {
                      const profile = ProfileManager.getProfile(newProfileId);
                      if (profile) {
                        suggestions = profile.repositoryHistory.map(item => item.repository);
                        console.log('Updated suggestions for new profile:', suggestions);
                      }
                    }
                    if (suggestions.length === 0) {
                      suggestions = RepositoryHistory.getHistory().map(item => item.repository);
                    }
                    setRepositorySuggestions(suggestions);
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isCreating}
              >
                {profiles.length === 0 ? (
                  <option value="">No profiles available</option>
                ) : (
                  profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.icon || '⚙️'} {profile.name}
                      {profile.isDefault ? ' (Default)' : ''}
                    </option>
                  ))
                )}
              </select>
              <a
                href="/profiles"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
                title="Manage Profiles"
              >
                ⚙️
              </a>
            </div>
          </div>

          <div className="relative">
            <label htmlFor="initialMessage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              初期メッセージ *
            </label>
            <textarea
              id="initialMessage"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              onFocus={handleMessageFocus}
              onBlur={handleMessageBlur}
              placeholder="このセッションで何をしたいか説明してください..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-y min-h-[120px] max-h-[300px] sm:min-h-[96px]"
              rows={isMobile ? 6 : 4}
              disabled={isCreating}
              required
            />
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

          <div className="relative">
            <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              対象リポジトリ
            </label>
            <input
              id="repository"
              type="text"
              value={repository}
              onChange={handleRepositoryChange}
              onFocus={handleRepositoryFocus}
              onBlur={handleRepositoryBlur}
              placeholder="例: owner/repository-name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isCreating}
            />
            {showSuggestions && repositorySuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {repositorySuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectRepository(suggestion)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white first:rounded-t-md last:rounded-b-md"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

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
              disabled={!initialMessage.trim() || isCreating}
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
    </div>
  )
}