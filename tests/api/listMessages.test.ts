// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../api/channel/list-messages';

const ORIGINAL_ENV = { ...process.env };

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://app.example.test/api/channel/list-messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('api/channel/list-messages (Vercel function)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    process.env.MESSAGING_API_URL = 'https://messaging.example.test/';
    process.env.MESSAGING_API_TOKEN = 'secret-token';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('forwards only channelArn and messagingUserId with the server-side token', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"Messages":null,"NextToken":null}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const response = await POST(
      post({ channelArn: 'arn:1', messagingUserId: 'user-1', extra: 'dropped' }, { Authorization: 'browser', Cookie: 'a=b' }),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://messaging.example.test/api/channel/list-messages');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: 'secret-token',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init?.body as string)).toEqual({ channelArn: 'arn:1', messagingUserId: 'user-1' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ Messages: null, NextToken: null });
  });

  it.each([['not json'], [{ channelArn: 'arn:1' }], [{ channelArn: 'arn:1', messagingUserId: 5 }], [{ channelArn: ' ', messagingUserId: 'u' }]])(
    'returns 400 without calling upstream for an invalid body (%j)',
    async (body) => {
      const response = await POST(post(body));
      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('returns 500 when configuration is missing', async () => {
    delete process.env.MESSAGING_API_URL;
    const response = await POST(post({ channelArn: 'arn:1', messagingUserId: 'u' }));
    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the upstream is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const response = await POST(post({ channelArn: 'arn:1', messagingUserId: 'u' }));
    expect(response.status).toBe(502);
  });
});
