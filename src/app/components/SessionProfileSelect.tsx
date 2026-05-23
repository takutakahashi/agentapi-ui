'use client'

import { useState, useEffect } from 'react'
import { SessionProfile } from '../../types/session_profile'
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client'
import { useTeamScope } from '../../contexts/TeamScopeContext'

interface SessionProfileSelectProps {
  value: string
  onChange: (profileId: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export default function SessionProfileSelect({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'プロファイルなし',
}: SessionProfileSelectProps) {
  const { getScopeParams } = useTeamScope()
  const [profiles, setProfiles] = useState<SessionProfile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoading(true)
        const client = createAgentAPIProxyClientFromStorage()
        const response = await client.getSessionProfiles({ ...getScopeParams() })
        const fetched = response.session_profiles || []
        setProfiles(fetched)
        // Auto-select the default profile if nothing is selected yet
        if (!value) {
          const defaultProfile = fetched.find((p) => p.is_default)
          if (defaultProfile) {
            onChange(defaultProfile.id)
          }
        }
      } catch {
        // silently ignore fetch errors
      } finally {
        setLoading(false)
      }
    }
    fetchProfiles()
  }, [getScopeParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = profiles.find((p) => p.id === value)

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${disabled ? 'opacity-50' : ''} ${className}`}>
      {/* Select row */}
      <div className="relative flex items-center bg-white dark:bg-gray-800">
        {/* Profile icon */}
        <div className="flex-shrink-0 pl-3 text-gray-400 dark:text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 text-sm text-gray-400 dark:text-gray-500">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            読み込み中...
          </div>
        ) : (
          <>
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="flex-1 appearance-none bg-transparent pl-2 pr-8 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
            >
              <option value="">{placeholder}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                  {profile.is_default ? ' ★' : ''}
                  {profile.scope === 'team' ? ' [チーム]' : ''}
                </option>
              ))}
            </select>
            {/* Chevron */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Selected profile info strip */}
      {selected && (
        <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap">
          {selected.is_default && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              デフォルト
            </span>
          )}
          {selected.scope === 'team' && (
            <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
              チーム
            </span>
          )}
          {selected.config?.params?.agent_type && (
            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
              {selected.config.params.agent_type}
            </span>
          )}
          {selected.config?.params?.sandbox?.enabled && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              サンドボックス
            </span>
          )}
          {selected.config?.environment && Object.keys(selected.config.environment).length > 0 && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              ENV×{Object.keys(selected.config.environment).length}
            </span>
          )}
          {selected.description && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[180px]">
              {selected.description}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
