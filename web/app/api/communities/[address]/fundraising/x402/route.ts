import { NextResponse } from 'next/server';
import { buildSpaceFundUrl } from '@/lib/fundraising';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

/**
 * Same-origin proxy for Bankr x402 space-fund. Browsers cannot send X-PAYMENT
 * cross-origin to x402.bankr.bot (CORS preflight fails on 402).
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

  const campaignId = String(body.campaignId || 'dex-profile').trim();
  const amountUsd = Number(body.amountUsd);
  const xPayment = typeof body.xPayment === 'string' ? body.xPayment.trim() : '';

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

    // Quote step: return 200 so the browser does not log a red 402 on every Contribute click.
    if (!xPayment && upstream.status === 402) {
      return NextResponse.json({ requiresPayment: true, ...data }, { status: 200 });
    }

    if (upstream.status >= 400) {
      console.error('x402 upstream error', upstream.status, data);
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error('x402 proxy', err);
    return NextResponse.json({ error: 'Failed to reach x402 endpoint' }, { status: 502 });
  }
}
