import { API_BASE_PATH } from '../config';
import type {
  ChannelMetadata,
  ChannelRecord,
  SearchChannelsParams,
  SearchChannelsResponse,
  SearchChannelsResult,
} from '../types/channel';

/** Error thrown for any failed search. `message` is always safe to show to users. */
export class ChannelApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'ChannelApiError';
    this.status = status;
  }
}

/**
 * Serializes params into the query string the Go handler reads (c.Query / c.DefaultQuery).
 * Empty strings and undefined values are omitted, so the API applies no filter for them.
 * Keys are sorted so identical searches produce identical strings (used for de-duplication).
 */
export function buildSearchQuery(params: SearchChannelsParams): string {
  const qs = new URLSearchParams();
  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) qs.set(key, trimmed);
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      qs.set(key, String(value));
    }
  }
  return qs.toString();
}

/** Decodes ChannelSummary.Metadata. Returns null rather than throwing on bad data. */
export function parseChannelMetadata(metadata: string | undefined | null): ChannelMetadata | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' ? (parsed as ChannelMetadata) : null;
  } catch {
    return null;
  }
}

function friendlyMessage(status: number): string {
  if (status === 401) return 'The messaging API rejected the credentials. Check MESSAGING_API_TOKEN for this environment.';
  if (status === 403) return 'You are not allowed to perform this search.';
  if (status === 404) return 'The search endpoint was not found. Check MESSAGING_API_URL.';
  if (status === 400) return 'The messaging API rejected the search. Check the filter values and try again.';
  if (status === 502 || status === 503 || status === 504)
    return 'The messaging API is unavailable or did not respond in time. Try again shortly.';
  if (status >= 500)
    return 'The messaging API failed to run this search. This can happen when paging past 10,000 results or when the search index is unavailable.';
  return `The search failed (HTTP ${status}).`;
}

export interface SearchOptions {
  signal?: AbortSignal;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Calls GET {API_BASE_PATH}/search/channels.
 * Backend error bodies are intentionally not surfaced: they can contain internal details.
 */
export async function searchChannels(
  params: SearchChannelsParams,
  { signal, fetchImpl = fetch }: SearchOptions = {},
): Promise<SearchChannelsResult> {
  const query = buildSearchQuery(params);
  const url = `${API_BASE_PATH}/search/channels${query ? `?${query}` : ''}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // The proxy adds Authorization; never send browser cookies to the API.
      credentials: 'omit',
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ChannelApiError('Could not reach the messaging API. Check your network/VPN and that the dev server proxy is running.', null);
  }

  if (!response.ok) {
    throw new ChannelApiError(friendlyMessage(response.status), response.status);
  }

  let body: SearchChannelsResponse;
  try {
    body = (await response.json()) as SearchChannelsResponse;
  } catch {
    throw new ChannelApiError('The messaging API returned a response that could not be read.', response.status);
  }

  const memberships = Array.isArray(body?.ChannelMemberships) ? body.ChannelMemberships : [];
  const channels: ChannelRecord[] = memberships.map((membership) => ({
    membership,
    metadata: parseChannelMetadata(membership?.ChannelSummary?.Metadata),
  }));

  return { channels, raw: body ?? { ChannelMemberships: null } };
}
