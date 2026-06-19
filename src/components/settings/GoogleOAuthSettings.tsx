'use client'

import { CheckCircle, ExternalLink, RefreshCw, XCircle } from 'lucide-react'
import { GoogleOAuthStatus } from '@/types/settings'

interface GoogleOAuthSettingsProps {
  status: GoogleOAuthStatus | null
  loading: boolean
  onRefresh: () => void
}

export function GoogleOAuthSettings({ status, loading, onRefresh }: GoogleOAuthSettingsProps) {
  const startOAuth = () => {
    if (!status?.oauth_start_url) return
    window.location.href = status.oauth_start_url
  }

  const enabled = status?.enabled ?? false
  const connected = status?.connected ?? false
  const canStart = enabled && Boolean(status?.oauth_start_url)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Google OAuth
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            scia OAuth broker で Google refresh token を保存します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            title="Refresh Google OAuth status"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={startOAuth}
            disabled={!canStart}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            Authorize
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatusItem label="scia broker" ok={enabled && (status?.health_ok ?? false)} detail={status?.health_status || (enabled ? 'Checking failed' : 'Disabled')} />
        <StatusItem label="Google client" ok={status?.client_configured ?? false} detail={status?.credential || 'Not configured'} />
        <StatusItem label="Refresh token" ok={connected} detail={connected ? 'Stored in scia secret store' : 'Not connected'} />
        <StatusItem label="Session proxy" ok={status?.proxy_configured ?? false} detail={status?.proxy_configured ? 'Configured for sessions' : 'Not configured'} />
      </div>

      {status?.user_namespace && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          scia user: <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">{status.user_namespace}</code>
        </p>
      )}
    </div>
  )
}

function StatusItem({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex min-h-16 items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
      {ok ? (
        <CheckCircle className="mt-0.5 h-4 w-4 flex-none text-green-500" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 flex-none text-gray-400" />
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</div>
        <div className="break-words text-xs text-gray-500 dark:text-gray-400">{detail}</div>
      </div>
    </div>
  )
}
