'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, ExternalLink } from 'lucide-react'
import TopBar from '../components/TopBar'
import NavigationTabs from '../components/NavigationTabs'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'
import { GoogleOAuthStatus } from '@/types/settings'

export default function IntegrationsPage() {
  const [googleStatus, setGoogleStatus] = useState<GoogleOAuthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_oauth') === 'connected') {
      showToast('Google OAuth 連携が完了しました', 'success')
      window.history.replaceState(null, '', '/integrations')
    }
  }, [showToast])

  useEffect(() => {
    const loadIntegrations = async () => {
      setLoading(true)
      setError(null)
      try {
        const client = createAgentAPIProxyClientFromStorage()
        setGoogleStatus(await client.getGoogleOAuthStatus())
      } catch (err) {
        console.error('Failed to load integrations:', err)
        setError('Integrations を読み込めませんでした')
      } finally {
        setLoading(false)
      }
    }

    loadIntegrations()
  }, [])

  const googleAvailable = useMemo(() => {
    return Boolean(googleStatus?.enabled && googleStatus.oauth_start_url)
  }, [googleStatus])

  const startGoogleOAuth = () => {
    if (!googleStatus?.oauth_start_url) return
    const startUrl = new URL(googleStatus.oauth_start_url, window.location.origin)
    startUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/oauth/google/callback`)
    window.location.href = startUrl.toString()
  }

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <TopBar
        title="Integrations"
        subtitle="Connect external SaaS accounts"
        showSettingsButton={true}
      >
        <div className="md:hidden">
          <NavigationTabs />
        </div>
      </TopBar>

      <div className="px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-6 md:pb-8">
        <div className="mx-auto max-w-3xl">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : googleAvailable ? (
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Google</h2>
                    {googleStatus?.connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Allow sessions to use Google OAuth through scia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startGoogleOAuth}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  {googleStatus?.connected ? 'Reconnect Google' : 'Connect Google'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              No SaaS integrations are available.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
