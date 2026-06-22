'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, ExternalLink, RefreshCw, Unlink } from 'lucide-react'
import TopBar from '../components/TopBar'
import NavigationTabs from '../components/NavigationTabs'
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client'
import { useToast } from '@/contexts/ToastContext'
import { useTeamScope } from '@/contexts/TeamScopeContext'
import { IntegrationScope, SciaIntegration, SciaIntegrationsResponse } from '@/types/settings'

type SelectedScopeGroups = Record<string, Record<string, string>>

const denyScopeValue = '__none__'

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<SciaIntegrationsResponse | null>(null)
  const [selectedScopeGroups, setSelectedScopeGroups] = useState<SelectedScopeGroups>({})
  const [selectedIntegrationID, setSelectedIntegrationID] = useState<string | null>(null)
  const [serviceSidebarVisible, setServiceSidebarVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connectingIntegrationID, setConnectingIntegrationID] = useState<string | null>(null)
  const [revokingIntegrationID, setRevokingIntegrationID] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const { isTeamScope, isLoading: isTeamScopeLoading } = useTeamScope()

  const loadIntegrations = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connectedProvider = params.get('integration_connected')
    if (connectedProvider) {
      showToast(`${connectedProvider} 連携が完了しました`, 'success')
      window.history.replaceState(null, '', '/integrations')
    }
  }, [showToast])

  useEffect(() => {
    if (isTeamScopeLoading) return

    if (isTeamScope) {
      setLoading(false)
      setError(null)
      return
    }

    loadIntegrations()
  }, [isTeamScope, isTeamScopeLoading, loadIntegrations])

  const visibleIntegrations = useMemo(() => {
    return (integrations?.integrations || []).filter((integration) => integration.released)
  }, [integrations])

  useEffect(() => {
    if (visibleIntegrations.length === 0) {
      setSelectedIntegrationID(null)
      return
    }
    if (!selectedIntegrationID || !visibleIntegrations.some((integration) => integration.id === selectedIntegrationID)) {
      setSelectedIntegrationID(visibleIntegrations[0].id)
    }
  }, [selectedIntegrationID, visibleIntegrations])

  const selectedIntegration = useMemo(() => {
    return visibleIntegrations.find((integration) => integration.id === selectedIntegrationID) || visibleIntegrations[0]
  }, [selectedIntegrationID, visibleIntegrations])

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
        showFilterButton={true}
        filterButtonText="サービス"
        showSettingsButton={true}
        onFilterToggle={() => setServiceSidebarVisible(!serviceSidebarVisible)}
      >
        <div className="md:hidden">
          <NavigationTabs />
        </div>
      </TopBar>

      <div className="flex">
        <aside className="hidden h-[calc(100dvh-65px)] w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800 md:block">
          <NavigationTabs />
        </aside>

        <IntegrationServiceSidebar
          integrations={visibleIntegrations}
          selectedIntegrationID={selectedIntegration?.id || null}
          isVisible={serviceSidebarVisible}
          loading={isTeamScopeLoading || loading}
          disabled={isTeamScope || !!error || !integrations?.enabled}
          onSelect={(integrationID) => {
            setSelectedIntegrationID(integrationID)
            setServiceSidebarVisible(false)
          }}
          onClose={() => setServiceSidebarVisible(false)}
          onRefresh={loadIntegrations}
          refreshDisabled={isTeamScope || loading}
        />

        <div className="min-w-0 flex-1 px-4 pb-6 pt-6 md:px-6 md:pb-8 md:pt-8 lg:px-8">
          {isTeamScopeLoading || loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
          ) : isTeamScope ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              チームでは利用できません。
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : !integrations?.enabled || visibleIntegrations.length === 0 || !selectedIntegration ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              No SaaS integrations are available.
            </div>
          ) : (
            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
                <div className="min-w-0 border-b border-gray-200 p-5 dark:border-gray-700 xl:border-b-0 xl:border-r">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        {selectedIntegration.icon_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedIntegration.icon_url} alt="" className="h-8 w-8 shrink-0 rounded-md" />
                        )}
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedIntegration.name}
                          </h2>
                          <p className="mt-0.5 text-xs font-medium uppercase text-gray-400 dark:text-gray-500">
                            {selectedIntegration.provider}
                          </p>
                        </div>
                      </div>
                      {selectedIntegration.description && (
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                          {selectedIntegration.description}
                        </p>
                      )}
                    </div>
                    {selectedIntegration.connected && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Connected
                      </span>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startOAuth(selectedIntegration)}
                      disabled={!selectedIntegration.authorization_url_endpoint || connectingIntegrationID === selectedIntegration.id || revokingIntegrationID === selectedIntegration.id}
                      className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {connectingIntegrationID === selectedIntegration.id ? 'Connecting...' : selectedIntegration.connected ? 'Reconnect' : `Connect ${selectedIntegration.name}`}
                      </span>
                    </button>
                    {selectedIntegration.connected && (
                      <button
                        type="button"
                        onClick={() => revokeIntegration(selectedIntegration)}
                        disabled={revokingIntegrationID === selectedIntegration.id || connectingIntegrationID === selectedIntegration.id}
                        aria-label={`Revoke ${selectedIntegration.name}`}
                        title={`Revoke ${selectedIntegration.name}`}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-900/70 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-900/20 dark:focus:ring-offset-gray-800"
                      >
                        <Unlink className={`h-4 w-4 ${revokingIntegrationID === selectedIntegration.id ? 'animate-pulse' : ''}`} />
                        <span>{revokingIntegrationID === selectedIntegration.id ? 'Revoking...' : 'Revoke'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="min-w-0 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    アクセスを許可する
                  </h3>
                  {selectedIntegration.scopes.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {scopeGroups(selectedIntegration).map((group) => {
                        const selectedScopeID = selectedScopeGroups[selectedIntegration.id]?.[group.id] ?? defaultScopeForGroup(group)
                        const allowed = selectedScopeID !== denyScopeValue
                        return (
                          <ScopeGroupFieldset
                            key={group.id}
                            integration={selectedIntegration}
                            group={group}
                            selectedScopeID={selectedScopeID}
                            allowed={allowed}
                            onAllowedChange={(nextAllowed) => setScopeGroupAllowed(selectedIntegration, group, nextAllowed)}
                            onScopeChange={(scopeID) => setScopeGroup(selectedIntegration, group.id, scopeID)}
                          />
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                      追加のアクセス設定はありません。
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

function IntegrationServiceSidebar({
  integrations,
  selectedIntegrationID,
  isVisible,
  loading,
  disabled,
  refreshDisabled,
  onSelect,
  onClose,
  onRefresh,
}: {
  integrations: SciaIntegration[]
  selectedIntegrationID: string | null
  isVisible: boolean
  loading: boolean
  disabled: boolean
  refreshDisabled: boolean
  onSelect: (integrationID: string) => void
  onClose: () => void
  onRefresh: () => void
}) {
  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 flex w-80 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-800
        md:relative md:z-auto md:h-[calc(100dvh-65px)] md:w-72 md:translate-x-0
        ${isVisible ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Services</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {loading ? 'Loading...' : `${integrations.length} services`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshDisabled}
            aria-label="Refresh integrations"
            title="Refresh integrations"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close services"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 md:hidden"
          >
            ×
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {disabled || integrations.length === 0 ? (
          <p className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">
            利用できるサービスはありません。
          </p>
        ) : (
          <div className="space-y-1">
            {integrations.map((integration) => {
              const active = integration.id === selectedIntegrationID
              return (
                <button
                  type="button"
                  key={integration.id}
                  onClick={() => onSelect(integration.id)}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {integration.icon_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={integration.icon_url} alt="" className="h-5 w-5 shrink-0 rounded" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{integration.name}</span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {integration.connected ? 'Connected' : 'Not connected'}
                      </span>
                    </span>
                    {integration.connected && (
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-300" />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

function ScopeGroupFieldset({
  integration,
  group,
  selectedScopeID,
  allowed,
  onAllowedChange,
  onScopeChange,
}: {
  integration: SciaIntegration
  group: ScopeGroup
  selectedScopeID: string
  allowed: boolean
  onAllowedChange: (allowed: boolean) => void
  onScopeChange: (scopeID: string) => void
}) {
  return (
    <fieldset
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
          onClick={() => onAllowedChange(!allowed)}
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
                onChange={() => onScopeChange(scope.id)}
              />
            ))}
          </div>
        </div>
      )}
    </fieldset>
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
