import { API_BASE_PATH } from '../config';
import type { ChannelMessage, ListMessagesRequest, ListMessagesResponse } from '../types/message';
import { ChannelApiError } from './channelApi';

/** How many messages the UI shows per channel. */
export const MESSAGE_PREVIEW_LIMIT = 10;

export interface ListMessagesOptions {
  signal?: AbortSignal;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

function friendlyMessage(status: number): string {
  if (status === 401) return 'The messaging API rejected the credentials. Check MESSAGING_API_TOKEN for this environment.';
  if (status === 403) return 'You are not allowed to read messages for this channel.';
  if (status === 400) return 'The messaging API rejected the request. The messaging user may not be a member of this channel.';
  if (status === 404) return 'The list-messages endpoint was not found. Check MESSAGING_API_URL.';
  if (status === 502 || status === 503 || status === 504)
    return 'The messaging API is unavailable or did not respond in time. Try again shortly.';
  return `Loading messages failed (HTTP ${status}).`;
}

/**
 * Calls POST {API_BASE_PATH}/channel/list-messages and returns the first
 * MESSAGE_PREVIEW_LIMIT messages, in the order the API returns them.
 * An empty array means the channel has no messages (the API returns Messages: null).
 */
export async function listChannelMessages(
  request: ListMessagesRequest,
  { signal, fetchImpl = fetch }: ListMessagesOptions = {},
): Promise<ChannelMessage[]> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE_PATH}/channel/list-messages`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      // The proxy adds Authorization; never send browser cookies to the API.
      credentials: 'omit',
      body: JSON.stringify({ channelArn: request.channelArn, messagingUserId: request.messagingUserId }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ChannelApiError('Could not reach the messaging API. Check your network/VPN and that the dev server proxy is running.', null);
  }

  if (!response.ok) {
    throw new ChannelApiError(friendlyMessage(response.status), response.status);
  }

  let body: ListMessagesResponse;
  try {
    body = (await response.json()) as ListMessagesResponse;
  } catch {
    throw new ChannelApiError('The messaging API returned a response that could not be read.', response.status);
  }

  const messages = Array.isArray(body?.Messages) ? body.Messages : [];
  return messages.slice(0, MESSAGE_PREVIEW_LIMIT);
}
