const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Formats an RFC3339 timestamp in local time. Returns '—' for empty/epoch values. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value || value.startsWith('1970-01-01')) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

/** Last path segment of a Chime channel ARN (the channel id). */
export function channelIdFromArn(arn: string): string {
  const idx = arn.lastIndexOf('/channel/');
  return idx >= 0 ? arn.slice(idx + '/channel/'.length) : arn;
}

/**
 * The API formats each member as "<ExternalId>-<Role>". ExternalIds can contain hyphens,
 * so split on the LAST hyphen.
 */
export function parseMember(member: string): { externalId: string; role: string } {
  const idx = member.lastIndexOf('-');
  if (idx <= 0) return { externalId: member, role: '' };
  return { externalId: member.slice(0, idx), role: member.slice(idx + 1) };
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
