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
      const timer = setTimeout(() => {
        reject(new Error(`WS connect timeout (${this.connectTimeout}ms) to ${this.url}`));
        this.ws?.close();
      }, this.connectTimeout);

      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      this.ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };

      this.ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`WS connection failed: ${this.url}`));
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
        // Reject all pending calls
        this.pending.forEach(({ reject }) =>
          reject(new Error('WebSocket closed')),
        );
        this.pending.clear();
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
   */
  call<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket is not open'));
    }
    const id = ++this.idCounter;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
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
