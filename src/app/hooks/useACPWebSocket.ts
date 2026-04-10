/**
 * useACPWebSocket
 *
 * Tries to connect to the session's ACP WebSocket endpoint (via the Next.js
 * custom server proxy).  On success it performs the ACP handshake and starts
 * streaming messages.  On failure it falls back and retries with exponential
 * backoff.
 *
 * Connection path:
 *   Browser
 *     → ws://host/<sessionId>/ws   (Next.js custom server)
 *     → ws://agentapi-proxy/<sessionId>/ws   (Bearer-authenticated)
 *     → ws://{session.Addr()}/ws   (acp-ws-server inside session pod)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ACPWebSocketClient } from '../../lib/acp-client';
import type { SessionMessage } from '../../types/agentapi';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ACPConnectionState =
  | 'connecting'  // initial — waiting for verdict
  | 'connected'   // WS + ACP handshake succeeded
  | 'failed'      // WS or handshake failed → retrying
  | 'closed';     // component unmounted / session changed

export interface UseACPWebSocketResult {
  /** Current connection state */
  connectionState: ACPConnectionState;
  /** True while the first connection attempt is still in progress */
  isConnecting: boolean;
  /** True once WS + ACP handshake succeeded */
  isConnected: boolean;
  /** True when WS failed → caller may show error, but hook will retry */
  connectionFailed: boolean;
  /** Messages received via ACP sessionUpdate notifications */
  acpMessages: SessionMessage[];
  /** True while the agent is processing a prompt */
  agentRunning: boolean;
  /** Send a user prompt via the ACP 'prompt' method */
  sendPrompt: (text: string) => Promise<boolean>;
}

// ─── Internal ACP result shapes ───────────────────────────────────────────────

interface ACPNewSessionResult {
  sessionId: string;
}

interface ACPContentBlock {
  type: string;
  text?: string;
}

