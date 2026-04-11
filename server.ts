/**
 * Production entry point with WebSocket proxy support.
 *
 * In production (NODE_ENV=production):
 *   - Starts the Next.js standalone server.js on an internal port (3001)
 *   - Creates our own HTTP server on PORT (3000) that:
 *       • Handles WebSocket upgrades for /:sessionId/* paths, proxying them
 *         to agentapi-proxy with the Bearer token from the encrypted cookie
 *       • Proxies all other HTTP requests to the internal Next.js server
 *
 * In development (NODE_ENV=development):
 *   - Uses next() factory directly (full Next.js with hot reload, webpack, etc.)
 *   - WebSocket handling is the same
 *
 * This split avoids the "Cannot find module next/dist/compiled/webpack/webpack"
 * error that occurs when next() is called inside a Next.js standalone output,
 * where webpack is stripped from node_modules.
 */

import { createServer, request as httpRequest } from 'http';
import { parse } from 'url';
import { createDecipheriv } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';

// ─── Configuration ────────────────────────────────────────────────────────────

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = parseInt(process.env.PORT ?? '3000', 10);

// Internal port for Next.js standalone server (production only)
const nextInternalPort = parseInt(process.env.NEXT_INTERNAL_PORT ?? '3001', 10);

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

// ─── WebSocket upgrade handler (shared between dev and prod) ─────────────────

function setupWebSocketProxy(
  server: ReturnType<typeof createServer>,
): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = parse(req.url!, true).pathname ?? '';

    // Match /:sessionId/<subpath> where sessionId is a UUID.
    // Using strict UUID format to avoid capturing Next.js routes.
    const match = pathname.match(/^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(.+)$/);
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
}

// ─── HTTP reverse proxy to Next.js standalone server (production) ─────────────

function proxyToNext(
  req: IncomingMessage,
  res: ServerResponse,
  targetPort: number,
): void {
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
  };

  const proxyReq = httpRequest(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode!, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[PROXY] Error forwarding to Next.js:', err.message);
    if (!res.headersSent) {
      res.writeHead(502);
    }
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq, { end: true });
}

// ─── HTTP proxy for session-scoped paths (/{sessionId}/messages, /reset, …) ───
//
// These paths are handled by the agentapi-proxy / session pod intercept server,
// not by Next.js.  We forward them to PROXY_URL with Bearer auth from the cookie.

// Only match UUID-format session IDs (e.g. 1cf95d33-6b6d-4c09-a8bf-fc9d8a18a6e6)
// to avoid accidentally capturing Next.js routes like /settings/personal, /webhooks/...
const SESSION_HTTP_RE = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(.+)$/;

function proxySessionHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey: string,
): void {
  const targetUrl = new URL(req.url!, PROXY_URL);
  const targetHost = targetUrl.hostname;
  const targetPort = parseInt(targetUrl.port || (targetUrl.protocol === 'https:' ? '443' : '80'), 10);

  const options = {
    hostname: targetHost,
    port: targetPort,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host,
      Authorization: `Bearer ${apiKey}`,
    },
  };

  const proxyReq = httpRequest(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode!, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[PROXY] Error forwarding session HTTP request:', err.message);
    if (!res.headersSent) res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq, { end: true });
}

// ─── Start ────────────────────────────────────────────────────────────────────

if (dev) {
  // ── Development: use next() factory (full Next.js with webpack, hot reload) ──
  const { default: next } = await import('next');
  const app = next({ dev: true, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((req, res) => {
    const pathname = parse(req.url!, true).pathname ?? '';
    // Session-scoped paths (/{sessionId}/messages, /reset, etc.) go to agentapi-proxy.
    if (SESSION_HTTP_RE.test(pathname)) {
      const apiKey = getApiKeyFromRequest(req);
      if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      proxySessionHttpRequest(req, res, apiKey);
      return;
    }
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  setupWebSocketProxy(server);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
} else {
  // ── Production: spawn standalone server.js on internal port, proxy HTTP ──────
  //
  // The standalone output strips webpack from node_modules/next, so we cannot
  // call next() here.  Instead we start server.js (the standalone entry point)
  // on an internal port and proxy HTTP to it, while handling WS upgrades ourselves.

  // Start the standalone Next.js server
  const nextProc = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(nextInternalPort),
      HOSTNAME: '127.0.0.1',
    },
    stdio: 'inherit',
  });

  nextProc.on('error', (err) => {
    console.error('[NEXT] Failed to start standalone server:', err);
    process.exit(1);
  });

  nextProc.on('exit', (code) => {
    console.error(`[NEXT] Standalone server exited with code ${code}`);
    process.exit(code ?? 1);
  });

  // Wait for Next.js to be ready (max 30s)
  console.log(`[BOOT] Waiting for Next.js on port ${nextInternalPort}…`);
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${nextInternalPort}/`);
      await res.body?.cancel();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  console.log(`[BOOT] Next.js is ready`);

  // Create our HTTP server that proxies to Next.js (or agentapi-proxy for session paths)
  const server = createServer((req, res) => {
    const pathname = parse(req.url!, true).pathname ?? '';
    // Session-scoped paths (/{sessionId}/messages, /reset, etc.) go to agentapi-proxy.
    if (SESSION_HTTP_RE.test(pathname)) {
      const apiKey = getApiKeyFromRequest(req);
      if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      proxySessionHttpRequest(req, res, apiKey);
      return;
    }
    proxyToNext(req, res, nextInternalPort);
  });

  setupWebSocketProxy(server);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}
