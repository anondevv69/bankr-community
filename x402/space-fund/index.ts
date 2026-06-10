/**
 * Bankr x402 — acknowledge paid space-fund request.
 *
 * USDC payment is verified by Bankr x402 before this handler runs.
 * Crediting bankr.space KV happens on www.bankr.space (x402 proxy route)
 * so secrets stay on Vercel — not x402 Cloud.
 *
 * Query: ?token=0x…&campaign=dex-profile&amount=2
 */
export default async function handler(req: Request) {
  const url = new URL(req.url);
  const token = String(url.searchParams.get('token') || '').trim().toLowerCase();
  const campaignId = String(url.searchParams.get('campaign') || 'dex-profile').trim();
  const amountUsd = Number(url.searchParams.get('amount') || '0');

  if (!/^0x[a-f0-9]{40}$/.test(token)) {
    return { error: 'token query param required (0x contract address)' };
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { error: 'amount query param must be a positive USD number' };
  }

  // Match bankr.x402.json output schema. KV credit runs on www.bankr.space proxy.
  return {
    success: true,
    raisedUsd: 0,
    goalUsd: 0,
    token,
    campaignId,
    requestedAmountUsd: amountUsd,
  };
}
