/**
 * useACPWebSocket
 *
 * Tries to connect to the session's ACP WebSocket endpoint (via the Next.js
 * custom server proxy).  On success it performs the ACP handshake and starts
 * streaming messages.  On failure it falls back and retries with exponential
 * backoff.
 *
 * Session persistence is handled server-side (agentapi-proxy):
 *  - The proxy stores the ACP session ID in the Kubernetes Service annotation
 *    `agentapi.proxy/acp-session-id`.
 *  - On reconnect, the proxy transparently rewrites `session/new` to
 *    `session/resume` using the stored ID, so the agent retains its context.
 *  - The UI always sends `session/new` — no client-side session ID management.
 *
 * Message handling:
 *  - agent_message_chunk: chunks are accumulated into the current assistant
 *    message rather than added as new ones.
 *  - agent_thought_chunk: ignored (internal Claude thinking, not shown to user).
 *  - agent_message_end: marks the end of an assistant turn.
 *
 * Message display history is kept in sessionStorage (keyed by agentapi session ID)
 * so the UI shows previous messages while reconnecting.
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
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'closed';

export interface UseACPWebSocketResult {
  connectionState: ACPConnectionState;
  isConnecting: boolean;
  isConnected: boolean;
  connectionFailed: boolean;
  acpMessages: SessionMessage[];
  agentRunning: boolean;
  /** True if the agent supports queuing prompts while running (promptQueueing capability). */
  promptQueueing: boolean;
  sendPrompt: (text: string) => Promise<boolean>;
  /** Send session/cancel notification to interrupt the running agent. */
  cancelSession: () => void;
}

// ─── Internal ACP shapes ──────────────────────────────────────────────────────

interface ACPSessionResult {
  sessionId: string;
}

interface ACPContentBlock {
  type: string;
  text?: string;
}

interface ACPSessionUpdateParams {
  sessionId?: string;
  update?: {
    sessionUpdate?: string;
    content?: ACPContentBlock;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACP_CALL_TIMEOUT_MS = 15_000;
const INITIAL_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/** sessionStorage key for display history (NOT for ACP session ID). */
const MESSAGES_KEY_PREFIX = 'acp_messages_';

// ─── Storage helpers (display history only) ───────────────────────────────────

function loadMessages(sessionId: string): SessionMessage[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY_PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as SessionMessage[]) : [];
  } catch { return []; }
}

