/**
 * Bankr x402 — credit space fundraising on bankr.space after USDC payment.
 *
 * Env (bankr x402 env set):
 *   SPACE_SITE_URL=https://www.bankr.space
 *   X402_FUND_WEBHOOK_SECRET=<same as Vercel>
 *
 * Query: ?token=0x…&campaign=dex-profile&amount=25
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

  const site = String(process.env.SPACE_SITE_URL || 'https://www.bankr.space').replace(/\/$/, '');
  const secret = process.env.X402_FUND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { error: 'X402_FUND_WEBHOOK_SECRET not configured on x402 service' };
  }

  const creditUrl = `${site}/api/communities/${token}/fundraising/credit`;
  const res = await fetch(creditUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaignId,
      amountUsd,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || `Credit failed (${res.status})` };
  }

  return {
    success: true,
    message: `Thank you — $${amountUsd} credited toward ${campaignId}`,
    token,
    campaignId,
    raisedUsd: data.raisedUsd,
    goalUsd: data.goalUsd,
    funded: Boolean(data.funded),
    spaceUrl: `${site}/community/${token}`,
  };
}
