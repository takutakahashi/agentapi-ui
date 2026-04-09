/**
 * Next.js custom server with WebSocket proxy support.
 *
 * Handles WebSocket upgrade requests for /:sessionId/* paths and proxies them
 * to the agentapi-proxy backend, injecting the Bearer token from the
 * encrypted agentapi_token cookie.
 *
 * All regular HTTP requests are forwarded to the standard Next.js handler.
 */

import { createServer } from 'http';
import { parse } from 'url';
import { createDecipheriv } from 'crypto';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

// ─── Configuration ────────────────────────────────────────────────────────────

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = parseInt(process.env.PORT ?? '3000', 10);

const PROXY_URL = process.env.AGENTAPI_PROXY_URL ?? 'http://localhost:8080';
// Convert http(s) → ws(s) for WebSocket connections to agentapi-proxy
const WS_PROXY_BASE = PROXY_URL.replace(/^http/, 'ws');

// ─── Cookie decryption (mirrors src/lib/cookie-auth.ts, no next/headers) ─────

const COOKIE_NAME = 'agentapi_token';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.COOKIE_ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error('COOKIE_ENCRYPTION_SECRET must be exactly 64 hex characters');
  }
  return Buffer.from(secret, 'hex');
}

function decryptApiKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    result[name] = value;
  }
  return result;
}

function getApiKeyFromRequest(req: IncomingMessage): string | null {
  try {
    const cookieHeader = req.headers.cookie ?? '';
    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    return decryptApiKey(token);
  } catch {
    return null;
  }
}

// ─── Next.js app ──────────────────────────────────────────────────────────────

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = parse(req.url!, true).pathname ?? '';

    // Match /:sessionId/<subpath> where sessionId looks like a UUID/identifier.
    // Excludes short/well-known paths like /_next, /api, /public, etc.
    const match = pathname.match(/^\/([a-zA-Z0-9_-]{8,})\/(.+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    const [, sessionId, subPath] = match;

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      // Authenticate via cookie
      const apiKey = getApiKeyFromRequest(req);
      if (!apiKey) {
        console.warn(`[WS] Unauthorized upgrade attempt for session ${sessionId}`);
        clientWs.close(4001, 'Unauthorized');
        return;
      }

      const targetUrl = `${WS_PROXY_BASE}/${sessionId}/${subPath}`;
      console.log(`[WS] Connecting ${sessionId}/${subPath} → ${targetUrl}`);

      // Connect to agentapi-proxy with Bearer auth
      const serverWs = new WebSocket(targetUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      serverWs.on('open', () => {
        // Bidirectional bridge
        clientWs.on('message', (data, isBinary) => {
          if (serverWs.readyState === WebSocket.OPEN) {
            serverWs.send(data, { binary: isBinary });
          }
        });

        serverWs.on('message', (data, isBinary) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
          }
        });
      });

      serverWs.on('error', (err) => {
        console.error(`[WS] Backend error for session ${sessionId}:`, err.message);
        if (clientWs.readyState !== WebSocket.CLOSED) {
          clientWs.close(1011, 'backend error');
        }
      });

      serverWs.on('close', (code, reason) => {
        if (clientWs.readyState !== WebSocket.CLOSED) {
          clientWs.close(code, reason);
        }
      });

      clientWs.on('error', (err) => {
        console.error(`[WS] Client error for session ${sessionId}:`, err.message);
        if (serverWs.readyState !== WebSocket.CLOSED) {
          serverWs.close();
        }
      });

      clientWs.on('close', () => {
        if (serverWs.readyState !== WebSocket.CLOSED) {
          serverWs.close();
        }
      });
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
