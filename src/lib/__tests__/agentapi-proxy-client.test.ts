import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentAPIProxyClient, AgentAPIProxyError } from '../agentapi-proxy-client';

describe('AgentAPIProxyClient ACP message history', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resumes a session only through the explicit resume endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ session_id: 'session-1', status: 'restoring' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const client = new AgentAPIProxyClient({ baseURL: 'http://proxy.example.test' });

    await expect(client.resumeSession('session-1')).resolves.toEqual({
      session_id: 'session-1',
      status: 'restoring',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://proxy.example.test/sessions/session-1/resume',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects when history cannot be fetched instead of returning an empty history', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('connection lost'));
    const client = new AgentAPIProxyClient({ baseURL: 'http://proxy.example.test' });

    await expect(client.getACPMessageHistory('session-1', 'acp-session-1')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'connection lost',
    } satisfies Partial<AgentAPIProxyError>);
  });

  it('sends text and image content blocks unchanged to an ACP session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const client = new AgentAPIProxyClient({ baseURL: 'http://proxy.example.test' });

    await client.sendACPPrompt(
      'session-1',
      'acp-session-1',
      [
        { type: 'text', text: 'What is in this image?' },
        { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' },
      ],
      42
    );

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      id: 42,
      method: 'session/prompt',
      params: {
        sessionId: 'acp-session-1',
        prompt: [
          { type: 'text', text: 'What is in this image?' },
          { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' },
        ],
      },
    });
  });

  it('restores ACP image output from message history', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        messages: [{
          jsonrpc: '2.0',
          method: 'session/update',
          params: {
            sessionId: 'acp-session-1',
            time: '2026-07-25T00:00:00Z',
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' },
            },
          },
        }],
        userPromptCount: 0,
        userPrompts: [],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const client = new AgentAPIProxyClient({ baseURL: 'http://proxy.example.test' });

    const history = await client.getACPMessageHistory('session-1', 'acp-session-1');

    expect(history.messages).toHaveLength(1);
    expect(history.messages[0].images).toEqual([
      { mimeType: 'image/png', data: 'iVBORw0KGgo=' },
    ]);
  });

  it('restores images nested in completed ACP tool results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        messages: [
          {
            jsonrpc: '2.0',
            method: 'session/update',
            params: {
              sessionId: 'acp-session-1',
              update: {
                sessionUpdate: 'tool_call',
                toolCallId: 'image-tool-1',
                kind: 'other',
                title: 'Generate image',
              },
            },
          },
          {
            jsonrpc: '2.0',
            method: 'session/update',
            params: {
              sessionId: 'acp-session-1',
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId: 'image-tool-1',
                status: 'completed',
                content: [{
                  type: 'content',
                  content: {
                    type: 'image',
                    mimeType: 'image/png',
                    data: 'generated-image-data',
                    uri: '/tmp/generated.png',
                  },
                }],
              },
            },
          },
        ],
        userPromptCount: 0,
        userPrompts: [],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = new AgentAPIProxyClient({ baseURL: 'http://proxy.example.test' });

    const history = await client.getACPMessageHistory('session-1', 'acp-session-1');
    const toolResult = history.messages.find(message => message.role === 'tool_result');

    expect(toolResult?.images).toEqual([
      { mimeType: 'image/png', data: 'generated-image-data' },
    ]);
  });
});
