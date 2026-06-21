'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, ExternalLink, RefreshCw } from 'lucide-react'
import TopBar from '../components/TopBar'
import NavigationTabs from '../components/NavigationTabs'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'
import { IntegrationScope, SciaIntegration, SciaIntegrationsResponse } from '@/types/settings'

type AccessLevel = 'read' | 'read_write' | 'none'

const accessOptions: Array<{ value: AccessLevel; label: string }> = [
  { value: 'read', label: '読み込みのみ' },
  { value: 'read_write', label: '読み込みと書き込み' },
  { value: 'none', label: '許可しない' },
]

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<SciaIntegrationsResponse | null>(null)
  const [selectedAccessLevels, setSelectedAccessLevels] = useState<Record<string, AccessLevel>>({})
  const [loading, setLoading] = useState(true)
  const [connectingIntegrationID, setConnectingIntegrationID] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const loadIntegrations = async () => {
    setLoading(true)
    setError(null)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const response = await client.getIntegrations()
      setIntegrations(response)
      setSelectedAccessLevels((current) => {
        const next = { ...current }
        for (const integration of response.integrations || []) {
          if (!next[integration.id]) {
            next[integration.id] = defaultAccessLevel(integration)
          }
        }
        return next
      })
    } catch (err) {
      console.error('Failed to load integrations:', err)
      setError('Integrations を読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connectedProvider = params.get('integration_connected')
    if (connectedProvider) {
      showToast(`${connectedProvider} 連携が完了しました`, 'success')
      window.history.replaceState(null, '', '/integrations')
    }
  }, [showToast])

  useEffect(() => {
    loadIntegrations()
  }, [])

  const visibleIntegrations = useMemo(() => {
    return (integrations?.integrations || []).filter((integration) => integration.released)
  }, [integrations])

  const setAccessLevel = (integration: SciaIntegration, value: AccessLevel) => {
    setSelectedAccessLevels((current) => {
      return { ...current, [integration.id]: value }
    })
  }

  const startOAuth = async (integration: SciaIntegration) => {
    if (!integration.authorization_url_endpoint) return
    setConnectingIntegrationID(integration.id)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const response = await client.createIntegrationAuthorizationURL(integration.id, {
        redirect_uri: `${window.location.origin}/api/oauth/${integration.provider}/callback`,
        scope_ids: scopeIDsForAccessLevel(integration, selectedAccessLevels[integration.id] || defaultAccessLevel(integration)),
      })
      window.location.href = response.authorization_url
    } catch (err) {
      console.error('Failed to create authorization URL:', err)
      showToast('OAuth URL を作成できませんでした', 'error')
      setConnectingIntegrationID(null)
    }
  }

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <TopBar
        title="Integrations"
        showSettingsButton={true}
      >
        <div className="md:hidden">
          <NavigationTabs />
        </div>
      </TopBar>

      <div className="px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-6 md:pb-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={loadIntegrations}
              disabled={loading}
              aria-label="Refresh integrations"
              title="Refresh integrations"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : !integrations?.enabled || visibleIntegrations.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              No SaaS integrations are available.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleIntegrations.map((integration) => (
                <section
                  key={integration.id}
                  className="flex min-h-[320px] flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {integration.icon_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={integration.icon_url} alt="" className="h-5 w-5 shrink-0" />
                        )}
                        <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                          {integration.name}
                        </h2>
                      </div>
                      {integration.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {integration.description}
                        </p>
                      )}
                    </div>
                    {integration.connected && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Connected
                      </span>
                    )}
                  </div>

                  {integration.scopes.length > 0 && (
                    <fieldset className="mt-5">
                      <legend className="text-sm font-semibold text-gray-900 dark:text-white">
                        詳しいアクセス
                      </legend>
                      <div className="mt-3 grid gap-2">
                        {accessOptions.map((option) => {
                          const checked = (selectedAccessLevels[integration.id] || defaultAccessLevel(integration)) === option.value
                          const disabled = option.value !== 'none' && scopeIDsForAccessLevel(integration, option.value).length === 0
                          return (
                            <label
                              key={option.value}
                              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                                checked
                                  ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-100'
                                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700/60'
                              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              <input
                                type="radio"
                                name={`${integration.id}-access`}
                                value={option.value}
                                checked={checked}
                                disabled={disabled}
                                onChange={() => setAccessLevel(integration, option.value)}
                                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="font-medium">{option.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}

                  <button
                    type="button"
                    onClick={() => startOAuth(integration)}
                    disabled={!integration.authorization_url_endpoint || connectingIntegrationID === integration.id}
                    className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {connectingIntegrationID === integration.id ? 'Connecting...' : integration.connected ? `Reconnect ${integration.name}` : `Connect ${integration.name}`}
                  </button>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function defaultAccessLevel(integration: SciaIntegration): AccessLevel {
  if (scopeIDsForAccessLevel(integration, 'read').length > 0) return 'read'
  if (scopeIDsForAccessLevel(integration, 'read_write').length > 0) return 'read_write'
  return 'none'
}

function scopeIDsForAccessLevel(integration: SciaIntegration, level: AccessLevel): string[] {
  if (level === 'none') return []

  const scopes = integration.scopes.filter((scope) => scope.enabled)
  if (level === 'read_write') {
    return preferredScopesByGroup(scopes, 'write').map((scope) => scope.id)
  }

  return preferredScopesByGroup(scopes, 'read').map((scope) => scope.id)
}

function preferredScopesByGroup(scopes: IntegrationScope[], preference: 'read' | 'write'): IntegrationScope[] {
  const grouped = new Map<string, IntegrationScope[]>()
  const standalone: IntegrationScope[] = []

  for (const scope of scopes) {
    if (!scope.group) {
      standalone.push(scope)
      continue
    }
    const groupScopes = grouped.get(scope.group) || []
    groupScopes.push(scope)
    grouped.set(scope.group, groupScopes)
  }

  const selected = Array.from(grouped.values())
    .map((groupScopes) => selectScope(groupScopes, preference))
    .filter((scope): scope is IntegrationScope => Boolean(scope))

  const standaloneScopes = standalone.filter((scope) => {
    const type = scopeAccessType(scope)
    return preference === 'write' ? type !== 'read' : type === 'read'
  })

  return [...selected, ...standaloneScopes]
}

function selectScope(scopes: IntegrationScope[], preference: 'read' | 'write'): IntegrationScope | undefined {
  const readScopes = scopes.filter((scope) => scopeAccessType(scope) === 'read')
  const writeScopes = scopes.filter((scope) => scopeAccessType(scope) === 'write')

  if (preference === 'write') {
    return writeScopes[0] || scopes[0]
  }

  return readScopes[0]
}

function scopeAccessType(scope: IntegrationScope): 'read' | 'write' {
  const text = `${scope.id} ${scope.name} ${scope.desc || ''}`.toLowerCase()
  if (/(write|read_write|read-write|read\/write|edit|create|delete|manage|admin|modify|full|post|send)/.test(text)) {
    return 'write'
  }
  return 'read'
}
