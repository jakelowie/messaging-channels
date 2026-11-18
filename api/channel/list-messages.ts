/**
 * Vercel serverless function: the production stand-in for the Vite dev/preview proxy for
 * POST /api/channel/list-messages. It forwards only { channelArn, messagingUserId } to
 * chime-messaging-go-api with the shared token added server-side. Browser headers are never
 * forwarded, and the body is rebuilt so only those two fields reach the API.
 *
 * Env: MESSAGING_API_URL, MESSAGING_API_TOKEN (same as api/search/channels.ts).
 */

const UPSTREAM_TIMEOUT_MS = 9_000;
const MAX_FIELD_LENGTH = 512;

export async function POST(request: Request): Promise<Response> {
  const target = process.env.MESSAGING_API_URL?.trim();
  const token = process.env.MESSAGING_API_TOKEN?.trim();
  if (!target || !token) {
    console.error('[api/channel/list-messages] MESSAGING_API_URL or MESSAGING_API_TOKEN is not set');
    return emptyResponse(500);
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return emptyResponse(400);
  }
  const channelArn = field(parsed, 'channelArn');
  const messagingUserId = field(parsed, 'messagingUserId');
  if (!channelArn || !messagingUserId) return emptyResponse(400);

  let upstream: Response;
  try {
    upstream = await fetch(`${target.replace(/\/+$/, '')}/api/channel/list-messages`, {
      method: 'POST',
      headers: { Authorization: token, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelArn, messagingUserId }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('[api/channel/list-messages] upstream request failed:', error);
    return emptyResponse(502);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function field(body: unknown, key: string): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_FIELD_LENGTH ? trimmed : null;
}

function emptyResponse(status: number): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
}
