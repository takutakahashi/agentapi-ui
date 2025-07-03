'use client'

import { useState, useEffect, useCallback } from 'react'
import { agentAPI } from '../../lib/api'
import { AgentAPIProxyError } from '../../lib/agentapi-proxy-client'
import { SessionFilter, getFilterValuesForSessionCreation } from '../../lib/filter-utils'
import { OrganizationHistory } from '../../utils/organizationHistory'
import { ProfileManager } from '../../utils/profileManager'

interface NewConversationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentFilters?: SessionFilter
  initialRepository?: string
}

interface EnvironmentVariable {
  key: string
  value: string
}

export default function NewConversationModal({ isOpen, onClose, onSuccess, currentFilters, initialRepository }: NewConversationModalProps) {
  const [description, setDescription] = useState('')
  const [userId, setUserId] = useState('current-user')
  const [repository, setRepository] = useState('')
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([{ key: '', value: '' }])
  const [metadataVars, setMetadataVars] = useState<EnvironmentVariable[]>([{ key: '', value: '' }])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [repositorySuggestions, setRepositorySuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [currentProfileId, setCurrentProfileId] = useState<string>('')
  
  // Initialize with current filter values
  const initializeFromFilters = useCallback(() => {
    if (currentFilters) {
      const { metadata, environment, tags } = getFilterValuesForSessionCreation(currentFilters)
      
      // Set environment variables from filters
      const envEntries = Object.entries(environment)
      if (envEntries.length > 0) {
        setEnvVars(envEntries.map(([key, value]) => ({ key, value })))
      }
      
      // Set metadata variables from filters (includes tags for backward compatibility)
      const metadataEntries = Object.entries(metadata)
      const tagEntries = Object.entries(tags)
      const combinedEntries = [...tagEntries, ...metadataEntries]
      
      if (combinedEntries.length > 0) {
        setMetadataVars(combinedEntries.map(([key, value]) => ({ key, value: String(value) })))
      }
      
      // Set repository from tags if available
      if (tags.repository) {
        setRepository(tags.repository)
      }
    }
  }, [currentFilters])

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
  }

  const removeEnvVar = (index: number) => {
    if (envVars.length > 1) {
      setEnvVars(envVars.filter((_, i) => i !== index))
    }
  }

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = envVars.map((envVar, i) => 
      i === index ? { ...envVar, [field]: value } : envVar
    )
    setEnvVars(updated)
  }

  const addMetadataVar = () => {
    setMetadataVars([...metadataVars, { key: '', value: '' }])
  }

  const removeMetadataVar = (index: number) => {
    if (metadataVars.length > 1) {
      setMetadataVars(metadataVars.filter((_, i) => i !== index))
    }
  }

  const updateMetadataVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = metadataVars.map((metaVar, i) => 
      i === index ? { ...metaVar, [field]: value } : metaVar
    )
    setMetadataVars(updated)
  }

  const handleRepositoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setRepository(value)
    
    if (value.trim() && currentProfileId) {
      // プロファイル固有の履歴から検索
      const suggestions = OrganizationHistory.getProfileRepositorySuggestions(currentProfileId, value)
      setRepositorySuggestions(suggestions)
      setShowSuggestions(suggestions.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleRepositoryFocus = () => {
    if (currentProfileId) {
      // プロファイル固有の履歴を表示
      const suggestions = OrganizationHistory.getProfileRepositorySuggestions(currentProfileId)
      setRepositorySuggestions(suggestions)
      setShowSuggestions(suggestions.length > 0)
    }
  }

  const handleRepositoryBlur = () => {
    setTimeout(() => setShowSuggestions(false), 150)
  }

  const selectRepository = (repo: string) => {
    setRepository(repo)
    setShowSuggestions(false)
  }

  const resetForm = () => {
    setDescription('')
    setUserId('current-user')
    setRepository('')
    setEnvVars([{ key: '', value: '' }])
    setMetadataVars([{ key: '', value: '' }])
    setError(null)
    setShowSuggestions(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }
  
  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      initializeFromFilters()
      if (initialRepository) {
        setRepository(initialRepository)
      }
      
      // 現在のプロファイルを取得（現在のプロファイル -> デフォルトプロファイルの順）
      let currentProfile = null
      const currentProfileId = ProfileManager.getCurrentProfileId()
      if (currentProfileId) {
        currentProfile = ProfileManager.getProfile(currentProfileId)
        setCurrentProfileId(currentProfileId)
      } else {
        currentProfile = ProfileManager.getDefaultProfile()
        if (currentProfile) {
          setCurrentProfileId(currentProfile.id)
        }
      }
      
      if (currentProfile) {
        // Profile の環境変数をフォームに反映（フィルターからの値が優先）
        const profileEnvVars = currentProfile.environmentVariables || []
        
        // GITHUB_TOKEN として API キーを使用する設定が有効な場合、環境変数に追加
        const envVarsToSet = [...profileEnvVars]
        if (currentProfile.agentApiProxy?.useAsGithubToken && currentProfile.agentApiProxy?.apiKey) {
          // 既存の GITHUB_TOKEN がない場合のみ追加
          if (!envVarsToSet.some(env => env.key === 'GITHUB_TOKEN')) {
            envVarsToSet.push({
              key: 'GITHUB_TOKEN',
              value: currentProfile.agentApiProxy.apiKey,
              description: 'AgentAPI キーを GITHUB_TOKEN として使用'
            })
          }
        }
        
        // フィルターからの環境変数がない場合のみプロファイルの環境変数を適用
        if (envVars.length === 1 && !envVars[0].key && !envVars[0].value) {
          if (envVarsToSet.length > 0) {
            setEnvVars(envVarsToSet.map(envVar => ({ 
              key: envVar.key || '', 
              value: envVar.value || '' 
            })))
          }
        } else {
          // フィルターからの環境変数がある場合、GITHUB_TOKEN のみ追加チェック
          if (currentProfile.agentApiProxy?.useAsGithubToken && currentProfile.agentApiProxy?.apiKey) {
            const currentEnvVars = [...envVars]
            // 既存の GITHUB_TOKEN がない場合のみ追加
            if (!currentEnvVars.some(env => env.key === 'GITHUB_TOKEN')) {
              currentEnvVars.push({
                key: 'GITHUB_TOKEN',
                value: currentProfile.agentApiProxy.apiKey
              })
              setEnvVars(currentEnvVars)
            }
          }
        }
      }
    }
  }, [isOpen, currentFilters, initialRepository, initializeFromFilters])

  // ESCキーでモーダルを閉じる
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim()) {
      setError('Description is required')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // Filter out empty environment variables
      const validEnvVars = envVars.filter(envVar => envVar.key.trim() && envVar.value.trim())
      const environment = validEnvVars.reduce((acc, envVar) => {
        acc[envVar.key] = envVar.value
        return acc
      }, {} as Record<string, string>)
      
      // Debug logs
      console.log('Debug: envVars state:', envVars)
      console.log('Debug: validEnvVars:', validEnvVars)
      console.log('Debug: environment object:', environment)
      
      // Filter out empty metadata variables
      const validMetadataVars = metadataVars.filter(metaVar => metaVar.key.trim() && metaVar.value.trim())
      const metadata = validMetadataVars.reduce((acc, metaVar) => {
        acc[metaVar.key] = metaVar.value
        return acc
      }, {} as Record<string, unknown>)
      
      // Add description to metadata
      metadata.description = description.trim()
      
      // Prepare tags separately (preferred over metadata for key-value pairs)
      const tags: Record<string, string> = {}
      
      // Add repository tag if provided
      if (repository.trim()) {
        tags.repository = repository.trim()
      }
      
      // Move simple key-value pairs from metadata to tags
      const tagsToMove = ['project_type', 'technology', 'priority', 'status', 'category']
      tagsToMove.forEach(key => {
        if (metadata[key] && typeof metadata[key] === 'string') {
          tags[key] = String(metadata[key])
          delete metadata[key]
        }
      })

      // Use unified API client with createSession -> start mapping
      const sessionData = {
        environment: Object.keys(environment).length > 0 ? environment : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        tags: Object.keys(tags).length > 0 ? tags : undefined
      }
      
      console.log('Debug: sessionData being sent:', sessionData)
      
      await agentAPI.start!({
        environment: sessionData.environment,
        metadata: sessionData.metadata,
        tags: sessionData.tags
      })

      // プロファイル固有のリポジトリ履歴に追加
      if (repository.trim() && currentProfileId) {
        const repoName = repository.trim()
        ProfileManager.addRepositoryToProfile(currentProfileId, repoName)
        
        // 組織/リポジトリ形式の場合、プロファイル固有の組織履歴にも追加
        if (repoName.includes('/')) {
          const [organization] = repoName.split('/', 2)
          if (organization) {
            OrganizationHistory.addRepositoryToOrganization(currentProfileId, organization, repoName)
            console.log('Repository added to profile organization history from NewConversationModal:', { profileId: currentProfileId, organization, repository: repoName })
          }
        }
      }

      onSuccess()
      handleClose()
    } catch (err) {
      if (err instanceof AgentAPIProxyError) {
        setError(`Failed to create session: ${err.message}`)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create session')
      }
    } finally {
      setIsCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Start New Session
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* User ID Field */}
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              User ID *
            </label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your user ID"
              disabled={isCreating}
            />
          </div>

          {/* Repository Field - Moved to Basic Settings */}
          <div className="relative">
            <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Repository
            </label>
            <input
              type="text"
              id="repository"
              value={repository}
              onChange={handleRepositoryChange}
              onFocus={handleRepositoryFocus}
              onBlur={handleRepositoryBlur}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g., my-org/my-repo"
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Specify a repository context for this conversation session.
            </p>
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Describe what this session is about"
              disabled={isCreating}
            />
          </div>

          {/* Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Environment Variables (Optional)
              </label>
              <button
                type="button"
                onClick={addEnvVar}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                disabled={isCreating}
              >
                + Add Variable
              </button>
            </div>
            
            <div className="space-y-3">
              {envVars.map((envVar, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <input
                    type="text"
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                    className="w-full sm:flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Variable name (e.g., NODE_ENV)"
                    disabled={isCreating}
                  />
                  <input
                    type="text"
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                    className="w-full sm:flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Variable value"
                    disabled={isCreating}
                  />
                  {envVars.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEnvVar(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 self-start sm:self-center"
                      disabled={isCreating}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Environment variables will be available as context during the session.
            </p>
          </div>

          {/* Metadata Variables */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Metadata (Optional)
              </label>
              <button
                type="button"
                onClick={addMetadataVar}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                disabled={isCreating}
              >
                + Add Metadata
              </button>
            </div>
            
            <div className="space-y-3">
              {metadataVars.map((metaVar, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <input
                    type="text"
                    value={metaVar.key}
                    onChange={(e) => updateMetadataVar(index, 'key', e.target.value)}
                    className="w-full sm:flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Metadata key (e.g., project_type)"
                    disabled={isCreating}
                  />
                  <input
                    type="text"
                    value={metaVar.value}
                    onChange={(e) => updateMetadataVar(index, 'value', e.target.value)}
                    className="w-full sm:flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Metadata value"
                    disabled={isCreating}
                  />
                  {metadataVars.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMetadataVar(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 self-start sm:self-center"
                      disabled={isCreating}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Metadata fields for categorizing and filtering sessions.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating || !description.trim()}
            >
              {isCreating ? 'Creating...' : 'Start Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}