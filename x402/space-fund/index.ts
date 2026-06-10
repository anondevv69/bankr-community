/**
 * Bankr x402 handler — credits space fundraising progress on bankr.space after USDC payment.
 *
 * Deploy:
 *   1. bankr x402 init && copy this folder to x402/space-fund
 *   2. bankr x402 env set SPACE_SITE_URL=https://www.bankr.space
 *   3. bankr x402 env set X402_FUND_WEBHOOK_SECRET=<same as Vercel>
 *   4. bankr x402 deploy
 *   5. Set Vercel NEXT_PUBLIC_X402_SPACE_FUND_URL=https://x402.bankr.bot/{yourWallet}/space-fund
 *
 * Query: ?token=0x…&campaign=dex-profile&amount=25
 * Price is dynamic — configure base price $1; handler validates amount param.
 * For variable amounts use Bankr "upto" scheme in bankr.x402.json if needed.
 */

type CreditResponse = {
  success?: boolean;
  raisedUsd?: number;
  goalUsd?: number;
  error?: string;
};

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
      txRef: req.headers.get('x-payment-tx') || req.headers.get('x-transaction-id') || null,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as CreditResponse;
  if (!res.ok) {
    return { error: data.error || `Credit failed (${res.status})` };
  }

  return {
    success: true,
    message: `Thank you — $${amountUsd} credited toward ${campaignId} for ${token}`,
    token,
    campaignId,
    raisedUsd: data.raisedUsd,
    goalUsd: data.goalUsd,
    funded: data.raisedUsd != null && data.goalUsd != null ? data.raisedUsd >= data.goalUsd : false,
    spaceUrl: `${site}/community/${token}`,
  };
}
