'use client'

import { useState } from 'react'
import { createAgentAPIClientFromStorage, AgentAPIError } from '../../lib/agentapi-client'

interface NewSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function NewSessionModal({ isOpen, onClose, onSuccess }: NewSessionModalProps) {
  const [initialMessage, setInitialMessage] = useState('')
  const [repository, setRepository] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      const client = createAgentAPIClientFromStorage()
      
      await client.createSession({
        user_id: 'current-user',
        environment: repository.trim() ? {
          REPOSITORY: repository.trim()
        } : {},
        metadata: {
          description: initialMessage.trim()
        },
        tags: repository.trim() ? {
          repository: repository.trim()
        } : undefined
      })

      setInitialMessage('')
      setRepository('')
      onSuccess()
      onClose()
    } catch (err) {
      if (err instanceof AgentAPIError) {
        setError(`セッション作成に失敗しました: ${err.message}`)
      } else {
        setError('予期しないエラーが発生しました')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setInitialMessage('')
      setRepository('')
      setError(null)
      onClose()
    }
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
            disabled={isCreating}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="initialMessage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              初期メッセージ *
            </label>
            <textarea
              id="initialMessage"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="このセッションで何をしたいか説明してください..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              rows={4}
              disabled={isCreating}
              required
            />
          </div>

          <div>
            <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              対象リポジトリ
            </label>
            <input
              id="repository"
              type="text"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder="例: owner/repository-name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isCreating}
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
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