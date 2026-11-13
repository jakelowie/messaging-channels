/**
 * Types mirror chime-messaging-go-api as of this tool's creation. Source of truth:
 *   - routes/routes.go                      GET /api/search/channels -> opensearch.SearchChannelsV2
 *   - service/opensearch/OpenSearchService.go  SearchChannelsV2 (query-param parsing)
 *   - utils/opensearch_utils.go              ChannelQueryParams, BuildChannelQuery, FormatHitsToChannelMemeberships
 *   - models/request.go                      Response, ChannelMemberships, ChannelSummary, ...
 *   - models/quickconnect.go                 Metadata, ChanCadences, ChannelObject
 * If the Go structs change, update this file.
 */

/** Query-string parameters accepted by GET /api/search/channels. All optional. */
export interface SearchChannelsParams {
  /** Exact ChannelArn. When set, the API ignores every other filter except messagingUserId, and ignores size/from. */
  channelArn?: string;
  /** Nested Members.MessagingUserId term filter. */
  messagingUserId?: string;
  /** Nested Admin.MessagingUserId term filter. */
  adminId?: string;
  /** term: jtChannelType */
  jtChannelType?: string;
  /** term: ChannelType */
  channelType?: string;
  /** term: CandidateId */
  candidateId?: string;
  /** term: JobId */
  jobId?: string;
  /** term: Mode (Chime: RESTRICTED | UNRESTRICTED) */
  mode?: string;
  /** term: Privacy (Chime: PUBLIC | PRIVATE) */
  privacy?: string;
  /** term: publicId */
  publicId?: string;
  /** term (exact match): Name */
  name?: string;
  /** term: UnreadCount */
  unreadCount?: string;
  /** true = unread only, false = read only. Only applied by the API when messagingUserId is also set. */
  unread?: boolean;
  /** true = VideoInterview:true only; false = excludes VideoInterview:true. */
  videoInterview?: boolean;
  /** RFC3339 lower/upper bounds (inclusive) on CreatedTimestamp. */
  createdTimestampFrom?: string;
  createdTimestampTo?: string;
  /** RFC3339 lower/upper bounds (inclusive) on LastMessageTimestamp. */
  lastMessageTimestampFrom?: string;
  lastMessageTimestampTo?: string;
  /** Page size. API default is 1000. */
  size?: number;
  /** Offset. API default is 0. */
  from?: number;
}

/** models.AppInstanceUserMembershipSummary */
export interface AppInstanceUserMembershipSummary {
  /** Read marker of the member matching the messagingUserId filter; "" otherwise. */
  ReadMarkerTimestamp: string;
  /** Always "DEFAULT" (hardcoded by the API). */
  Type: string;
}

/** models.ChannelSummary */
export interface ChannelSummary {
  ChannelArn: string;
  LastMessageTimestamp: string;
  /** JSON-encoded models.Metadata. Parse with parseChannelMetadata(). */
  Metadata: string;
  Mode: string;
  Name: string;
  Privacy: string;
}

/** models.ChannelMemberships — one entry per matching channel. */
export interface ChannelMembership {
  AppInstanceUserMembershipSummary: AppInstanceUserMembershipSummary;
  ChannelSummary: ChannelSummary;
  /** Only present when > 0 and the messagingUserId has not read the channel. */
  UnreadCount?: number;
  /** Human-readable time since last message; only present alongside UnreadCount. */
  TimeElapsed?: string;
}

/** models.Response. ChannelMemberships is null when nothing matched. */
export interface SearchChannelsResponse {
  ChannelMemberships: ChannelMembership[] | null;
}

/** models.ChanCadences */
export interface ChannelCadences {
  jobseeker: number;
  recruiter: number;
}

/** models.ChannelObject */
export interface ChannelObject {
  jtChannelType?: string;
  publicId?: string;
  deeplink?: string;
  demo?: boolean;
  companyId?: number;
}

/** models.Metadata — the decoded form of ChannelSummary.Metadata. */
export interface ChannelMetadata {
  ChannelType: string;
  /** Formatted by the API as "<ExternalId>-<Role>". */
  Members: string[] | null;
  /** Admin's MessagingUserId. */
  Admin: string;
  OtherUsers: string[] | null;
  JobId: string;
  CandidateId: string;
  Cadences: ChannelCadences;
  /** RFC3339 string, or null when unset/epoch. */
  EndConversationTimestamp: string | null;
  EndOrReenableActionDoer: string;
  ReEnableConversationTimestamp: string | null;
  DateApplied: string;
  /** { <other member's MessagingUserId>: "ACTIVE" | ... } relative to the messagingUserId filter. */
  Status: Record<string, string>;
  channel?: ChannelObject;
  VideoInterview: boolean;
}

/** A search result with its Metadata string already decoded. */
export interface ChannelRecord {
  membership: ChannelMembership;
  /** null if Metadata was empty or not valid JSON. */
  metadata: ChannelMetadata | null;
}

export interface SearchChannelsResult {
  channels: ChannelRecord[];
  /** The response body exactly as received, for the raw-JSON debug view. */
  raw: SearchChannelsResponse;
}
