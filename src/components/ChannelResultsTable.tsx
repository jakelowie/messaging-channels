import { Fragment, useEffect, useState } from 'react';
import { useChannelMessages, type ChannelMessagesState, type ListMessagesFn } from '../hooks/useChannelMessages';
import type { ChannelRecord } from '../types/channel';
import { channelIdFromArn, displayValue, formatTimestamp } from '../utils/format';
import { ChannelMessages, NO_MESSAGES_TEXT } from './ChannelMessages';

const COLUMN_COUNT = 9;

/** How the Messages button looks for a channel's fetch state. */
function messagesButton(state: ChannelMessagesState | undefined, label: string) {
  if (!state || state.status === 'loading') {
    return {
      disabled: true,
      variant: 'btn--secondary',
      title: 'Checking for messages…',
      aria: `Checking messages for ${label}`,
    };
  }
  if (state.status === 'success' && state.messages.length === 0) {
    return { disabled: true, variant: 'btn--secondary', title: NO_MESSAGES_TEXT, aria: `No messages for ${label}` };
  }
  if (state.status === 'success') {
    return { disabled: false, variant: 'btn--success', title: undefined, aria: `Messages for ${label}` };
  }
  // error / no-user: stay clickable so the panel can explain (and offer a retry).
  return {
    disabled: false,
    variant: 'btn--secondary',
    title: 'Messages could not be loaded',
    aria: `Messages for ${label}`,
  };
}

interface ChannelResultsTableProps {
  channels: ChannelRecord[];
  selectedArn: string | null;
  onSelect: (channel: ChannelRecord) => void;
  /** Messaging User ID from the search, if any. Messages are listed as this user, else as the channel admin. */
  searchMessagingUserId?: string;
  /** Injectable for tests. */
  listMessagesFn?: ListMessagesFn;
}

export function ChannelResultsTable({
  channels,
  selectedArn,
  onSelect,
  searchMessagingUserId,
  listMessagesFn,
}: ChannelResultsTableProps) {
  const [openMessages, setOpenMessages] = useState<Set<string>>(() => new Set());
  const { states: messageStates, retry: retryMessages } = useChannelMessages(
    channels,
    searchMessagingUserId,
    listMessagesFn,
  );

  // Collapse all message panels when a new result set arrives.
  useEffect(() => setOpenMessages(new Set()), [channels]);

  const toggleMessages = (arn: string) =>
    setOpenMessages((prev) => {
      const next = new Set(prev);
      if (next.has(arn)) next.delete(arn);
      else next.add(arn);
      return next;
    });

  let withMessages = 0;
  let checking = 0;
  for (const c of channels) {
    const s = messageStates.get(c.membership.ChannelSummary.ChannelArn);
    if (!s || s.status === 'loading') checking += 1;
    else if (s.status === 'success' && s.messages.length > 0) withMessages += 1;
  }

  return (
    <>
      <p className="results-table__summary" role="status" aria-live="polite">
        Channel with Message : <strong data-testid="channels-with-messages">{withMessages}</strong>
        {checking > 0 && <span className="results-table__summary-note"> (checking {checking} more…)</span>}
      </p>
      <div className="results-table__wrapper">
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">Channel name</th>
              <th scope="col">Channel ARN</th>
              <th scope="col">Candidate ID</th>
              <th scope="col">Job ID</th>
              <th scope="col">Channel type</th>
              <th scope="col">JT channel type</th>
              <th scope="col">Last message</th>
              <th scope="col">Video interview</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {channels.map((record) => {
              const { ChannelSummary } = record.membership;
              const meta = record.metadata;
              const arn = ChannelSummary.ChannelArn;
              const selected = arn === selectedArn;
              const messagesOpen = openMessages.has(arn);
              const label = ChannelSummary.Name || channelIdFromArn(arn);
              const messagesRowId = `messages-${channelIdFromArn(arn)}`;
              const messagesState = messageStates.get(arn);
              const btn = messagesButton(messagesState, label);
              // An open panel keeps its button usable so it can always be closed (e.g. while retrying).
              const btnDisabled = btn.disabled && !messagesOpen;
              return (
                <Fragment key={arn}>
                  <tr className={selected ? 'is-selected' : undefined} onClick={() => onSelect(record)}>
                    <td data-label="Channel name">{displayValue(ChannelSummary.Name)}</td>
                    <td data-label="Channel ARN" className="mono" title={arn}>
                      …/{channelIdFromArn(arn)}
                    </td>
                    <td data-label="Candidate ID" className="mono">
                      {displayValue(meta?.CandidateId)}
                    </td>
                    <td data-label="Job ID" className="mono">
                      {displayValue(meta?.JobId)}
                    </td>
                    <td data-label="Channel type">{displayValue(meta?.ChannelType)}</td>
                    <td data-label="JT channel type">{displayValue(meta?.channel?.jtChannelType)}</td>
                    <td data-label="Last message">{formatTimestamp(ChannelSummary.LastMessageTimestamp)}</td>
                    <td data-label="Video interview">
                      {meta ? (
                        <span className={`badge ${meta.VideoInterview ? 'badge--yes' : 'badge--no'}`}>
                          {meta.VideoInterview ? 'Yes' : 'No'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="results-table__action">
                      <button
                        type="button"
                        className={`btn btn--small ${btn.variant}${messagesOpen ? ' is-open' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMessages(arn);
                        }}
                        disabled={btnDisabled}
                        title={btn.title}
                        aria-busy={messagesState?.status === 'loading' || undefined}
                        aria-expanded={btnDisabled ? undefined : messagesOpen}
                        aria-controls={messagesOpen ? messagesRowId : undefined}
                        aria-label={btn.aria}
                      >
                        Messages
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn--secondary btn--small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(record);
                        }}
                        aria-label={`View details for ${label}`}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                  {messagesOpen && messagesState && (
                    <tr id={messagesRowId} className="results-table__messages-row">
                      <td colSpan={COLUMN_COUNT}>
                        <ChannelMessages state={messagesState} onRetry={() => retryMessages(record)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
