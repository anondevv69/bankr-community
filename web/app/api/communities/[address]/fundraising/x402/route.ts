import { NextResponse } from 'next/server';
import { applyFundraisingCredit } from '@/lib/apply-fundraising-credit';
import { buildSpaceFundUrl, type CampaignId } from '@/lib/fundraising';
import { SPACE_FUND_X402_MAX_USDC } from '@/lib/x402-pay';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

const CAMPAIGN_IDS: CampaignId[] = ['dex-profile', 'dex-boost', 'custom'];

/**
 * Same-origin proxy for Bankr x402 space-fund. Browsers cannot send X-PAYMENT
 * cross-origin to x402.bankr.bot (CORS preflight fails on 402).
 *
 * After x402 verifies USDC payment and the space-fund handler returns 200,
 * credit fundraising here (Vercel KV). The x402 Cloud handler intentionally does
 * not fetch bankr.space — that fetch crashed Bun with "fetch() did not return a Response".
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const x402BaseUrl = process.env.NEXT_PUBLIC_X402_SPACE_FUND_URL?.trim();

  if (!x402BaseUrl) {
    return NextResponse.json({ error: 'x402 fundraising is not configured' }, { status: 503 });
  }

  let body: { campaignId?: string; amountUsd?: number; xPayment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const campaignId = String(body.campaignId || 'dex-profile').trim() as CampaignId;
  const amountUsd = Number(body.amountUsd);
  const xPayment = typeof body.xPayment === 'string' ? body.xPayment.trim() : '';

  if (!CAMPAIGN_IDS.includes(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 });
  }

  const fundUrl = buildSpaceFundUrl(x402BaseUrl, tokenAddress, campaignId, amountUsd);
  const headers: HeadersInit = { Accept: 'application/json' };
  if (xPayment) {
    headers['X-PAYMENT'] = xPayment;
    headers['Access-Control-Expose-Headers'] = 'X-PAYMENT-RESPONSE';
  }

  try {
    const upstream = await fetch(fundUrl, { headers, cache: 'no-store' });
    const text = await upstream.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = { error: text.slice(0, 200) || 'Non-JSON response from x402' };
    }

    if (!xPayment && upstream.status === 402) {
      return NextResponse.json({ requiresPayment: true, ...data }, { status: 200 });
    }

    if (!xPayment) {
      return NextResponse.json(data, { status: upstream.status });
    }

    if (upstream.status >= 400) {
      const err =
        typeof data.error === 'string'
          ? data.error
          : `x402 payment failed (${upstream.status})`;
      console.error('x402 upstream error', upstream.status, data);
      return NextResponse.json({ error: err }, { status: upstream.status });
    }

    // Legacy handler credited KV (raisedUsd > 0). New handler returns raisedUsd: 0 — credit below.
    const handlerCredited =
      data.success === true &&
      Number(data.raisedUsd) > 0 &&
      Number(data.goalUsd) > 0;
    if (handlerCredited) {
      return NextResponse.json(data, { status: 200 });
    }

    const credit = await applyFundraisingCredit(
      tokenAddress,
      campaignId,
      SPACE_FUND_X402_MAX_USDC
    );

    if (!credit.success) {
      console.error('x402 credit after payment', credit.error);
      return NextResponse.json(
        {
          error:
            credit.error ||
            'USDC payment succeeded but crediting the goal failed. Contact the space operator.',
          paymentTaken: true,
        },
        { status: credit.status >= 500 ? 502 : credit.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Thank you — $${SPACE_FUND_X402_MAX_USDC} USDC credited toward ${campaignId}`,
      token: tokenAddress,
      campaignId,
      raisedUsd: credit.raisedUsd,
      goalUsd: credit.goalUsd,
      funded: credit.funded,
      spaceUrl: `https://www.bankr.space/community/${tokenAddress}`,
    });
  } catch (err) {
    console.error('x402 proxy', err);
    return NextResponse.json({ error: 'Failed to complete x402 payment' }, { status: 502 });
  }
}
