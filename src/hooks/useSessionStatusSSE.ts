'use client'

import { useEffect, useRef, useCallback } from 'react'
import useSWR, { mutate } from 'swr'
import { Session, SessionStatus } from '../types/agentapi'
import { createAgentAPIProxyClientFromStorage } from '../lib/agentapi-proxy-client'
import { SESSION_LIST_MUTATION_KEY } from './useSessionList'

/**
 * SSE event for proxy-wide session status changes
 */
export interface ProxySessionStatusEvent {
  session_id: string
  status: string
  timestamp: string
}

/**
 * Hook options
 */
interface UseSessionStatusSSEOptions {
  enabled?: boolean
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
  const { enabled = true, onStatusChange, onConnectionChange } = options
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const isUsingProxy = typeof window !== 'undefined' && window.location.pathname.includes('/api/proxy')
    const eventSourceUrl = isUsingProxy
      ? '/api/proxy/sessions/status/stream'
      : '/sessions/status/stream'

    const eventSource = new EventSource(eventSourceUrl)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('[SSE] Connected to session status stream')
      reconnectAttemptsRef.current = 0
      onConnectionChange?.(true)
    }

    eventSource.onmessage = (event) => {
      if (!event.data) return

      try {
        const data: ProxySessionStatusEvent = JSON.parse(event.data)
        
        // Call custom handler if provided
        onStatusChange?.(data)

        // Optimistically update the session in SWR cache
        mutate(
          (key) => Array.isArray(key) && key[0] === 'session-list',
          (currentData: Session[] | undefined) => {
            if (!currentData) return currentData
            
            const updatedData = currentData.map(session =>
              session.session_id === data.session_id
                ? { ...session, status: data.status as SessionStatus, updated_at: data.timestamp }
                : session
            )
            
            return updatedData
          },
          false // Don't revalidate - we trust the SSE event
        )
      } catch (err) {
        console.error('[SSE] Failed to parse session status event:', err)
      }
    }

    eventSource.onerror = () => {
      console.error('[SSE] Session status stream error')
      onConnectionChange?.(false)

      // Exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
      reconnectAttemptsRef.current++

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
        connect()
      }, delay)
    }
  }, [onStatusChange, onConnectionChange])

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