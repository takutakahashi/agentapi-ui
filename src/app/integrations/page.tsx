'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import TopBar from '../components/TopBar'
import NavigationTabs from '../components/NavigationTabs'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'
import { IntegrationScope, SciaIntegration, SciaIntegrationsResponse } from '@/types/settings'

type SelectedScopeGroups = Record<string, Record<string, string>>

const denyScopeValue = '__none__'

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<SciaIntegrationsResponse | null>(null)
  const [selectedScopeGroups, setSelectedScopeGroups] = useState<SelectedScopeGroups>({})
  const [loading, setLoading] = useState(true)
  const [connectingIntegrationID, setConnectingIntegrationID] = useState<string | null>(null)
  const [revokingIntegrationID, setRevokingIntegrationID] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const loadIntegrations = async () => {
    setLoading(true)
    setError(null)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const response = await client.getIntegrations()
      setIntegrations(response)
      setSelectedScopeGroups((current) => {
        const next = { ...current }
        for (const integration of response.integrations || []) {
          if (!next[integration.id]) {
            next[integration.id] = defaultScopeGroups(integration)
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

  const setScopeGroup = (integration: SciaIntegration, groupID: string, scopeID: string) => {
    setSelectedScopeGroups((current) => {
      return {
        ...current,
        [integration.id]: {
          ...(current[integration.id] || {}),
          [groupID]: scopeID,
        },
      }
    })
  }

  const setScopeGroupAllowed = (integration: SciaIntegration, group: ScopeGroup, allowed: boolean) => {
    setScopeGroup(integration, group.id, allowed ? fallbackScopeForGroup(group) : denyScopeValue)
  }

  const startOAuth = async (integration: SciaIntegration) => {
    if (!integration.authorization_url_endpoint) return
    setConnectingIntegrationID(integration.id)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      const response = await client.createIntegrationAuthorizationURL(integration.id, {
        redirect_uri: `${window.location.origin}/api/oauth/${integration.provider}/callback`,
        scope_ids: scopeIDsForSelectedGroups(integration, selectedScopeGroups[integration.id] || defaultScopeGroups(integration)),
      })
      window.location.href = response.authorization_url
    } catch (err) {
      console.error('Failed to create authorization URL:', err)
      showToast('OAuth URL を作成できませんでした', 'error')
      setConnectingIntegrationID(null)
    }
  }

  const revokeIntegration = async (integration: SciaIntegration) => {
    if (!integration.connected) return
    if (!window.confirm(`${integration.name} の連携を解除しますか？`)) return
    setRevokingIntegrationID(integration.id)
    try {
      const client = createAgentAPIProxyClientFromStorage()
      await client.revokeIntegration(integration.id)
      showToast(`${integration.name} 連携を解除しました`, 'success')
      await loadIntegrations()
    } catch (err) {
      console.error('Failed to revoke integration:', err)
      showToast('連携を解除できませんでした', 'error')
    } finally {
      setRevokingIntegrationID(null)
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
                    <div className="mt-5 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          アクセスを許可する
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {scopeGroups(integration).map((group) => {
                          const selectedScopeID = selectedScopeGroups[integration.id]?.[group.id] ?? defaultScopeForGroup(group)
                          const allowed = selectedScopeID !== denyScopeValue
                          return (
                            <fieldset
                              key={group.id}
                              className={`rounded-md border p-3 transition-colors ${
                                allowed
                                  ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900/70 dark:bg-blue-900/10'
                                  : 'border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/70'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {group.name}
                                  </h4>
                                  {group.desc && (
                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                      {group.desc}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={allowed}
                                  onClick={() => setScopeGroupAllowed(integration, group, !allowed)}
                                  className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                                    allowed ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                      allowed ? 'translate-x-5' : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                              </div>

                              {allowed && (
                                <div className="mt-3 border-t border-blue-100 pt-3 dark:border-blue-900/50">
                                  <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                    詳しいアクセス
                                  </div>
                                  <div className="space-y-1.5">
                                    {group.scopes.map((scope) => (
                                      <ScopeRadio
                                        key={scope.id}
                                        integrationID={integration.id}
                                        groupID={group.id}
                                        scope={scope}
                                        checked={selectedScopeID === scope.id}
                                        onChange={() => setScopeGroup(integration, group.id, scope.id)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </fieldset>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => startOAuth(integration)}
                      disabled={!integration.authorization_url_endpoint || connectingIntegrationID === integration.id || revokingIntegrationID === integration.id}
                      className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {connectingIntegrationID === integration.id ? 'Connecting...' : integration.connected ? `Reconnect ${integration.name}` : `Connect ${integration.name}`}
                      </span>
                    </button>
                    {integration.connected && (
                      <button
                        type="button"
                        onClick={() => revokeIntegration(integration)}
                        disabled={revokingIntegrationID === integration.id || connectingIntegrationID === integration.id}
                        aria-label={`Revoke ${integration.name}`}
                        title={`Revoke ${integration.name}`}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-900/70 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-900/20 dark:focus:ring-offset-gray-800"
                      >
                        <Trash2 className={`h-4 w-4 ${revokingIntegrationID === integration.id ? 'animate-pulse' : ''}`} />
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function ScopeRadio({
  integrationID,
  groupID,
  scope,
  checked,
  onChange,
}: {
  integrationID: string
  groupID: string
  scope: IntegrationScope
  checked: boolean
  onChange: () => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
        checked
          ? 'bg-white text-gray-900 shadow-sm ring-1 ring-blue-100 dark:bg-gray-800 dark:text-white dark:ring-blue-900/60'
          : 'text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-800/70'
      }`}
    >
      <input
        type="radio"
        name={`${integrationID}-${groupID}`}
        value={scope.id}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-3.5 w-3.5 border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="min-w-0">
        <span className="block font-medium">
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
}

function defaultScopeGroups(integration: SciaIntegration): Record<string, string> {
  const selected: Record<string, string> = {}
  for (const group of scopeGroups(integration)) {
    selected[group.id] = defaultScopeForGroup(group)
  }
  return selected
}

function defaultScopeForGroup(group: ScopeGroup): string {
  return group.scopes.find((scope) => scope.enabled)?.id || denyScopeValue
}

function fallbackScopeForGroup(group: ScopeGroup): string {
  return group.scopes.find((scope) => scope.enabled)?.id || group.scopes[0]?.id || denyScopeValue
}

function scopeIDsForSelectedGroups(integration: SciaIntegration, selectedGroups: Record<string, string>): string[] {
  const scopeIDs = new Set(integration.scopes.map((scope) => scope.id))
  return Object.values(selectedGroups).filter((scopeID) => scopeID !== denyScopeValue && scopeIDs.has(scopeID))
}

type ScopeGroup = { id: string; name: string; desc?: string; scopes: IntegrationScope[] }

function scopeGroups(integration: SciaIntegration): ScopeGroup[] {
  const groups = new Map<string, ScopeGroup>()
  for (const scope of integration.scopes) {
    const groupID = scope.group || scope.id
    const group = groups.get(groupID) || {
      id: groupID,
      name: scope.group_name || scope.name,
      desc: scope.group_desc,
      scopes: [],
    }
    group.scopes.push(scope)
    groups.set(groupID, group)
  }
  return Array.from(groups.values())
}
