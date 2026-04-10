/**
 * useACPWebSocket
 *
 * Tries to connect to the session's ACP WebSocket endpoint (via the Next.js
 * custom server proxy).  On success it performs the ACP handshake and starts
 * streaming messages.  On failure it falls back and retries with exponential
 * backoff.
 *
 * Session persistence:
 *  - The ACP session ID (from session/new) is stored in sessionStorage keyed
 *    by the agentapi session ID.  On reconnect, session/resume is called instead
 *    of session/new, so the agent keeps its conversation context.
 *  - Messages are also persisted to sessionStorage so the UI shows history
 *    even while reconnecting.
 *
 * Message handling:
 *  - agent_message_chunk: chunks are accumulated into the current assistant
 *    message rather than added as new ones.
 *  - agent_thought_chunk: ignored (internal Claude thinking, not shown to user).
 *  - agent_message_end: marks the end of an assistant turn.
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
  connectionState: ACPConnectionState;
  isConnecting: boolean;
  isConnected: boolean;
  connectionFailed: boolean;
  acpMessages: SessionMessage[];
  agentRunning: boolean;
  sendPrompt: (text: string) => Promise<boolean>;
}

// ─── Internal ACP result shapes ───────────────────────────────────────────────

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

const MESSAGES_KEY_PREFIX = 'acp_messages_';
const ACP_SESSION_KEY_PREFIX = 'acp_sid_';

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadMessages(sessionId: string): SessionMessage[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY_PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as SessionMessage[]) : [];
  } catch { return []; }
}

function saveMessages(sessionId: string, messages: SessionMessage[]): void {
  try {
    sessionStorage.setItem(MESSAGES_KEY_PREFIX + sessionId, JSON.stringify(messages));
  } catch { /* quota / private browsing — ignore */ }
}

function loadAcpSid(sessionId: string): string | null {
  try {
    return sessionStorage.getItem(ACP_SESSION_KEY_PREFIX + sessionId);
  } catch { return null; }
}

function saveAcpSid(sessionId: string, acpSid: string): void {
  try {
    sessionStorage.setItem(ACP_SESSION_KEY_PREFIX + sessionId, acpSid);
  } catch { /* ignore */ }
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

  const clientRef = useRef<ACPWebSocketClient | null>(null);
  const acpSessionIdRef = useRef<string | null>(null);
  const msgIdRef = useRef(sessionId ? loadMessages(sessionId).length : 0);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── persist messages on every change ─────────────────────────────────────
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

  // ── connect & handshake ───────────────────────────────────────────────────
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

      await client.call('initialize', {
        protocolVersion: 0,
        clientInfo: { name: 'agentapi-ui', version: '1.0.0' },
        clientCapabilities: {},
      }, ACP_CALL_TIMEOUT_MS);
      if (cancelledRef.current) { client.close(); return; }

      // ── Resume or create session ─────────────────────────────────────────
      const savedAcpSid = loadAcpSid(sid);
      let acpSid: string;

      if (savedAcpSid) {
        try {
          // Try to resume the existing ACP session (keeps agent context / history)
          const result = await client.call<ACPSessionResult>('session/resume', {
            sessionId: savedAcpSid,
            cwd: '/',
          }, ACP_CALL_TIMEOUT_MS);
          acpSid = result.sessionId;
          console.info(`[ACP] Resumed session ${acpSid}`);
        } catch (err) {
          // Session may have been GC'd — fall back to new session
          console.warn('[ACP] session/resume failed, creating new session:', err);
          const result = await client.call<ACPSessionResult>('session/new', {
            cwd: '/',
            mcpServers: [],
          }, ACP_CALL_TIMEOUT_MS);
          acpSid = result.sessionId;
          console.info(`[ACP] New session ${acpSid} (resume failed)`);
          // Clear stale message history since we lost the ACP session
          saveAcpSid(sid, acpSid);
          saveMessages(sid, []);
          setAcpMessages([]);
          msgIdRef.current = 0;
        }
      } else {
        // First connect — create a brand new ACP session
        const result = await client.call<ACPSessionResult>('session/new', {
          cwd: '/',
          mcpServers: [],
        }, ACP_CALL_TIMEOUT_MS);
        acpSid = result.sessionId;
        console.info(`[ACP] New session ${acpSid}`);
      }

      if (cancelledRef.current) { client.close(); return; }
      acpSessionIdRef.current = acpSid;
      saveAcpSid(sid, acpSid);

      // ── Subscribe to session/update notifications ────────────────────────
      client.onNotification((method, rawParams) => {
        if (method !== 'session/update') return;
        const params = rawParams as ACPSessionUpdateParams | undefined;
        const updateType = params?.update?.sessionUpdate;

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

        // agent_thought_chunk → internal thinking, do NOT show
        if (updateType === 'agent_thought_chunk') return;

        if (updateType === 'agent_message_end') {
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

  // ── reconnect with backoff ────────────────────────────────────────────────
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

  // ── effect: mount / sessionId change ─────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const cancelledRef = { current: false };

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
    sendPrompt,
  };
}
