import type { ChannelRecord } from '../types/channel';
import { channelIdFromArn, displayValue, formatTimestamp } from '../utils/format';

interface ChannelResultsTableProps {
  channels: ChannelRecord[];
  selectedArn: string | null;
  onSelect: (channel: ChannelRecord) => void;
}

export function ChannelResultsTable({ channels, selectedArn, onSelect }: ChannelResultsTableProps) {
  return (
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
            return (
              <tr
                key={arn}
                className={selected ? 'is-selected' : undefined}
                onClick={() => onSelect(record)}
              >
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
                    className="btn btn--secondary btn--small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(record);
                    }}
                    aria-label={`View details for ${ChannelSummary.Name || channelIdFromArn(arn)}`}
                  >
                    Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
