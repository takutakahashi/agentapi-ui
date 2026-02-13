'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Webhook } from '../../../types/webhook'
import { createAgentAPIProxyClientFromStorage } from '../../../lib/agentapi-proxy-client'
import TopBar from '../../components/TopBar'
import NavigationTabs from '../../components/NavigationTabs'
import WebhookStatusBadge from '../../components/WebhookStatusBadge'
import WebhookTriggerTest from '../../components/WebhookTriggerTest'
import LoadingSpinner from '../../components/LoadingSpinner'

interface WebhookDetailPageProps {
  params: Promise<{ id: string }>
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return '-'
  try {
    const date = new Date(isoString)
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export default function WebhookDetailPage({ params }: WebhookDetailPageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [webhook, setWebhook] = useState<Webhook | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  useEffect(() => {
    const fetchWebhook = async () => {
      try {
        const client = createAgentAPIProxyClientFromStorage()
        const webhookData = await client.getWebhook(resolvedParams.id)
        setWebhook(webhookData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load webhook')
      } finally {
        setIsLoading(false)
      }
    }

    fetchWebhook()
  }, [resolvedParams.id])

  const handleCopyWebhookUrl = async () => {
    if (webhook?.webhook_url) {
      try {
        await navigator.clipboard.writeText(webhook.webhook_url)
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } catch (err) {
        console.error('Failed to copy webhook URL:', err)
      }
    }
  }

  const handleCopySecret = async () => {
    if (webhook?.secret) {
      try {
        await navigator.clipboard.writeText(webhook.secret)
        setCopiedSecret(true)
        setTimeout(() => setCopiedSecret(false), 2000)
      } catch (err) {
        console.error('Failed to copy secret:', err)
      }
    }
  }

  const handleBack = () => {
    router.push('/webhooks')
  }

  if (isLoading) {
    return (
      <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
        <TopBar title="Webhook Details" showSettingsButton={true}>
          <div className="md:hidden">
            <NavigationTabs />
          </div>
        </TopBar>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <LoadingSpinner size="large" />
        </div>
      </main>
    )
  }

  if (error || !webhook) {
    return (
      <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
        <TopBar title="Webhook Details" showSettingsButton={true}>
          <div className="md:hidden">
            <NavigationTabs />
          </div>
        </TopBar>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Webhook not found'}</p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Back to Webhooks
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-900">
      <TopBar title="Webhook Details" showSettingsButton={true}>
        <div className="md:hidden">
          <NavigationTabs />
        </div>
      </TopBar>

      <div className="px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-6 md:pb-8 max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="mb-4 flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Webhooks
        </button>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {webhook.name}
                </h1>
                <div className="flex items-center gap-2">
                  <WebhookStatusBadge status={webhook.status} />
                  <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                    {webhook.type}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDateTime(webhook.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Updated</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDateTime(webhook.updated_at)}</p>
              </div>
              {webhook.delivery_count !== undefined && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Deliveries</p>
                  <p className="text-sm text-gray-900 dark:text-white">{webhook.delivery_count}</p>
                </div>
              )}
            </div>
          </div>

          {/* Webhook URL */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Webhook URL</h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded text-sm overflow-x-auto">
                {webhook.webhook_url}
              </code>
              <button
                onClick={handleCopyWebhookUrl}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm whitespace-nowrap"
              >
                {copiedUrl ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Secret */}
          {webhook.secret && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Secret</h2>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded text-sm overflow-x-auto">
                  {webhook.secret}
                </code>
                <button
                  onClick={handleCopySecret}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm whitespace-nowrap"
                >
                  {copiedSecret ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Triggers */}
          {webhook.triggers && webhook.triggers.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Triggers ({webhook.triggers.length})
              </h2>
              <div className="space-y-3">
                {webhook.triggers.map((trigger, index) => (
                  <div
                    key={trigger.id || index}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">{trigger.name}</h3>
                        {trigger.enabled !== undefined && (
                          <span className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
                            trigger.enabled
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
                          }`}>
                            {trigger.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        )}
                      </div>
                      {trigger.priority !== undefined && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Priority: {trigger.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trigger Test */}
          <WebhookTriggerTest webhook={webhook} />
        </div>
      </div>
    </main>
  )
}
