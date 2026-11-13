import { DEFAULT_PAGE_SIZE, MAX_RESULT_WINDOW } from '../config';
import type { SearchChannelsParams } from '../types/channel';

/** Raw form state. Everything is a string so inputs stay controlled. */
export interface SearchFormValues {
  channelArn: string;
  messagingUserId: string;
  adminId: string;
  candidateId: string;
  jobId: string;
  publicId: string;
  name: string;
  channelType: string;
  jtChannelType: string;
  mode: string; // '' | RESTRICTED | UNRESTRICTED
  privacy: string; // '' | PUBLIC | PRIVATE
  videoInterview: string; // '' | 'true' | 'false'
  unread: string; // '' | 'true' | 'false'
  unreadCount: string;
  /** <input type="datetime-local"> values, interpreted in the browser's local time zone. */
  createdFrom: string;
  createdTo: string;
  lastMessageFrom: string;
  lastMessageTo: string;
  pageSize: string;
}

export type SearchFormErrors = Partial<Record<keyof SearchFormValues | 'form', string>>;

export const EMPTY_FORM: SearchFormValues = {
  channelArn: '',
  messagingUserId: '',
  adminId: '',
  candidateId: '',
  jobId: '',
  publicId: '',
  name: '',
  channelType: '',
  jtChannelType: '',
  mode: '',
  privacy: '',
  videoInterview: '',
  unread: '',
  unreadCount: '',
  createdFrom: '',
  createdTo: '',
  lastMessageFrom: '',
  lastMessageTo: '',
  pageSize: String(DEFAULT_PAGE_SIZE),
};

/** Fields that count as "a filter" (page size does not). */
const FILTER_FIELDS: (keyof SearchFormValues)[] = Object.keys(EMPTY_FORM).filter(
  (k) => k !== 'pageSize',
) as (keyof SearchFormValues)[];

const CHANNEL_ARN_RE = /^arn:aws:chime:[a-z0-9-]+:\d{12}:app-instance\/[^/\s]+\/channel\/[^/\s]+$/;
const NO_WHITESPACE_RE = /^\S+$/;
const MAX_ID_LENGTH = 512;

const ID_FIELDS = ['messagingUserId', 'adminId', 'candidateId', 'jobId', 'publicId', 'channelType', 'jtChannelType'] as const;

/** datetime-local value -> RFC3339 UTC (seconds precision), or null if invalid. */
export function localDateTimeToRfc3339(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function hasAnyFilter(values: SearchFormValues): boolean {
  return FILTER_FIELDS.some((k) => values[k].trim() !== '');
}

export interface ValidationResult {
  errors: SearchFormErrors;
  /** Params for the first page; null when there are errors. */
  params: SearchChannelsParams | null;
}

/**
 * Validates the form and converts it to API params (from = 0).
 * Rules come from how the Go handler behaves, e.g. `unread` is silently ignored without
 * messagingUserId, size=0 returns nothing, and from+size > 10,000 makes the API 500.
 */
export function validateSearchForm(values: SearchFormValues): ValidationResult {
  const errors: SearchFormErrors = {};
  const v = Object.fromEntries(
    Object.entries(values).map(([k, val]) => [k, typeof val === 'string' ? val.trim() : val]),
  ) as unknown as SearchFormValues;

  if (!hasAnyFilter(v)) {
    errors.form = 'Enter at least one filter. Searching with no filters would return the whole index.';
  }

  if (v.channelArn && !CHANNEL_ARN_RE.test(v.channelArn)) {
    errors.channelArn = 'Expected a Chime channel ARN: arn:aws:chime:<region>:<account>:app-instance/<id>/channel/<id>';
  }

  for (const field of ID_FIELDS) {
    const val = v[field];
    if (!val) continue;
    if (!NO_WHITESPACE_RE.test(val)) errors[field] = 'Must not contain spaces.';
    else if (val.length > MAX_ID_LENGTH) errors[field] = `Must be ${MAX_ID_LENGTH} characters or fewer.`;
  }
  if (v.name.length > MAX_ID_LENGTH) errors.name = `Must be ${MAX_ID_LENGTH} characters or fewer.`;

  if (v.unread && !v.messagingUserId) {
    errors.unread = 'Read/unread filtering needs a Messaging User ID (the API ignores it otherwise).';
  }

  if (v.unreadCount && !/^\d+$/.test(v.unreadCount)) {
    errors.unreadCount = 'Must be a whole number (0 or more).';
  }

  const dates: Record<'createdFrom' | 'createdTo' | 'lastMessageFrom' | 'lastMessageTo', string | null> = {
    createdFrom: null,
    createdTo: null,
    lastMessageFrom: null,
    lastMessageTo: null,
  };
  for (const key of Object.keys(dates) as (keyof typeof dates)[]) {
    if (!v[key]) continue;
    const iso = localDateTimeToRfc3339(v[key]);
    if (!iso) errors[key] = 'Invalid date/time.';
    dates[key] = iso;
  }
  if (dates.createdFrom && dates.createdTo && dates.createdFrom > dates.createdTo) {
    errors.createdTo = '"Created to" must be after "Created from".';
  }
  if (dates.lastMessageFrom && dates.lastMessageTo && dates.lastMessageFrom > dates.lastMessageTo) {
    errors.lastMessageTo = '"Last message to" must be after "Last message from".';
  }

  const size = Number(v.pageSize);
  if (!Number.isInteger(size) || size < 1 || size > MAX_RESULT_WINDOW) {
    errors.pageSize = `Page size must be between 1 and ${MAX_RESULT_WINDOW}.`;
  }

  if (Object.keys(errors).length > 0) return { errors, params: null };

  const bool = (s: string): boolean | undefined => (s === 'true' ? true : s === 'false' ? false : undefined);

  // With channelArn the API ignores everything except messagingUserId (and ignores paging).
  if (v.channelArn) {
    return {
      errors,
      params: { channelArn: v.channelArn, messagingUserId: v.messagingUserId || undefined },
    };
  }

  const params: SearchChannelsParams = {
    messagingUserId: v.messagingUserId || undefined,
    adminId: v.adminId || undefined,
    candidateId: v.candidateId || undefined,
    jobId: v.jobId || undefined,
    publicId: v.publicId || undefined,
    name: v.name || undefined,
    channelType: v.channelType || undefined,
    jtChannelType: v.jtChannelType || undefined,
    mode: v.mode || undefined,
    privacy: v.privacy || undefined,
    videoInterview: bool(v.videoInterview),
    unread: bool(v.unread),
    unreadCount: v.unreadCount || undefined,
    createdTimestampFrom: dates.createdFrom ?? undefined,
    createdTimestampTo: dates.createdTo ?? undefined,
    lastMessageTimestampFrom: dates.lastMessageFrom ?? undefined,
    lastMessageTimestampTo: dates.lastMessageTo ?? undefined,
    size,
    from: 0,
  };
  return { errors, params };
}
