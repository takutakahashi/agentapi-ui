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
  placeholder = 'プロファイルを選択（任意）',
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
        setProfiles(response.session_profiles || [])
      } catch {
        // silently ignore fetch errors
      } finally {
        setLoading(false)
      }
    }
    fetchProfiles()
  }, [getScopeParams])

  if (loading) {
    return (
      <select
        disabled
        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white opacity-50 ${className}`}
      >
        <option>読み込み中...</option>
      </select>
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 ${className}`}
    >
      <option value="">{placeholder}</option>
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.name}
          {profile.is_default ? ' (デフォルト)' : ''}
          {profile.scope === 'team' ? ' [チーム]' : ''}
        </option>
      ))}
    </select>
  )
}
