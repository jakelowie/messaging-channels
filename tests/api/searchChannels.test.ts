// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../api/search/channels';

const ORIGINAL_ENV = { ...process.env };

describe('api/search/channels (Vercel function)', () => {
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

  it('forwards the query string with the server-side token and no browser credentials', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"ChannelMemberships":null}', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );

    const response = await GET(
      new Request('https://app.example.test/api/search/channels?jobId=42&size=50', {
        headers: { Authorization: 'browser-supplied', Cookie: 'session=abc' },
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://messaging.example.test/api/search/channels?jobId=42&size=50');
    expect(init?.headers).toEqual({ Authorization: 'secret-token', Accept: 'application/json' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ChannelMemberships: null });
  });

  it('passes upstream error statuses through', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"Invalid Token"}', { status: 401 }));
    const response = await GET(new Request('https://app.example.test/api/search/channels?name=x'));
    expect(response.status).toBe(401);
  });

  it('returns 500 without calling upstream when configuration is missing', async () => {
    delete process.env.MESSAGING_API_TOKEN;
    const response = await GET(new Request('https://app.example.test/api/search/channels?name=x'));
    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the upstream is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const response = await GET(new Request('https://app.example.test/api/search/channels?name=x'));
    expect(response.status).toBe(502);
    expect(await response.text()).toBe('');
  });
});
