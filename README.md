# search-messaging-channels
A small internal React + TypeScript tool for searching the `messaging-channels` index through
chime-messaging-go-api's existing **`GET /api/search/channels`** endpoint. It lets you search
without Postman/Insomnia or direct OpenSearch queries. The Go API is used exactly as it is.

## Quick start
Requires Node 20+ and network/VPN access to the messaging API.

```bash
npm install
cp .env.example .env.local     # then set MESSAGING_API_URL and MESSAGING_API_TOKEN
npm run dev                    # http://localhost:5173
```

| Variable | Where it's used | Notes |
|---|---|---|
| `MESSAGING_API_URL` | Vite dev/preview server only | API base URL **without** `/api`, e.g. the QA host |
| `MESSAGING_API_TOKEN` | Vite dev/preview server only | KMS-encrypted token for that environment (team secret store). **Never commit.** |
| `VITE_API_BASE_PATH` | Browser | Optional, defaults to `/api`. Must not contain secrets |

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run build`, `npm run preview`
(serves the production build through the same proxy).

## How authentication works (and why there's a proxy)

`middleware/auth.go` checks the raw `Authorization` header. When `ENABLE_AUTH=true`, the value
must be a base32, KMS-encrypted string that decrypts to a key in the API's env config. It is
a **shared service token**, not a per-user credential. Shipping it to the browser (for example
as a `VITE_` variable) would expose it to anyone who opens the page or the bundle.

So the browser calls the relative `/api/...` path, and Vite's built-in dev/preview proxy
(`vite.config.ts`) forwards it to `MESSAGING_API_URL`:
- it **removes** any `Authorization` or `Cookie` header the browser sent;
- it **adds** `Authorization: $MESSAGING_API_TOKEN` server-side.

Locally, no new service is involved: the proxy runs inside the dev server you already start.
When hosted on Vercel, the serverless function `api/search/channels.ts` does the same job (see
[Deploying to Vercel](#deploying-to-vercel)).

## Deploying to Vercel

`vite build` only produces static files, and the Vite proxy above doesn't exist in production.
On Vercel, **`api/search/channels.ts`** takes its place: it forwards only the query string of
`GET /api/search/channels` to `MESSAGING_API_URL` with `Authorization: $MESSAGING_API_TOKEN`,
and it never forwards browser headers. It forwards just this one endpoint, not all of `/api/*`.
It returns an empty 500 if the env vars are missing and an empty 502 if the API is unreachable
or takes longer than 9 seconds. Its tests are in `tests/api/` (kept out of `api/` because Vercel
deploys every file in `api/` as a function).

**`api/channel/list-messages.ts`** does the same for `POST /api/channel/list-messages` (used by
the **Messages** button). It rebuilds the body so only `channelArn` and `messagingUserId` reach
the API, and it returns an empty 400 if either one is missing.

## Channel messages

As soon as a page of results arrives, the tool calls `POST /api/channel/list-messages` (the same
endpoint the `list-messages` Go tool uses) for every channel on the page, at most 6 at a time.
Each row's **Messages** button reflects the result:

| Button | Meaning |
|---|---|
| Disabled (grey) while loading | still checking this channel |
| **Green** | the channel has messages; click to show the first 10 with each sender and time |
| Disabled (grey) after loading | the channel has no messages (tooltip: **NO MESSAGES FOR THIS CHANNEL YET**) |
| Grey but clickable | the check failed, or there was no member to list as; click for details and **Try again** |

Opening a channel shows the messages already fetched; it doesn't call the API again. A new search
or page cancels any checks still running. `LastMessageTimestamp` from the search is not used to
decide this, because it isn't a reliable signal.

The API lists messages as a specific channel member (`messagingUserId`). The tool uses the
**Messaging User ID** from the search if you entered one, and otherwise the channel's admin
(`Metadata.Admin`).

1. **Import the repo** in Vercel (**Add New → Project**), or run `npx vercel link` from the CLI.
   The **Vite** preset is detected: build `npm run build`, output `dist`. Under
   Settings → General, set Node.js to **20.x or later**.
2. **Environment variables** (Settings → Environment Variables), for Production and, if you
   want, Preview:
   - `MESSAGING_API_URL`: API base URL **without** `/api`
   - `MESSAGING_API_TOKEN`: from the team secret store; mark it **Sensitive**

   Never use a `VITE_` prefix for these, because `VITE_` variables are bundled into the browser.
3. **Deployment Protection** (Settings → Deployment Protection): turn it on for **all**
   deployments, including Production (Vercel Authentication, Password, or Trusted IPs).
   The function attaches a shared service token to every request, so anyone who can open the
   URL can search channel data.
4. **Deploy**: push to `main` (Git integration), or run `npx vercel --prod`. Pushes to other
   branches get preview URLs.
5. **Verify**: run a search on the deployed URL. If it fails, check Deployments → (latest) →
   Logs for `[api/search/channels]` messages.

**Network reachability:** Vercel functions run on the public internet. If the messaging API is
only reachable over VPN or from allowlisted IPs, every search will fail with a 502 (a timeout or
`fetch failed` in the logs). The API needs to be reachable from Vercel (for example, Vercel
Static IPs on a paid plan added to its allowlist). Otherwise, host the app inside the network
instead, for example behind the existing messaging-api-gateway with corporate SSO.

## API contract (discovered from the Go source)

Sources: `routes/routes.go`, `service/opensearch/OpenSearchService.go` (`SearchChannelsV2`),
`utils/opensearch_utils.go` (`ChannelQueryParams`, `BuildChannelQuery`,
`FormatHitsToChannelMemeberships`), `models/request.go`, `models/quickconnect.go`.

**Request:** `GET /api/search/channels?<query>` behind `AuthMiddleware`. All parameters are optional and ANDed:

| Param | OpenSearch filter |
|---|---|
| `channelArn` | `term ChannelArn`. **If set, every other filter except `messagingUserId` is ignored, and so are `size`/`from`** |
| `messagingUserId` | nested `Members.MessagingUserId` |
| `adminId` | nested `Admin.MessagingUserId` |
| `candidateId`, `jobId`, `channelType`, `jtChannelType`, `mode`, `privacy`, `publicId`, `name`, `unreadCount` | exact `term` on `CandidateId`, `JobId`, `ChannelType`, `jtChannelType`, `Mode`, `Privacy`, `publicId`, `Name`, `UnreadCount` |
| `videoInterview=true\|false` | `true` → `VideoInterview: true`; `false` → must_not `VideoInterview: true` |
| `unread=true\|false` | with `messagingUserId` only: must_not / must nested `ReadBy.MessagingUserId` |
| `createdTimestampFrom/To`, `lastMessageTimestampFrom/To` | inclusive `range` (RFC3339) |
| `size`, `from` | page size (default **1000**) and offset (default 0) |

There is **no sort parameter** and **no total count** in the response.

**Response 200:**

```jsonc
{ "ChannelMemberships": [            // null when nothing matches
  {
    "AppInstanceUserMembershipSummary": { "ReadMarkerTimestamp": "…", "Type": "DEFAULT" },
    "ChannelSummary": {
      "ChannelArn": "…", "LastMessageTimestamp": "…", "Mode": "…", "Name": "…", "Privacy": "…",
      "Metadata": "<JSON string>"      // models.Metadata, see below
    },
    "UnreadCount": 2, "TimeElapsed": "…" // only when unread by messagingUserId
  } ] }
```

The decoded `Metadata` contains `ChannelType, Members ["<ExternalId>-<Role>"], Admin (MessagingUserId),
OtherUsers, JobId, CandidateId, Cadences {jobseeker, recruiter}, EndConversationTimestamp,
EndOrReenableActionDoer, ReEnableConversationTimestamp, DateApplied, Status {otherUserId: status},
channel {jtChannelType, publicId, deeplink, demo, companyId}, VideoInterview`.

**Errors:** 401 `{"error":"Invalid Token"}` on bad tokens. OpenSearch errors are swallowed by
`FetchChannelData`, and the handler then panics, so `gin.Recovery` returns a **bare 500 with an empty
body**. This happens, for example, when `from + size > 10000` (OpenSearch's `max_result_window`).

## What the app does

- **Search form:** every supported filter, combinable. Mode/Privacy use Chime's enum values;
  other text filters are free text because the API does exact `term` matching.
- **Validation:** at least one filter (prevents accidental full-index pulls); ARN format; no
  whitespace in IDs; `unread` requires a Messaging User ID (the API would silently ignore it);
  date ranges in order; page size 1–10,000; paging never goes past the 10,000 result window.
  With a Channel ARN entered, the fields the API ignores are disabled.
- **Results table:** name, ARN (shortened, full value on hover), candidate, job, channel type,
  JT channel type, last message, video interview. On narrow screens rows become stacked cards.
- **Details panel:** channel, configuration, conversation timestamps, admin, members (role
  split out), other users, member status, cadences, plus an optional raw-JSON view and copy.
- **States:** loading spinner, empty state, friendly errors (backend error bodies are never shown)
  with a retry, and Clear filters.
- **Request hygiene:** identical in-flight requests are skipped, a new search aborts the previous
  one, and the last 20 results are cached per query (**Refresh** bypasses the cache).
- **Pagination:** Prev/Next using `from`/`size`. Next is enabled when a page comes back full.
  No page count is possible because the API returns no total.

## Limitations

- `CreatedTimestamp`, `LastUpdatedTimestamp`, `ReadBy` and raw member `MessagingUserId`s are
  in the index but **not returned** by this endpoint (or by `/search/channel/details`). You can
  filter on created date but can't display it. Showing them would need an API change.
- Results are in OpenSearch's default order (no sort param).
- `name` and other text filters are exact, case-sensitive matches (no partial search).
- When paging with exactly N×size results, the last Next click shows an empty page.

## Layout

```
src/
  components/  ChannelSearchForm, ChannelResultsTable, ChannelDetails, ChannelMessages, LoadingIndicator, ErrorMessage
  hooks/       useChannelSearch.ts       search state, abort, de-dupe, cache, paging
               useChannelMessages.ts     prefetches messages per channel (6 at a time)
  pages/       ChannelSearchPage.tsx
  services/    channelApi.ts, messageApi.ts  the only code that talks to the API
  types/       channel.ts, message.ts    mirror the Go structs
  utils/       searchForm.ts (validation → params), format.ts
  test/        setup + fixtures
api/search/channels.ts         Vercel function: production replacement for the Vite proxy
api/channel/list-messages.ts   Vercel function: same, for the Messages button
tests/api/               tests for the Vercel function
```

Tests use Vitest + Testing Library. This matches chime-messaging-ui's Jest/RTL style, with the
Vite-native runner.