interface ACPSessionUpdateParams {
  sessionId?: string;
  update?: {
    /** Discriminant: "agent_message_chunk" | "tool_call" | ... */
    sessionUpdate?: string;
    /** Single ContentBlock (not an array) for *_message_chunk updates */
    content?: ACPContentBlock;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Timeout for each individual ACP RPC call (initialize / session/new). */
const ACP_CALL_TIMEOUT_MS = 15_000;

/** Initial reconnect delay; doubles on each failure, capped at MAX_RECONNECT_DELAY_MS. */
const INITIAL_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * ACP WebSocket connection hook with automatic reconnection.
 *
 * @param sessionId  agentapi session ID (UUID string), or null when unknown.
 * @param connectTimeout  ms to wait for the WebSocket 'open' event (default 5 s).
 */
export function useACPWebSocket(
  sessionId: string | null,
  connectTimeout = 5000,
): UseACPWebSocketResult {
  const [connectionState, setConnectionState] =
    useState<ACPConnectionState>('connecting');
  const [acpMessages, setAcpMessages] = useState<SessionMessage[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);

  const clientRef = useRef<ACPWebSocketClient | null>(null);
  const acpSessionIdRef = useRef<string | null>(null);
  const msgIdRef = useRef(0);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Connect & handshake (single attempt) ─────────────────────────────────
  const attemptConnect = useCallback(async (
    sessionId: string,
    cancelledRef: { current: boolean },
  ) => {
    if (cancelledRef.current) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/${sessionId}/ws`;

    const client = new ACPWebSocketClient(wsUrl, connectTimeout);
    clientRef.current = client;

    // When the server closes the WS after a successful handshake, reconnect
    client.onDisconnect = () => {
      if (cancelledRef.current) return;
      console.info('[ACP] WebSocket disconnected — reconnecting…');
      setConnectionState('connecting');
      acpSessionIdRef.current = null;
      scheduleReconnect(sessionId, cancelledRef);
    };

    try {
      // 1. TCP + WebSocket handshake
      await client.connect();
      if (cancelledRef.current) { client.close(); return; }

      // 2. ACP initialize
      await client.call('initialize', {
        protocolVersion: 0,
        clientInfo: { name: 'agentapi-ui', version: '1.0.0' },
        clientCapabilities: {},
      }, ACP_CALL_TIMEOUT_MS);
      if (cancelledRef.current) { client.close(); return; }

      // 3. ACP session/new
      const { sessionId: acpSid } =
        await client.call<ACPNewSessionResult>('session/new', {
          cwd: '/',
          mcpServers: [],
        }, ACP_CALL_TIMEOUT_MS);
      if (cancelledRef.current) { client.close(); return; }

      acpSessionIdRef.current = acpSid;

      // 4. Subscribe to session/update notifications
      client.onNotification((method, rawParams) => {
        if (method !== 'session/update') return;

        const params = rawParams as ACPSessionUpdateParams | undefined;
        const updateType = params?.update?.sessionUpdate;

        if (
          updateType === 'agent_message_chunk' ||
          updateType === 'agent_thought_chunk'
        ) {
          const block = params?.update?.content;
          const text =
            block?.type === 'text' && block.text ? block.text : '';
          if (text) {
            setAcpMessages((prev) => [
              ...prev,
              {
                id: ++msgIdRef.current,
                role: 'assistant',
                content: text,
                time: new Date().toISOString(),
              } satisfies SessionMessage,
            ]);
          }
        }
      });

      // Reset backoff on successful connect
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
      setConnectionState('connected');
    } catch (err) {
      if (cancelledRef.current) return;
      console.info('[ACP] WebSocket/handshake failed — retrying:', err);
      setConnectionState('failed');
      scheduleReconnect(sessionId, cancelledRef);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectTimeout]);

  // ── Reconnect with backoff ────────────────────────────────────────────────
  const scheduleReconnect = useCallback((
    sessionId: string,
    cancelledRef: { current: boolean },
  ) => {
    if (cancelledRef.current) return;
    const delay = reconnectDelayRef.current;
    // Exponential backoff
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
    console.info(`[ACP] Reconnecting in ${delay}ms…`);
    reconnectTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current) {
        attemptConnect(sessionId, cancelledRef);
      }
    }, delay);
  }, [attemptConnect]);

  // ── Effect: mount/unmount or sessionId change ─────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    mountedRef.current = true;
    const cancelledRef = { current: false };

    // Reset state for the new session
    setConnectionState('connecting');
    setAcpMessages([]);
    setAgentRunning(false);
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;

    attemptConnect(sessionId, cancelledRef);

    return () => {
      cancelledRef.current = true;
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clientRef.current?.close();
      clientRef.current = null;
      acpSessionIdRef.current = null;
      setAcpMessages([]);
      setAgentRunning(false);
      setConnectionState('closed');
    };
  }, [sessionId, attemptConnect]);

  // ── Send prompt ───────────────────────────────────────────────────────────
  const sendPrompt = useCallback(async (text: string): Promise<boolean> => {
    const client = clientRef.current;
    const acpSid = acpSessionIdRef.current;
    if (!client?.isOpen || !acpSid) return false;

    // Optimistically add user message
    setAcpMessages((prev) => [
      ...prev,
      {
        id: ++msgIdRef.current,
        role: 'user',
        content: text,
        time: new Date().toISOString(),
      } satisfies SessionMessage,
    ]);
    setAgentRunning(true);

    try {
      await client.call('session/prompt', {
        sessionId: acpSid,
        prompt: [{ type: 'text', text }],
      });
      setAgentRunning(false);
      return true;
    } catch (err) {
      console.error('[ACP] prompt failed:', err);
      setAgentRunning(false);
      return false;
    }
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    connectionState,
    isConnecting: connectionState === 'connecting',
    isConnected: connectionState === 'connected',
    connectionFailed: connectionState === 'failed',
    acpMessages,
    agentRunning,
    sendPrompt,
  };
}
