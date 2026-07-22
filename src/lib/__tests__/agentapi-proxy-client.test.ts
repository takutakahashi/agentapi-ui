import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentAPIProxyClient, AgentAPIProxyError } from '../agentapi-proxy-client';

describe('AgentAPIProxyClient ACP message history', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
});
