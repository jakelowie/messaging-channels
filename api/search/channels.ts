/**
 * Vercel serverless function: the production stand-in for the Vite dev/preview proxy
 * (vite.config.ts). The browser calls GET /api/search/channels?..., and this function
 * forwards only the query string to chime-messaging-go-api, adding the shared token
 * server-side. The token never reaches the browser.
 *
 * Only this one endpoint is forwarded (not a catch-all /api/*), so the token cannot be
 * used to reach other routes on the messaging API. Browser headers (Authorization,
 * Cookie, ...) are never forwarded.
 *
 * Env (Vercel project settings, NOT VITE_-prefixed):
 *   MESSAGING_API_URL    API base URL without the /api suffix
 *   MESSAGING_API_TOKEN  KMS-encrypted token the API expects in Authorization
 */

const UPSTREAM_TIMEOUT_MS = 9_000;

export async function GET(request: Request): Promise<Response> {
  const target = process.env.MESSAGING_API_URL?.trim();
  const token = process.env.MESSAGING_API_TOKEN?.trim();
  if (!target || !token) {
    console.error('[api/search/channels] MESSAGING_API_URL or MESSAGING_API_TOKEN is not set');
    return emptyResponse(500);
  }

  const { search } = new URL(request.url);
  const upstreamUrl = `${target.replace(/\/+$/, '')}/api/search/channels${search}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Authorization: token, Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    // Unreachable host (e.g. VPN-only API), DNS failure or timeout.
    console.error('[api/search/channels] upstream request failed:', error);
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

function emptyResponse(status: number): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
}
