import { useEffect, useState, type ReactNode } from 'react';
import type { ChannelRecord } from '../types/channel';
import { channelIdFromArn, displayValue, formatTimestamp, parseMember } from '../utils/format';

interface ChannelDetailsProps {
  channel: ChannelRecord;
  onClose: () => void;
}

function Row({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="details__row">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{children}</dd>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="btn btn--link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* clipboard unavailable (e.g. insecure context); ignore */
        }
      }}
      aria-label={label}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function ChannelDetails({ channel, onClose }: ChannelDetailsProps) {
  const [showRaw, setShowRaw] = useState(false);
  const { membership, metadata: meta } = channel;
  const summary = membership.ChannelSummary;
  const members = (meta?.Members ?? []).map(parseMember);
  const otherUsers = meta?.OtherUsers ?? [];
  const statusEntries = Object.entries(meta?.Status ?? {}).filter(([id]) => id !== '');
  const rawJson = JSON.stringify({ ...membership, ChannelSummary: { ...summary, Metadata: meta ?? summary.Metadata } }, null, 2);

  useEffect(() => setShowRaw(false), [summary.ChannelArn]);

  return (
    <section className="details" aria-labelledby="channel-details-title">
      <header className="details__header">
        <div>
          <h2 id="channel-details-title">{summary.Name || 'Untitled channel'}</h2>
          <p className="details__subtitle mono" title={summary.ChannelArn}>
            {channelIdFromArn(summary.ChannelArn)}
          </p>
        </div>
        <button type="button" className="btn btn--secondary btn--small" onClick={onClose} aria-label="Close details">
          Close
        </button>
      </header>

      {!meta && (
        <p className="details__notice" role="note">
          This channel's Metadata could not be decoded, so only the summary fields are shown.
        </p>
      )}

      <h3>Channel</h3>
      <dl className="details__list">
        <Row label="Channel ARN" mono>
          <span className="break">{summary.ChannelArn}</span>{' '}
          <CopyButton text={summary.ChannelArn} label="Copy channel ARN" />
        </Row>
        <Row label="Name">{displayValue(summary.Name)}</Row>
        <Row label="Channel type">{displayValue(meta?.ChannelType)}</Row>
        <Row label="Mode">{displayValue(summary.Mode)}</Row>
        <Row label="Privacy">{displayValue(summary.Privacy)}</Row>
        <Row label="Video interview">{displayValue(meta?.VideoInterview)}</Row>
        <Row label="Candidate ID" mono>{displayValue(meta?.CandidateId)}</Row>
        <Row label="Job ID" mono>{displayValue(meta?.JobId)}</Row>
        <Row label="Date applied">{displayValue(meta?.DateApplied)}</Row>
      </dl>

      <h3>Configuration</h3>
      <dl className="details__list">
        <Row label="JT channel type">{displayValue(meta?.channel?.jtChannelType)}</Row>
        <Row label="Public ID" mono>{displayValue(meta?.channel?.publicId)}</Row>
        <Row label="Deeplink">
          {meta?.channel?.deeplink ? <span className="break mono">{meta.channel.deeplink}</span> : '—'}
        </Row>
        <Row label="Company ID">{displayValue(meta?.channel?.companyId)}</Row>
        <Row label="Demo channel">{displayValue(meta?.channel?.demo ?? false)}</Row>
      </dl>

      <h3>Conversation timestamps</h3>
      <dl className="details__list">
        <Row label="Last message">{formatTimestamp(summary.LastMessageTimestamp)}</Row>
        <Row label="Conversation ended">{formatTimestamp(meta?.EndConversationTimestamp)}</Row>
        <Row label="Conversation re-enabled">{formatTimestamp(meta?.ReEnableConversationTimestamp)}</Row>
        <Row label="Ended / re-enabled by" mono>{displayValue(meta?.EndOrReenableActionDoer)}</Row>
        <Row label="Member read marker">{formatTimestamp(membership.AppInstanceUserMembershipSummary.ReadMarkerTimestamp)}</Row>
        {membership.UnreadCount !== undefined && (
          <Row label="Unread messages">
            {membership.UnreadCount}
            {membership.TimeElapsed ? ` (last message ${membership.TimeElapsed})` : ''}
          </Row>
        )}
      </dl>
      <p className="details__hint">
        Read marker and unread values are relative to the Messaging User ID used in the search (blank if none).
      </p>

      <h3>Admin</h3>
      <dl className="details__list">
        <Row label="Messaging User ID" mono>{displayValue(meta?.Admin)}</Row>
      </dl>

      <h3>Members ({members.length})</h3>
      {members.length ? (
        <table className="details__table">
          <thead>
            <tr>
              <th scope="col">External ID</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.externalId}-${m.role}-${i}`}>
                <td className="mono break">{m.externalId}</td>
                <td>{m.role || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="details__empty">No members returned.</p>
      )}

      <h3>Other users ({otherUsers.length})</h3>
      {otherUsers.length ? (
        <ul className="details__chips">
          {otherUsers.map((u) => (
            <li key={u} className="mono">
              {u}
            </li>
          ))}
        </ul>
      ) : (
        <p className="details__empty">None.</p>
      )}

      {statusEntries.length > 0 && (
        <>
          <h3>Other member status</h3>
          <dl className="details__list">
            {statusEntries.map(([id, status]) => (
              <Row key={id} label={id} mono>
                {status}
              </Row>
            ))}
          </dl>
        </>
      )}

      <h3>Cadences</h3>
      <dl className="details__list">
        <Row label="Jobseeker cadence ID">{displayValue(meta?.Cadences?.jobseeker || null)}</Row>
        <Row label="Recruiter cadence ID">{displayValue(meta?.Cadences?.recruiter || null)}</Row>
      </dl>

      <p className="details__hint">
        Created/last-updated timestamps and ReadBy are stored in the index but are not returned by
        <code> /search/channels</code>.
      </p>

      <div className="details__raw">
        <button type="button" className="btn btn--secondary btn--small" onClick={() => setShowRaw((s) => !s)} aria-expanded={showRaw}>
          {showRaw ? 'Hide raw JSON' : 'Show raw JSON (Metadata decoded)'}
        </button>
        <CopyButton text={rawJson} label="Copy raw JSON" />
        {showRaw && <pre className="details__json">{rawJson}</pre>}
      </div>
    </section>
  );
}
