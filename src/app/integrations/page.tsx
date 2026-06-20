'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, ExternalLink, RefreshCw } from 'lucide-react'
import TopBar from '../components/TopBar'
import NavigationTabs from '../components/NavigationTabs'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'
import { IntegrationScope, SciaIntegration, SciaIntegrationsResponse } from '@/types/settings'

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<SciaIntegrationsResponse | null>(null)
  const [selectedScopes, setSelectedScopes] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const loadIntegrations = async () => {
    setLoading(true)
    setError(null)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const response = await client.getIntegrations()
      setIntegrations(response)
      setSelectedScopes((current) => {
        const next = { ...current }
        for (const integration of response.integrations || []) {
          if (!next[integration.id]) {
            next[integration.id] = defaultScopes(integration)
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

  const setScopeSelected = (integration: SciaIntegration, value: string, checked: boolean) => {
    setSelectedScopes((current) => {
      const currentValues = current[integration.id] || []
      const nextValues = checked
        ? Array.from(new Set([...currentValues, value]))
        : currentValues.filter((scope) => scope !== value)
      return { ...current, [integration.id]: nextValues }
    })
  }

  const setScopeGroupSelected = (integration: SciaIntegration, group: string, value: string) => {
    setSelectedScopes((current) => {
      const currentValues = current[integration.id] || []
      const groupScopeIDs = new Set(integration.scopes.filter((scope) => scope.group === group).map((scope) => scope.id))
      const nextValues = [...currentValues.filter((scope) => !groupScopeIDs.has(scope)), value]
      return { ...current, [integration.id]: Array.from(new Set(nextValues)) }
    })
  }

  const startOAuth = (integration: SciaIntegration) => {
    if (!integration.start_url) return
    const startUrl = new URL(integration.start_url, window.location.origin)
    startUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/oauth/${integration.provider}/callback`)

    const scopes = selectedScopes[integration.id] || []
    if (scopes.length > 0) {
      startUrl.searchParams.set('scope', scopes.join(scopeSeparator(integration.provider)))
    }

    window.location.href = startUrl.toString()
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
        <div className="mx-auto max-w-4xl">
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
            <div className="grid gap-4 md:grid-cols-2">
              {visibleIntegrations.map((integration) => (
                <section
                  key={integration.id}
                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
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
                    <div className="mt-4 space-y-2">
                      {scopeGroups(integration).map((group) => (
                        <fieldset
                          key={group.id}
                          className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
                        >
                          <legend className="px-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                            {group.name}
                          </legend>
                          {group.desc && (
                            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                              {group.desc}
                            </p>
                          )}
                          <div className="space-y-2">
                            {group.scopes.map((scope) => {
                              const checked = (selectedScopes[integration.id] || []).includes(scope.id)
                              return (
                                <label
                                  key={scope.id}
                                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
                                >
                                  <input
                                    type="radio"
                                    name={`${integration.id}-${group.id}`}
                                    checked={checked}
                                    onChange={() => setScopeGroupSelected(integration, group.id, scope.id)}
                                    className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="min-w-0">
                                    <span className="block font-medium text-gray-800 dark:text-gray-100">
                                      {scope.name}
                                    </span>
                                    {scope.desc && (
                                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                        {scope.desc}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </fieldset>
                      ))}

                      {ungroupedScopes(integration).map((scope) => {
                        const checked = (selectedScopes[integration.id] || []).includes(scope.id)
                        return (
                          <label
                            key={scope.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/60"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => setScopeSelected(integration, scope.id, event.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="min-w-0">
                              <span className="block font-medium text-gray-800 dark:text-gray-100">
                                {scope.name}
                              </span>
                              {scope.desc && (
                                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                  {scope.desc}
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => startOAuth(integration)}
                    disabled={!integration.start_url}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {integration.connected ? `Reconnect ${integration.name}` : `Connect ${integration.name}`}
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

function defaultScopes(integration: SciaIntegration): string[] {
  const selected: string[] = []
  const selectedGroups = new Set<string>()
  for (const scope of integration.scopes) {
    if (!scope.enabled) continue
    if (scope.group) {
      if (selectedGroups.has(scope.group)) continue
      selectedGroups.add(scope.group)
    }
    selected.push(scope.id)
  }
  return selected
}

function scopeGroups(integration: SciaIntegration): Array<{ id: string; name: string; desc?: string; scopes: IntegrationScope[] }> {
  const groups = new Map<string, { id: string; name: string; desc?: string; scopes: IntegrationScope[] }>()
  for (const scope of integration.scopes) {
    if (!scope.group) continue
    const group = groups.get(scope.group) || {
      id: scope.group,
      name: scope.group_name || scope.group,
      desc: scope.group_desc,
      scopes: [],
    }
    group.scopes.push(scope)
    groups.set(scope.group, group)
  }
  return Array.from(groups.values())
}

function ungroupedScopes(integration: SciaIntegration): IntegrationScope[] {
  return integration.scopes.filter((scope) => !scope.group)
}

function scopeSeparator(provider: string): string {
  return provider === 'todoist' ? ',' : ' '
}
