/**
 * Minimal JSON-RPC 2.0 client over the browser's native WebSocket API.
 *
 * Implements just enough of the ACP (Agent Communication Protocol) to:
 *  - connect to an acp-ws-server endpoint
 *  - perform the initialize / newSession handshake
 *  - send prompt requests
 *  - receive sessionUpdate notifications
 *
 * This runs in the browser; it does NOT depend on the `ws` npm package.
 */

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

type JsonRpcMessage = JsonRpcResponse | JsonRpcNotification;

type NotificationHandler = (method: string, params: unknown) => void;

/**
 * Low-level JSON-RPC 2.0 WebSocket client.
 */
export class ACPWebSocketClient {
  private ws: WebSocket | null = null;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private notificationHandlers: NotificationHandler[] = [];
  private idCounter = 0;

  /**
   * Called when the WebSocket closes after it was successfully opened.
   * Not called when the initial connect fails.
   */
  onDisconnect: (() => void) | null = null;

  constructor(
    private readonly url: string,
    /** Maximum milliseconds to wait for the 'open' event. */
    private readonly connectTimeout = 5000,
  ) {}

  /**
   * Open the WebSocket connection.
   * Resolves when the socket is open; rejects on error or timeout.
   */
  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Ensure the promise settles only once
      let settled = false;
      const settle = (fn: () => void) => {
        if (!settled) { settled = true; fn(); }
      };

      // Track whether the socket actually opened (used to distinguish
      // "closed before open" from "closed after open")
      let wasOpen = false;

      const timer = setTimeout(() => {
        settle(() => reject(new Error(`WS connect timeout (${this.connectTimeout}ms) to ${this.url}`)));
        this.ws?.close();
      }, this.connectTimeout);

      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        clearTimeout(timer);
        settle(() => reject(err instanceof Error ? err : new Error(String(err))));
        return;
      }

      this.ws.onopen = () => {
        wasOpen = true;
        clearTimeout(timer);
        settle(() => resolve());
      };

      this.ws.onerror = () => {
        clearTimeout(timer);
        settle(() => reject(new Error(`WS connection failed: ${this.url}`)));
      };

      this.ws.onmessage = (event: MessageEvent<string>) => {
        try {
          this.dispatch(JSON.parse(event.data) as JsonRpcMessage);
        } catch (e) {
          console.error('[ACP] Failed to parse WS message:', e);
        }
      };

      this.ws.onclose = () => {
        clearTimeout(timer);
        // If WS closed before onopen: reject the connect() promise
        settle(() => reject(new Error('WebSocket closed before open')));
        // Reject all in-flight calls
        this.pending.forEach(({ reject: r }) => r(new Error('WebSocket closed')));
        this.pending.clear();
        // Notify hook of unexpected disconnect after successful connect
        if (wasOpen) {
          this.onDisconnect?.();
        }
      };
    });
  }

  private dispatch(msg: JsonRpcMessage) {
    if ('id' in msg && msg.id !== undefined) {
      // Response to a call
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        const resp = msg as JsonRpcResponse;
        if (resp.error) {
          p.reject(new Error(resp.error.message));
        } else {
          p.resolve(resp.result);
        }
      }
    } else if ('method' in msg) {
      // Server-sent notification
      const notif = msg as JsonRpcNotification;
      this.notificationHandlers.forEach((h) => h(notif.method, notif.params));
    }
  }

  /**
   * Send a JSON-RPC request and await the response.
   * @param timeoutMs  Optional per-call timeout (ms). Defaults to no timeout.
   */
  call<T = unknown>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket is not open'));
    }
    const id = ++this.idCounter;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      if (timeoutMs) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`ACP call '${method}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.pending.set(id, {
        resolve: (v) => {
          if (timer) clearTimeout(timer);
          resolve(v as T);
        },
        reject: (e) => {
          if (timer) clearTimeout(timer);
          reject(e);
        },
      });
      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * Register a handler for JSON-RPC notifications (messages with no `id`).
   * Returns an unsubscribe function.
   */
  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.push(handler);
    return () => {
      this.notificationHandlers = this.notificationHandlers.filter(
        (h) => h !== handler,
      );
    };
  }

  /** Close the underlying WebSocket. */
  close() {
    this.ws?.close();
    this.ws = null;
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
