/**
 * Bankr x402 space-fund handler (runs on x402.bankr.bot — NOT on bankr.space).
 *
 * Bankr verifies USDC payment, runs this handler, then settles on-chain only if
 * the handler returns HTTP 200. KV credit runs on www.bankr.space (x402 proxy route)
 * so secrets stay on Vercel and we avoid fetch() from x402 Cloud (Bun runtime crash:
 * "fetch() did not return a Response").
 *
 * Query: ?token=0x…&campaign=dex-profile&amount=25
 */
function parseRequestUrl(req: Request): URL {
  try {
    return new URL(req.url);
  } catch {
    return new URL(req.url, 'https://x402.bankr.bot');
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = parseRequestUrl(req);
    const token = String(url.searchParams.get('token') || '').trim().toLowerCase();
    const campaignId = String(url.searchParams.get('campaign') || 'dex-profile').trim();

    if (!/^0x[a-f0-9]{40}$/.test(token)) {
      return jsonResponse({
        success: false,
        raisedUsd: 0,
        goalUsd: 0,
        error: 'token query param required (0x contract address)',
      });
    }

    if (!['dex-profile', 'dex-boost', 'custom'].includes(campaignId)) {
      return jsonResponse({
        success: false,
        raisedUsd: 0,
        goalUsd: 0,
        error: 'invalid campaign query param',
      });
    }

    // Match bankr.x402.json output schema. raisedUsd/goalUsd filled by bankr.space proxy.
    return jsonResponse({
      success: true,
      raisedUsd: 0,
      goalUsd: 0,
      token,
      campaignId,
    });
  } catch (err) {
    console.error('space-fund handler', err);
    return jsonResponse({ success: true, raisedUsd: 0, goalUsd: 0 });
  }
}
