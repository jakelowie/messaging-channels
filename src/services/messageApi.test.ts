import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeMessage } from '../test/fixtures';
import { ChannelApiError } from './channelApi';
import { listChannelMessages, MESSAGE_PREVIEW_LIMIT } from './messageApi';

const request = { channelArn: 'arn:aws:chime:us-east-1:1:app-instance/a/channel/c1', messagingUserId: 'user-1' };

describe('listChannelMessages', () => {
  it('POSTs channelArn and messagingUserId to the list-messages endpoint without credentials', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ Messages: [], NextToken: null }));
    await listChannelMessages(request, { fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/channel/list-messages');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(JSON.parse(init?.body as string)).toEqual(request);
  });

  it(`returns only the first ${MESSAGE_PREVIEW_LIMIT} messages, in API order`, async () => {
    const messages = Array.from({ length: 15 }, (_, i) => makeMessage({ MessageId: `m-${i}` }));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ Messages: messages, NextToken: 'x' }));
    const result = await listChannelMessages(request, { fetchImpl });
    expect(result.map((m) => m.MessageId)).toEqual(messages.slice(0, 10).map((m) => m.MessageId));
  });

  it('returns an empty array when Messages is null', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ Messages: null, NextToken: null }));
    expect(await listChannelMessages(request, { fetchImpl })).toEqual([]);
  });

  it('throws a friendly ChannelApiError on HTTP errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'internal detail' }, 401));
    const err = await listChannelMessages(request, { fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChannelApiError);
    expect((err as ChannelApiError).status).toBe(401);
    expect((err as ChannelApiError).message).not.toContain('internal detail');
  });

  it('throws a ChannelApiError when the network fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listChannelMessages(request, { fetchImpl })).rejects.toBeInstanceOf(ChannelApiError);
  });
});
