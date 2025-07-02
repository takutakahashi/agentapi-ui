'use client'

import { useState, useEffect } from 'react'
import { createAgentAPIClient } from '../../lib/api'
import type { AgentAPIProxyClient } from '../../lib/agentapi-proxy-client'
import { ProfileManager } from '../../utils/profileManager'
import { ProfileListItem } from '../../types/profile'
import { InitialMessageCache } from '../../utils/initialMessageCache'
import { messageTemplateManager } from '../../utils/messageTemplateManager'
import { MessageTemplate } from '../../types/messageTemplate'
import { recentMessagesManager } from '../../utils/recentMessagesManager'
import { OrganizationHistory } from '../../utils/organizationHistory'
import EditProfileModal from './EditProfileModal'

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
  const [selectedOrganization, setSelectedOrganization] = useState('')
  const [repository, setRepository] = useState('')
  const [freeFormRepository, setFreeFormRepository] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [profiles, setProfiles] = useState<ProfileListItem[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [availableOrganizations, setAvailableOrganizations] = useState<string[]>([])
  const [cachedMessages, setCachedMessages] = useState<string[]>([])
  const [showCachedMessages, setShowCachedMessages] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editProfileId, setEditProfileId] = useState<string>('')
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [recentMessages, setRecentMessages] = useState<string[]>([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [repositorySuggestions, setRepositorySuggestions] = useState<string[]>([])
  const [showRepositorySuggestions, setShowRepositorySuggestions] = useState(false)
  const [freeFormRepositorySuggestions, setFreeFormRepositorySuggestions] = useState<string[]>([])
  const [showFreeFormRepositorySuggestions, setShowFreeFormRepositorySuggestions] = useState(false)
  const [sessionMode, setSessionMode] = useState<'repository' | 'chat'>('repository')

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
    const loadProfiles = async () => {
      if (isOpen) {
        await ProfileManager.migrateExistingSettings()
        const profilesList = await ProfileManager.getProfiles()
        setProfiles(profilesList)
        
        const defaultProfile = await ProfileManager.getDefaultProfile()
        if (defaultProfile) {
          setSelectedProfileId(defaultProfile.id)
        } else if (profilesList.length > 0) {
          setSelectedProfileId(profilesList[0].id)
        }
      
      // プロファイル固有のキャッシュされたメッセージを読み込む
      const cached = selectedProfileId ? InitialMessageCache.getCachedMessages(selectedProfileId) : []
      setCachedMessages(cached)
      
      // プロファイル変更時にテンプレートを読み込む
      if (selectedProfileId) {
        loadTemplatesForProfile(selectedProfileId);
        }
      }
    }
    loadProfiles()
  }, [isOpen, selectedProfileId])

  useEffect(() => {
    if (selectedProfileId) {
      loadTemplatesForProfile(selectedProfileId)
      loadRecentMessages(selectedProfileId)
      
      // プロファイル固有のキャッシュされたメッセージを読み込む
      const cached = InitialMessageCache.getCachedMessages(selectedProfileId)
      setCachedMessages(cached)
      
      // プロファイル変更時に組織リストを更新
      const loadProfile = async () => {
        const profile = await ProfileManager.getProfile(selectedProfileId);
        if (profile) {
        if (profile.fixedOrganizations && profile.fixedOrganizations.length > 0) {
          setAvailableOrganizations(profile.fixedOrganizations);
          // 最初の組織を自動選択
          if (!selectedOrganization || !profile.fixedOrganizations.includes(selectedOrganization)) {
            setSelectedOrganization(profile.fixedOrganizations[0]);
            console.log('Auto-set first fixed organization for profile:', selectedProfileId, profile.fixedOrganizations[0]);
          }
        } else {
          // 固定組織が設定されていない場合は空にする（自由記述モード）
          setAvailableOrganizations([]);
          setSelectedOrganization('');
          }
        }
      }
      loadProfile()
    }
  }, [selectedProfileId, selectedOrganization])

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

  const loadRecentMessages = async (profileId: string) => {
    if (!profileId) return
    try {
      const messages = await recentMessagesManager.getRecentMessages(profileId)
      setRecentMessages(messages.map(msg => msg.content))
    } catch (error) {
      console.error('Failed to load recent messages:', error)
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

      // Profile の環境変数を取得
      const selectedProfile = selectedProfileId ? await ProfileManager.getProfile(selectedProfileId) : null
      const profileEnvironmentVariables = selectedProfile?.environmentVariables || []
      
      // 環境変数オブジェクトを構築
      const environment: Record<string, string> = {}
      
      // Profile の環境変数を追加
      profileEnvironmentVariables.forEach(envVar => {
        if (envVar.key && envVar.value) {
          environment[envVar.key] = envVar.value
        }
      })
      
      // リポジトリ情報を環境変数に追加（既存の値を上書きしない）
      if (repo && !environment.REPOSITORY) {
        environment.REPOSITORY = repo
      }

      // セッションを作成 (createSession -> start)
      const session = await client.start({
        environment,
        metadata: {
          description: message
        },
        tags: Object.keys(tags).length > 0 ? tags : undefined
      })
      console.log('Session created:', session)

      // リポジトリ履歴はセッション作成前に既に追加済み（プロファイル固有の履歴のみ使用）
      console.log('Repository history already added to profile before session creation')

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
      let systemPromptProfile = null
      if (selectedProfileId) {
        systemPromptProfile = await ProfileManager.getProfile(selectedProfileId)
      }
      
      // システムプロンプトと初期メッセージを結合
      let combinedMessage = message
      if (systemPromptProfile?.systemPrompt?.trim()) {
        combinedMessage = `${systemPromptProfile.systemPrompt}\n\n---\n\n${message}`
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
        
        // リポジトリ履歴への追加は既にモーダル内で実行済み
        
        // プロファイル使用記録更新
        if (selectedProfileId) {
          await ProfileManager.markProfileUsed(selectedProfileId)
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

    // チャットモードの場合はリポジトリの必須チェックをスキップ
    if (sessionMode === 'repository') {
      const hasRepository = availableOrganizations.length > 0
        ? (selectedOrganization && repository.trim())
        : freeFormRepository.trim()
      
      if (!hasRepository) {
        setError('リポジトリを指定してください')
        return
      }
    }

    try {
      setIsCreating(true)
      setError(null)
      setStatusMessage('セッションを作成中...')

      const client = createAgentAPIClient(undefined, selectedProfileId)
      const currentMessage = initialMessage.trim()
      // チャットモードの場合はリポジトリを空にする
      const currentRepository = sessionMode === 'chat' ? '' : (
        availableOrganizations.length > 0
          ? (selectedOrganization && repository.trim() 
             ? `${selectedOrganization}/${repository.trim()}`
             : '')
          : freeFormRepository.trim()
      )
      
      // プロファイル固有の初期メッセージをキャッシュに追加
      if (selectedProfileId) {
        InitialMessageCache.addMessage(currentMessage, selectedProfileId)
      }
      
      // 最近のメッセージに保存
      if (selectedProfileId) {
        await recentMessagesManager.saveMessage(selectedProfileId, currentMessage)
      }
      
      // リポジトリ履歴にも事前に追加（モーダルが閉じる前に実行）
      // チャットモードの場合はリポジトリ履歴には追加しない
      if (currentRepository && selectedProfileId && sessionMode === 'repository') {
        console.log('Adding repository to profile history before session creation:', { currentRepository, selectedProfileId })
        try {
          await ProfileManager.addRepositoryToProfile(selectedProfileId, currentRepository)
          console.log('Repository added to profile history successfully (pre-session)')
          
          // プロファイル固有の組織履歴にも追加
          if (selectedOrganization) {
            OrganizationHistory.addRepositoryToOrganization(selectedProfileId, selectedOrganization, currentRepository)
            console.log('Repository added to profile organization history:', { profileId: selectedProfileId, organization: selectedOrganization, repository: currentRepository })
          }
        } catch (error) {
          console.error('Failed to add repository to profile history (pre-session):', error)
        }
      }
      
      // セッションIDを生成
      const sessionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 作成開始をコールバック
      onSessionStart(sessionId, currentMessage, currentRepository || undefined)
      
      // 入力値をクリアしてモーダルを閉じる
      setInitialMessage('')
      setSelectedOrganization('')
      setRepository('')
      setFreeFormRepository('')
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

  const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOrganization(e.target.value)
  }


  const handleClose = () => {
    setInitialMessage('')
    setSelectedOrganization('')
    setRepository('')
    setFreeFormRepository('')
    setSelectedProfileId('')
    setSessionMode('repository')
    setError(null)
    setStatusMessage('')
    setAvailableOrganizations([])
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

  // 組織ベースのリポジトリ入力ハンドラー
  const handleRepositoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setRepository(value)
    
    if (value.trim() && selectedOrganization && selectedProfileId) {
      // プロファイル固有の組織履歴から検索
      const orgSuggestions = OrganizationHistory.searchOrganizationRepositories(selectedProfileId, selectedOrganization, value)
      // プロファイル固有の全体履歴からも検索（組織/リポジトリ形式）
      const profileSuggestions = OrganizationHistory.getProfileRepositorySuggestions(selectedProfileId, `${selectedOrganization}/${value}`)
        .filter(repo => repo.startsWith(`${selectedOrganization}/`))
        .map(repo => repo.substring(selectedOrganization.length + 1))
      
      // 重複を除去してマージ
      const allSuggestions = [...new Set([...orgSuggestions, ...profileSuggestions])]
      setRepositorySuggestions(allSuggestions)
      setShowRepositorySuggestions(allSuggestions.length > 0)
    } else {
      setShowRepositorySuggestions(false)
    }
  }

  const handleRepositoryFocus = () => {
    if (selectedOrganization && selectedProfileId) {
      // プロファイル固有の組織履歴を表示
      const orgHistory = OrganizationHistory.getOrganizationHistory(selectedProfileId, selectedOrganization)
      const suggestions = orgHistory.map(item => {
        // 組織名を除いたリポジトリ名のみを表示
        return item.repository.startsWith(`${selectedOrganization}/`) 
          ? item.repository.substring(selectedOrganization.length + 1)
          : item.repository
      })
      setRepositorySuggestions(suggestions)
      setShowRepositorySuggestions(suggestions.length > 0)
    }
  }

  const handleRepositoryBlur = () => {
    setTimeout(() => setShowRepositorySuggestions(false), 150)
  }

  const selectRepositorySuggestion = (suggestion: string) => {
    setRepository(suggestion)
    setShowRepositorySuggestions(false)
  }

  // 自由入力のリポジトリハンドラー
  const handleFreeFormRepositoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFreeFormRepository(value)
    
    if (value.trim() && selectedProfileId) {
      // プロファイル固有の履歴から検索
      const suggestions = OrganizationHistory.getProfileRepositorySuggestions(selectedProfileId, value)
      setFreeFormRepositorySuggestions(suggestions)
      setShowFreeFormRepositorySuggestions(suggestions.length > 0)
    } else {
      setShowFreeFormRepositorySuggestions(false)
    }
  }

  const handleFreeFormRepositoryFocus = () => {
    if (selectedProfileId) {
      // プロファイル固有の履歴を表示
      const suggestions = OrganizationHistory.getProfileRepositorySuggestions(selectedProfileId)
      setFreeFormRepositorySuggestions(suggestions)
      setShowFreeFormRepositorySuggestions(suggestions.length > 0)
    }
  }

  const handleFreeFormRepositoryBlur = () => {
    setTimeout(() => setShowFreeFormRepositorySuggestions(false), 150)
  }

  const selectFreeFormRepositorySuggestion = (suggestion: string) => {
    setFreeFormRepository(suggestion)
    setShowFreeFormRepositorySuggestions(false)
  }

  const handleEditProfile = (profileId: string) => {
    setEditProfileId(profileId)
    setEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setEditModalOpen(false)
    setEditProfileId('')
  }

  const handleProfileUpdated = async () => {
    // プロファイルリストを再読み込み
    await ProfileManager.migrateExistingSettings()
    const profilesList = await ProfileManager.getProfiles()
    setProfiles(profilesList)
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
                  // useEffect でプロファイル変更時の処理を統一的に実行
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
              <button
                type="button"
                onClick={() => handleEditProfile(selectedProfileId)}
                className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                title="プロファイルを編集"
                disabled={!selectedProfileId}
              >
                Edit
              </button>
            </div>
          </div>

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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-y min-h-[120px] max-h-[300px] sm:min-h-[96px]"
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

          {sessionMode === 'repository' && availableOrganizations.length > 0 ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="organization" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  組織
                </label>
                <select
                  id="organization"
                  value={selectedOrganization}
                  onChange={handleOrganizationChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={isCreating}
                  required
                >
                  <option value="">組織を選択してください</option>
                  {availableOrganizations.map((org, index) => (
                    <option key={index} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  リポジトリ名
                </label>
                <input
                  id="repository"
                  type="text"
                  value={repository}
                  onChange={handleRepositoryChange}
                  onFocus={handleRepositoryFocus}
                  onBlur={handleRepositoryBlur}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="リポジトリ名を入力"
                  disabled={isCreating || !selectedOrganization}
                  required
                />
                
                {/* サジェストドロップダウン */}
                {showRepositorySuggestions && repositorySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 mt-1 max-h-48 overflow-y-auto">
                    {repositorySuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectRepositorySuggestion(suggestion)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                
                {selectedOrganization && repository && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    対象リポジトリ: <span className="font-mono">{selectedOrganization}/{repository}</span>
                  </p>
                )}
              </div>
            </div>
          ) : sessionMode === 'repository' ? (
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
              
              {/* サジェストドロップダウン */}
              {showFreeFormRepositorySuggestions && freeFormRepositorySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 mt-1 max-h-48 overflow-y-auto">
                  {freeFormRepositorySuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectFreeFormRepositorySuggestion(suggestion)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                このプロファイルには固定組織が設定されていないため、自由にリポジトリを指定できます。
              </p>
            </div>
          ) : null}

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
                sessionMode === 'repository' && (
                  availableOrganizations.length > 0 
                    ? (!selectedOrganization || !repository.trim())
                    : !freeFormRepository.trim()
                )
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
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
            
            <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
              {/* Recent Messages Section */}
              {recentMessages.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">最近のメッセージ</h3>
                  <div className="space-y-2">
                    {recentMessages.map((message, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInitialMessage(message)
                          setShowTemplateModal(false)
                        }}
                        className="w-full text-left px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
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
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setInitialMessage(template.content)
                          setShowTemplateModal(false)
                        }}
                        className="w-full text-left px-3 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{template.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {template.content}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">テンプレートがありません</p>
                    <a
                      href="/settings?tab=templates"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline inline-block"
                    >
                      テンプレートを作成
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <EditProfileModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        profileId={editProfileId}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  )
}