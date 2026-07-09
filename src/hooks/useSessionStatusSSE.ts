'use client'

import { useEffect, useRef, useCallback } from 'react'
import { mutate } from 'swr'
import { Session, SessionStatus } from '../types/agentapi'
import { AgentAPIProxyClient, createAgentAPIProxyClientFromStorage, ProxySessionStatusEvent } from '../lib/agentapi-proxy-client'

/**
 * Hook options
 */
interface UseSessionStatusSSEOptions {
  enabled?: boolean
  client?: AgentAPIProxyClient
  onStatusChange?: (event: ProxySessionStatusEvent) => void
  onConnectionChange?: (connected: boolean) => void
}

/**
 * Hook for subscribing to proxy-wide session status changes via SSE
 * 
 * This hook:
 * 1. Establishes an SSE connection to /sessions/status/stream
 * 2. Updates session status in SWR cache on status changes
 * 3. Handles reconnection automatically
 * 
 * @param options - Configuration options
 */
export function useSessionStatusSSE(options: UseSessionStatusSSEOptions = {}) {
  const { enabled = true, client, onStatusChange, onConnectionChange } = options
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const agentAPI = client || createAgentAPIProxyClientFromStorage()
    const eventSource = agentAPI.subscribeToSessionsStatusEvents((data) => {
      onStatusChange?.(data)

      mutate(
        (key) => Array.isArray(key) && key[0] === 'session-list',
        (currentData: Session[] | undefined) => {
          if (!currentData) return currentData

          return currentData.map(session =>
            session.session_id === data.session_id
              ? { ...session, status: data.status as SessionStatus, updated_at: data.timestamp }
              : session
          )
        },
        false
      )
    }, () => {
      console.error('[SSE] Session status stream error')
      onConnectionChange?.(false)

      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
      reconnectAttemptsRef.current++

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
        connect()
      }, delay)
    })
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('[SSE] Connected to session status stream')
      reconnectAttemptsRef.current = 0
      onConnectionChange?.(true)
    }

  }, [client, onStatusChange, onConnectionChange])

  useEffect(() => {
    if (!enabled) return

    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [enabled, connect])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  return { disconnect }
}

/**
 * Hook for long-polling message updates in a specific session
 * 
 * @param sessionId - The session ID to watch for message updates
 * @param options - Configuration options
 */
export function useSessionMessagePoll(
  sessionId: string | null,
  options: {
    enabled?: boolean
    onMessageUpdate?: (timestamp: string) => void
  } = {}
) {
  const { enabled = true, onMessageUpdate } = options
  const pollingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const poll = useCallback(async () => {
    if (!sessionId || !enabled || pollingRef.current) return

    const agentAPI = createAgentAPIProxyClientFromStorage()
    pollingRef.current = true

    try {
      abortControllerRef.current = new AbortController()
      
      const result = await agentAPI.waitSessionMessages(sessionId, {
        timeout: 30,
        signal: abortControllerRef.current.signal,
      })

      if (result.updated) {
        onMessageUpdate?.(result.timestamp)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Polling was cancelled, this is expected
        return
      }
      console.error('[LongPoll] Error waiting for message updates:', err)
    } finally {
      pollingRef.current = false
      // Continue polling
      if (enabled) {
        poll()
      }
    }
  }, [sessionId, enabled, onMessageUpdate])

  useEffect(() => {
    if (!enabled || !sessionId) return

    poll()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [enabled, sessionId, poll])

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    pollingRef.current = false
  }, [])

  return { stop }
}
