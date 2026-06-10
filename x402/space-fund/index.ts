/**
 * Bankr x402 — credit space fundraising after USDC payment.
 *
 * Env (bankr x402 env set):
 *   SPACE_SITE_URL=https://www.bankr.space
 *   X402_FUND_WEBHOOK_SECRET=<same as Vercel>
 *
 * Query: ?token=0x…&campaign=dex-profile&amount=25
 * Price is $1 USDC per request (bankr.x402.json). amount param is donor intent only.
 */
const CREDIT_USD = 1;

type CreditResponse = {
  success?: boolean;
  raisedUsd?: number;
  goalUsd?: number;
  error?: string;
};

function parseRequestUrl(req: Request): URL {
  try {
    return new URL(req.url);
  } catch {
    return new URL(req.url, 'https://x402.bankr.bot');
  }
}

export default async function handler(req: Request) {
  const url = parseRequestUrl(req);
  const token = String(url.searchParams.get('token') || '').trim().toLowerCase();
  const campaignId = String(url.searchParams.get('campaign') || 'dex-profile').trim();

  if (!/^0x[a-f0-9]{40}$/.test(token)) {
    return { success: false, raisedUsd: 0, goalUsd: 0, error: 'token query param required' };
  }

  const site = String(process.env.SPACE_SITE_URL || 'https://www.bankr.space').replace(/\/$/, '');
  const secret = process.env.X402_FUND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error('space-fund: X402_FUND_WEBHOOK_SECRET not set');
    // Return success shape so payment can settle; bankr.space proxy credits as fallback.
    return { success: true, raisedUsd: 0, goalUsd: 0 };
  }

  const creditUrl = `${site}/api/communities/${token}/fundraising/credit`;

  try {
    const res = await fetch(creditUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ campaignId, amountUsd: CREDIT_USD }),
      redirect: 'follow',
    });

    if (!res || typeof res.ok !== 'boolean') {
      console.error('space-fund: credit fetch did not return a Response');
      return { success: true, raisedUsd: 0, goalUsd: 0 };
    }

    const data = (await res.json().catch(() => ({}))) as CreditResponse;
    if (!res.ok) {
      console.error('space-fund: credit failed', res.status, data.error);
      return { success: true, raisedUsd: 0, goalUsd: 0 };
    }

    return {
      success: true,
      raisedUsd: Number(data.raisedUsd) || 0,
      goalUsd: Number(data.goalUsd) || 0,
    };
  } catch (err) {
    console.error('space-fund handler', err);
    return { success: true, raisedUsd: 0, goalUsd: 0 };
  }
}
