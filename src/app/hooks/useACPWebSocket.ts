/**
 * useACPWebSocket
 *
 * Tries to connect to the session's ACP WebSocket endpoint (via the Next.js
 * custom server proxy).  On success it performs the ACP handshake and starts
 * streaming messages.  On failure it sets `connectionFailed = true` so the
 * caller can transparently fall back to HTTP polling.
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
  | 'failed'      // WS or handshake failed → caller should fall back
  | 'closed';     // component unmounted / session changed

export interface UseACPWebSocketResult {
  /** Current connection state */
  connectionState: ACPConnectionState;
  /** True while the first connection attempt is still in progress */
  isConnecting: boolean;
  /** True once WS + ACP handshake succeeded */
  isConnected: boolean;
  /** True when WS failed → caller should fall back to HTTP polling */
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
  sessionStatus?: string;
  update?: {
    content?: ACPContentBlock[];
    [key: string]: unknown;
  };
  content?: ACPContentBlock[];
  [key: string]: unknown;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * ACP WebSocket connection hook.
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

  // ── Connect & handshake ───────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/${sessionId}/ws`;

    const client = new ACPWebSocketClient(wsUrl, connectTimeout);
    clientRef.current = client;

    let cancelled = false;

    (async () => {
      try {
        // 1. TCP + WebSocket handshake
        await client.connect();
        if (cancelled) return;

        // 2. ACP initialize
        await client.call('initialize', {
          protocolVersion: 0,
          clientInfo: { name: 'agentapi-ui', version: '1.0.0' },
          clientCapabilities: {},
        });
        if (cancelled) return;

        // 3. ACP newSession
        const { sessionId: acpSid } =
          await client.call<ACPNewSessionResult>('newSession', {
            cwd: '/',
            mcpServers: [],
          });
        if (cancelled) return;

        acpSessionIdRef.current = acpSid;

        // 4. Subscribe to sessionUpdate notifications
        client.onNotification((method, rawParams) => {
          if (
            method !== 'notifications/sessionUpdate' &&
            method !== 'sessionUpdate'
          )
            return;

          const params = rawParams as ACPSessionUpdateParams | undefined;

          // Extract text content from the update
          const blocks: ACPContentBlock[] =
            params?.update?.content ?? params?.content ?? [];
          const text = blocks
            .filter((b) => b.type === 'text' && b.text)
            .map((b) => b.text as string)
            .join('');

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

          // Track agent running state
          const status = params?.sessionStatus;
          if (status !== undefined) {
            setAgentRunning(status === 'running');
          }
        });

        setConnectionState('connected');
      } catch (err) {
        if (!cancelled) {
          console.info(
            '[ACP] WebSocket/handshake failed — falling back to polling:',
            err,
          );
          setConnectionState('failed');
        }
      }
    })();

    return () => {
      cancelled = true;
      client.close();
      clientRef.current = null;
      acpSessionIdRef.current = null;
      setAcpMessages([]);
      setAgentRunning(false);
      setConnectionState('closed');
    };
  }, [sessionId, connectTimeout]);

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
      await client.call('prompt', {
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
    connectionFailed: connectionState === 'failed' || connectionState === 'closed',
    acpMessages,
    agentRunning,
    sendPrompt,
  };
}
