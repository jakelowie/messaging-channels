import type { ChannelMembership, ChannelMetadata, ChannelRecord, SearchChannelsResult } from '../types/channel';
import type { ChannelMessage } from '../types/message';

let counter = 0;

export function makeMetadata(overrides: Partial<ChannelMetadata> = {}): ChannelMetadata {
  return {
    ChannelType: 'CANDIDATE_RECRUITER',
    Members: ['a1b2c3d4-0000-1111-2222-333344445555-Recruiter', 'cand-9876-Jobseeker'],
    Admin: 'admin-user-1',
    OtherUsers: ['other-user-1'],
    JobId: 'JOB-100',
    CandidateId: 'CAND-200',
    Cadences: { jobseeker: 3, recruiter: 7 },
    EndConversationTimestamp: null,
    EndOrReenableActionDoer: '',
    ReEnableConversationTimestamp: null,
    DateApplied: '2026-10-01',
    Status: { 'other-user-1': 'ACTIVE' },
    channel: { jtChannelType: 'candidateManager', publicId: 'pub-1', deeplink: 'https://example.test/c/1', companyId: 42 },
    VideoInterview: true,
    ...overrides,
  };
}

export function makeMembership(
  overrides: { name?: string; arn?: string; metadata?: ChannelMetadata | string; unread?: number } = {},
): ChannelMembership {
  counter += 1;
  const meta = overrides.metadata ?? makeMetadata();
  return {
    AppInstanceUserMembershipSummary: { ReadMarkerTimestamp: '2026-11-01T10:00:00Z', Type: 'DEFAULT' },
    ChannelSummary: {
      ChannelArn:
        overrides.arn ??
        `arn:aws:chime:us-east-1:123456789012:app-instance/app-1/channel/ch-${String(counter).padStart(4, '0')}`,
      LastMessageTimestamp: '2026-11-02T15:30:00Z',
      Metadata: typeof meta === 'string' ? meta : JSON.stringify(meta),
      Mode: 'RESTRICTED',
      Name: overrides.name ?? `Channel ${counter}`,
      Privacy: 'PRIVATE',
    },
    ...(overrides.unread ? { UnreadCount: overrides.unread, TimeElapsed: '2 hours ago' } : {}),
  };
}

export function makeResult(memberships: ChannelMembership[]): SearchChannelsResult {
  const channels: ChannelRecord[] = memberships.map((m) => {
    let metadata: ChannelMetadata | null = null;
    try {
      metadata = JSON.parse(m.ChannelSummary.Metadata) as ChannelMetadata;
    } catch {
      metadata = null;
    }
    return { membership: m, metadata };
  });
  return { channels, raw: { ChannelMemberships: memberships.length ? memberships : null } };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let messageCounter = 0;

export function makeMessage(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  messageCounter += 1;
  return {
    Content: `Hello ${messageCounter}`,
    CreatedTimestamp: '2026-11-02T15:30:00Z',
    LastEditedTimestamp: null,
    LastUpdatedTimestamp: '2026-11-02T15:30:00Z',
    MessageId: `msg-${messageCounter}`,
    Metadata: null,
    Redacted: false,
    Sender: { Arn: 'arn:aws:chime:us-east-1:1:app-instance/a/user/u1', Name: 'Jane Recruiter' },
    Type: 'STANDARD',
    ...overrides,
  };
}