function saveMessages(sessionId: string, messages: SessionMessage[]): void {
  try {
    sessionStorage.setItem(MESSAGES_KEY_PREFIX + sessionId, JSON.stringify(messages));
  } catch { /* quota / private browsing */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useACPWebSocket(
  sessionId: string | null,
  connectTimeout = 5000,
): UseACPWebSocketResult {
  const [connectionState, setConnectionState] =
    useState<ACPConnectionState>('connecting');
  const [acpMessages, setAcpMessages] = useState<SessionMessage[]>(() =>
    sessionId ? loadMessages(sessionId) : [],
  );
  const [agentRunning, setAgentRunning] = useState(false);
  const [promptQueueing, setPromptQueueing] = useState(false);

  const clientRef = useRef<ACPWebSocketClient | null>(null);
  const acpSessionIdRef = useRef<string | null>(null);
  const msgIdRef = useRef(sessionId ? loadMessages(sessionId).length : 0);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── persist messages with every update ───────────────────────────────────
  const setAndPersistMessages = useCallback(
    (updater: (prev: SessionMessage[]) => SessionMessage[]) => {
      if (!sessionId) return;
      setAcpMessages((prev) => {
        const next = updater(prev);
        saveMessages(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  // ── single connection attempt ─────────────────────────────────────────────
  const attemptConnect = useCallback(async (
    sid: string,
    cancelledRef: { current: boolean },
  ) => {
    if (cancelledRef.current) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/${sid}/ws`;
    const client = new ACPWebSocketClient(wsUrl, connectTimeout);
    clientRef.current = client;

    client.onDisconnect = () => {
      if (cancelledRef.current) return;
      console.info('[ACP] WebSocket disconnected — reconnecting…');
      setConnectionState('connecting');
      acpSessionIdRef.current = null;
      scheduleReconnect(sid, cancelledRef);
    };

    try {
      await client.connect();
      if (cancelledRef.current) { client.close(); return; }

      // ACP handshake — capture agentCapabilities from the response
      const initResult = await client.call<{
        agentCapabilities?: {
          _meta?: { claudeCode?: { promptQueueing?: boolean } };
        };
      }>('initialize', {
        protocolVersion: 0,
        clientInfo: { name: 'agentapi-ui', version: '1.0.0' },
        clientCapabilities: {},
      }, ACP_CALL_TIMEOUT_MS);
      if (cancelledRef.current) { client.close(); return; }

      const supportsQueueing =
        initResult?.agentCapabilities?._meta?.claudeCode?.promptQueueing === true;
      setPromptQueueing(supportsQueueing);

      // Always send session/new — the proxy will transparently replace it
      // with session/resume if a previous ACP session ID is stored server-side.
      const { sessionId: acpSid } = await client.call<ACPSessionResult>('session/new', {
        cwd: '/',
        mcpServers: [],
      }, ACP_CALL_TIMEOUT_MS);
      if (cancelledRef.current) { client.close(); return; }

      acpSessionIdRef.current = acpSid;
      console.info(`[ACP] Session ready: ${acpSid}`);

      // Subscribe to session/update notifications
      client.onNotification((method, rawParams) => {
        if (method !== 'session/update') return;
        const params = rawParams as ACPSessionUpdateParams | undefined;
        const updateType = params?.update?.sessionUpdate;

        // Accumulate text chunks into the current assistant message
        if (updateType === 'agent_message_chunk') {
          const block = params?.update?.content;
          const text = block?.type === 'text' && block.text ? block.text : '';
          if (!text) return;

          setAndPersistMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: last.content + text }];
            }
            return [...prev, {
              id: ++msgIdRef.current,
              role: 'assistant',
              content: text,
              time: new Date().toISOString(),
            } satisfies SessionMessage];
          });
          return;
        }

        // Internal thinking — do NOT show to user
        if (updateType === 'agent_thought_chunk') return;

        // agent_message_end: standard ACP end signal (may not be sent by all agents)
        // usage_update: sent by claude-agent-acp at the end of each turn
        if (updateType === 'agent_message_end' || updateType === 'usage_update') {
          setAgentRunning(false);
        }
      });

      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
      setConnectionState('connected');
    } catch (err) {
      if (cancelledRef.current) return;
      console.info('[ACP] WebSocket/handshake failed — retrying:', err);
      setConnectionState('failed');
      scheduleReconnect(sid, cancelledRef);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectTimeout, setAndPersistMessages]);

  // ── exponential backoff reconnect ─────────────────────────────────────────
  const scheduleReconnect = useCallback((
    sid: string,
    cancelledRef: { current: boolean },
  ) => {
    if (cancelledRef.current) return;
    const delay = reconnectDelayRef.current;
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
    console.info(`[ACP] Reconnecting in ${delay}ms…`);
    reconnectTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current) attemptConnect(sid, cancelledRef);
    }, delay);
  }, [attemptConnect]);

  // ── mount / sessionId change ──────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const cancelledRef = { current: false };

    // Restore display history from sessionStorage
    const saved = loadMessages(sessionId);
    setAcpMessages(saved);
    msgIdRef.current = saved.length;

    setConnectionState('connecting');
    setAgentRunning(false);
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;

    attemptConnect(sessionId, cancelledRef);

    return () => {
      cancelledRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clientRef.current?.close();
      clientRef.current = null;
      acpSessionIdRef.current = null;
      setAgentRunning(false);
      setConnectionState('closed');
    };
  }, [sessionId, attemptConnect]);

  // ── cancel session (session/cancel notification) ──────────────────────────
  const cancelSession = useCallback(() => {
    const client = clientRef.current;
    const acpSid = acpSessionIdRef.current;
    if (!client?.isOpen || !acpSid) return;
    client.notify('session/cancel', { sessionId: acpSid });
    console.info('[ACP] Sent session/cancel for', acpSid);
  }, []);

  // ── send prompt ───────────────────────────────────────────────────────────
  const sendPrompt = useCallback(async (text: string): Promise<boolean> => {
    const client = clientRef.current;
    const acpSid = acpSessionIdRef.current;
    if (!client?.isOpen || !acpSid) return false;

    setAndPersistMessages((prev) => [
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
      // session/prompt resolves when the agent finishes processing the prompt.
      // claude-agent-acp does not emit agent_message_end, so we rely on the
      // RPC response to mark the end of the agent turn.
      setAgentRunning(false);
      return true;
    } catch (err) {
      console.error('[ACP] prompt failed:', err);
      setAgentRunning(false);
      return false;
    }
  }, [setAndPersistMessages]);

  return {
    connectionState,
    isConnecting: connectionState === 'connecting',
    isConnected: connectionState === 'connected',
    connectionFailed: connectionState === 'failed',
    acpMessages,
    agentRunning,
    promptQueueing,
    sendPrompt,
    cancelSession,
  };
}
