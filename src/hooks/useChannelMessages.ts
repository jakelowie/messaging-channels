import { useCallback, useEffect, useRef, useState } from 'react';
import { ChannelApiError } from '../services/channelApi';
import { listChannelMessages } from '../services/messageApi';
import type { ChannelRecord } from '../types/channel';
import type { ChannelMessage } from '../types/message';

export type ListMessagesFn = typeof listChannelMessages;

export type ChannelMessagesState =
  | { status: 'loading' }
  | { status: 'success'; messages: ChannelMessage[]; messagingUserId: string }
  | { status: 'error'; error: string }
  /** No member to list messages as, so the API was not called. */
  | { status: 'no-user' };

/** Max list-messages requests in flight at once, so a 1000-row page doesn't flood the API. */
export const MESSAGES_CONCURRENCY = 6;

/** Member the messages are listed as: the searched Messaging User ID, else the channel admin. */
export function messagingUserFor(record: ChannelRecord, searchMessagingUserId?: string): string | null {
  return searchMessagingUserId?.trim() || record.metadata?.Admin?.trim() || null;
}

/**
 * Fetches the first messages of every channel in `channels` as soon as the result set arrives
 * (MESSAGES_CONCURRENCY at a time), so each row knows whether its channel has messages.
 * A new result set aborts any requests still running for the previous one.
 */
export function useChannelMessages(
  channels: ChannelRecord[],
  searchMessagingUserId: string | undefined,
  listMessagesFn: ListMessagesFn = listChannelMessages,
) {
  const [states, setStates] = useState<Map<string, ChannelMessagesState>>(() => new Map());
  const controllerRef = useRef<AbortController | null>(null);

  const setOne = useCallback((arn: string, state: ChannelMessagesState) => {
    setStates((prev) => new Map(prev).set(arn, state));
  }, []);

  const load = useCallback(
    async (record: ChannelRecord, signal: AbortSignal) => {
      const arn = record.membership.ChannelSummary.ChannelArn;
      const messagingUserId = messagingUserFor(record, searchMessagingUserId);
      if (!messagingUserId) {
        setOne(arn, { status: 'no-user' });
        return;
      }
      setOne(arn, { status: 'loading' });
      try {
        const messages = await listMessagesFn({ channelArn: arn, messagingUserId }, { signal });
        if (!signal.aborted) setOne(arn, { status: 'success', messages, messagingUserId });
      } catch (err) {
        if (signal.aborted) return;
        const error = err instanceof ChannelApiError ? err.message : 'Something went wrong while loading messages.';
        setOne(arn, { status: 'error', error });
      }
    },
    [listMessagesFn, searchMessagingUserId, setOne],
  );

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const initial = new Map<string, ChannelMessagesState>();
    for (const c of channels) initial.set(c.membership.ChannelSummary.ChannelArn, { status: 'loading' });
    setStates(initial);

    const queue = [...channels];
    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        await load(queue.shift()!, controller.signal);
      }
    };
    void Promise.all(Array.from({ length: Math.min(MESSAGES_CONCURRENCY, queue.length) }, worker));

    return () => controller.abort();
  }, [channels, load]);

  const retry = useCallback(
    (record: ChannelRecord) => {
      const signal = controllerRef.current?.signal;
      if (signal && !signal.aborted) void load(record, signal);
    },
    [load],
  );

  return { states, retry };
}
