import type { ChannelMessagesState } from '../hooks/useChannelMessages';
import { MESSAGE_PREVIEW_LIMIT } from '../services/messageApi';
import { formatTimestamp } from '../utils/format';

export type { ListMessagesFn } from '../hooks/useChannelMessages';

export const NO_MESSAGES_TEXT = 'NO MESSAGES FOR THIS CHANNEL YET';

interface ChannelMessagesProps {
  state: ChannelMessagesState;
  onRetry: () => void;
}

/** Renders the already-fetched messages for one channel (fetching lives in useChannelMessages). */
export function ChannelMessages({ state, onRetry }: ChannelMessagesProps) {
  if (state.status === 'no-user') {
    return (
      <p className="messages__notice" role="note">
        Can't load messages: this channel has no admin in its Metadata. Search with a Messaging User ID to list messages
        as that member.
      </p>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="loading" role="status" aria-live="polite">
        <span className="loading__spinner" aria-hidden="true" />
        <span>Loading messages…</span>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="error-message" role="alert">
        <strong>Loading messages failed.</strong> <span>{state.error}</span>
        <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  const { messages, messagingUserId } = state;
  if (messages.length === 0) {
    return (
      <p className="messages__empty" role="status">
        {NO_MESSAGES_TEXT}
      </p>
    );
  }

  return (
    <div className="messages">
      <p className="messages__caption">
        {messages.length < MESSAGE_PREVIEW_LIMIT
          ? `${messages.length} message${messages.length === 1 ? '' : 's'}`
          : `First ${MESSAGE_PREVIEW_LIMIT} messages`}{' '}
        <span className="mono">(listed as {messagingUserId})</span>
      </p>
      <ol className="messages__list">
        {messages.map((m) => (
          <li key={m.MessageId} className="messages__item">
            <div className="messages__meta">
              <strong className="messages__sender" title={m.Sender?.Arn}>
                {m.Sender?.Name || 'Unknown sender'}
              </strong>
              <time dateTime={m.CreatedTimestamp}>{formatTimestamp(m.CreatedTimestamp)}</time>
            </div>
            <p className="messages__content">
              {m.Redacted ? <em>Message redacted</em> : m.Content || <em>(empty message)</em>}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
