'use client'

import { useState, useEffect, useCallback } from 'react'

interface MCPOAuthStatus {
  connected: boolean
  expires_at?: string
  has_refresh_token?: boolean
}

interface MCPOAuthConnectResponse {
  authorization_url: string
  state: string
}

interface MCPOAuthButtonProps {
  serverName: string
  serverUrl: string
  initialStatus?: {
    connected: boolean
    expiresAt?: string
  }
}

/** Extract a human-readable error message from any API error response shape. */
function extractErrorMessage(data: unknown, statusCode: number): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    // Try common error field names in order
    const msg = d.message ?? d.error ?? d.detail ?? d.details
    if (typeof msg === 'string' && msg) return msg
  }
  if (typeof data === 'string' && data) return data
  return `リクエストに失敗しました (HTTP ${statusCode})`
}

export function MCPOAuthButton({ serverName, serverUrl, initialStatus }: MCPOAuthButtonProps) {
  const [status, setStatus] = useState<MCPOAuthStatus>({
    connected: initialStatus?.connected ?? false,
    expires_at: initialStatus?.expiresAt,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/proxy/mcp-oauth/status/${encodeURIComponent(serverName)}`)
      if (res.ok) {
        const data: MCPOAuthStatus = await res.json()
        setStatus(data)
      }
    } catch {
      // silently ignore status fetch errors
    }
  }, [serverName])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleConnect = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/mcp-oauth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_name: serverName,
          mcp_server_url: serverUrl,
        }),
      })

      if (!res.ok) {
        // Parse JSON but fall back to null if the body is not JSON (e.g. HTML error page)
        const errData = await res.json().catch(() => null)
        setError(extractErrorMessage(errData, res.status))
        return
      }

      const data: MCPOAuthConnectResponse = await res.json()

      // Open the authorization URL in a popup
      const popup = window.open(
        data.authorization_url,
        'mcp-oauth-popup',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      )

      if (!popup) {
        // Fallback: open in new tab if popup was blocked
        window.open(data.authorization_url, '_blank')
        setError('ポップアップがブロックされました。ポップアップを許可して再試行するか、新しいタブで認証を完了してください。')
        setLoading(false)
        return
      }

      // Listen for postMessage from the callback page
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'mcp-oauth-complete') {
          window.removeEventListener('message', handleMessage)
          clearInterval(pollInterval)
          popup.close()
          if (event.data.success) {
            fetchStatus()
          } else {
            setError(event.data.error || 'OAuth 認証に失敗しました')
          }
          setLoading(false)
        }
      }
      window.addEventListener('message', handleMessage)

      // Also poll status in case postMessage doesn't arrive (popup closed manually)
      const pollInterval = setInterval(async () => {
        if (popup.closed) {
          clearInterval(pollInterval)
          window.removeEventListener('message', handleMessage)
          await fetchStatus()
          setLoading(false)
        }
      }, 1000)

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        window.removeEventListener('message', handleMessage)
        if (!popup.closed) popup.close()
        setLoading(false)
        fetchStatus()
      }, 5 * 60 * 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth フローの開始に失敗しました')
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm(`"${serverName}" の OAuth 接続を解除しますか？`)) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proxy/mcp-oauth/disconnect/${encodeURIComponent(serverName)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setStatus({ connected: false })
      } else {
        const errData = await res.json().catch(() => null)
        setError(extractErrorMessage(errData, res.status))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '切断に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const isExpired = status.expires_at ? new Date(status.expires_at) < new Date() : false

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {status.connected && !isExpired ? (
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              OAuth Connected
            </span>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {isExpired ? 'Reconnect OAuth' : 'Connect OAuth'}
              </>
            )}
          </button>
        )}
        {isExpired && status.connected && (
          <span className="text-xs text-amber-500 dark:text-amber-400">Token expired</span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
