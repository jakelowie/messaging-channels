import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeMembership } from '../test/fixtures';
import { buildSearchQuery, ChannelApiError, parseChannelMetadata, searchChannels } from './channelApi';

describe('buildSearchQuery', () => {
  it('omits empty values, trims strings, serializes booleans/numbers and sorts keys', () => {
    const qs = buildSearchQuery({
      jobId: ' JOB-1 ',
      candidateId: '',
      videoInterview: false,
      size: 50,
      from: 0,
      messagingUserId: undefined,
    });
    expect(qs).toBe('from=0&jobId=JOB-1&size=50&videoInterview=false');
  });

  it('produces the same string regardless of key order', () => {
    expect(buildSearchQuery({ jobId: 'a', candidateId: 'b' })).toBe(buildSearchQuery({ candidateId: 'b', jobId: 'a' }));
  });
});

describe('parseChannelMetadata', () => {
  it('returns null for empty or invalid JSON', () => {
    expect(parseChannelMetadata('')).toBeNull();
    expect(parseChannelMetadata('{not json')).toBeNull();
  });
});

describe('searchChannels', () => {
  it('calls GET /api/search/channels with query params and decodes Metadata', async () => {
    const membership = makeMembership({ name: 'Alpha' });
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ChannelMemberships: [membership] }));

    const result = await searchChannels({ candidateId: 'CAND-200', jobId: 'JOB-100', size: 25, from: 0 }, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/search/channels?candidateId=CAND-200&from=0&jobId=JOB-100&size=25');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('omit');
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0].metadata?.CandidateId).toBe('CAND-200');
    expect(result.channels[0].membership.ChannelSummary.Name).toBe('Alpha');
  });

  it('treats ChannelMemberships: null as an empty result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ChannelMemberships: null }));
    const result = await searchChannels({ jobId: 'x' }, { fetchImpl });
    expect(result.channels).toEqual([]);
  });

  it('keeps a record with undecodable Metadata', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ChannelMemberships: [makeMembership({ metadata: 'oops' })] }));
    const result = await searchChannels({ jobId: 'x' }, { fetchImpl });
    expect(result.channels[0].metadata).toBeNull();
  });

  it('maps 401 to a friendly message without exposing the backend body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'Invalid Token', message: 'kms internal detail' }, 401));
    const err = await searchChannels({ jobId: 'x' }, { fetchImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(ChannelApiError);
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/credentials/i);
    expect(err.message).not.toMatch(/kms/i);
  });

  it('maps a bare 500 (e.g. past the result window) to a friendly message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    await expect(searchChannels({ jobId: 'x' }, { fetchImpl })).rejects.toThrow(/failed to run this search/i);
  });

  it('reports network failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(searchChannels({ jobId: 'x' }, { fetchImpl })).rejects.toThrow(/could not reach/i);
  });

  it('rethrows aborts untouched', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(searchChannels({ jobId: 'x' }, { fetchImpl })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
