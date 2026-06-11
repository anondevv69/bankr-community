import { NextResponse } from 'next/server';
import { applyAgentPoolCredit } from '@/lib/apply-agent-pool-credit';
import { agentPoolX402CampaignId, parseAgentPoolX402CampaignId } from '@/lib/agent-pool';
import { buildSpaceFundUrl } from '@/lib/fundraising';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { buildFundraisingX402BaseUrl } from '@/lib/x402-fund-url';
import { SPACE_FUND_X402_MAX_USDC } from '@/lib/x402-pay';
import { normalizeAddr } from '@/lib/utils';
import type { AgentPoolSkillId } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

/**
 * Lane B x402 — USDC settles to PLATFORM_AGENT_WALLET; credits agentPool on bankr.space.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const platformWallet = getPlatformAgentWallet();
  const x402BaseUrl = buildFundraisingX402BaseUrl(platformWallet);

  if (!x402BaseUrl) {
    return NextResponse.json(
      { error: 'Community agent pool unavailable — PLATFORM_AGENT_WALLET not configured' },
      { status: 503 }
    );
  }

  let body: { skillId?: string; campaignId?: string; amountUsd?: number; xPayment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let skillId = (body.skillId?.trim().toLowerCase() || '') as AgentPoolSkillId;
  if (!skillId && body.campaignId) {
    skillId = parseAgentPoolX402CampaignId(body.campaignId) as AgentPoolSkillId;
  }
  const amountUsd = Number(body.amountUsd);
  const xPayment = typeof body.xPayment === 'string' ? body.xPayment.trim() : '';

  if (!skillId) {
    return NextResponse.json({ error: 'skillId or agent-* campaignId required' }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 });
  }

  const fundUrl = buildSpaceFundUrl(
    x402BaseUrl,
    tokenAddress,
    agentPoolX402CampaignId(skillId),
    amountUsd
  );
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
      console.error('agent-pool x402 upstream error', upstream.status, data);
      return NextResponse.json({ error: err }, { status: upstream.status });
    }

    const credit = await applyAgentPoolCredit(
      tokenAddress,
      skillId,
      SPACE_FUND_X402_MAX_USDC
    );

    if (!credit.success) {
      console.error('agent-pool credit after payment', credit.error);
      return NextResponse.json(
        {
          error:
            credit.error ||
            'USDC payment succeeded but crediting the agent pool failed. Contact support.',
          paymentTaken: true,
        },
        { status: credit.status >= 500 ? 502 : credit.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Thank you — $${SPACE_FUND_X402_MAX_USDC} USDC credited toward community agent ${skillId}`,
      token: tokenAddress,
      skillId,
      raisedUsd: credit.raisedUsd,
      goalUsd: credit.goalUsd,
      funded: credit.funded,
      payTo: platformWallet,
      spaceUrl: `https://www.bankr.space/community/${tokenAddress}`,
    });
  } catch (err) {
    console.error('agent-pool x402 proxy', err);
    return NextResponse.json({ error: 'Failed to complete x402 payment' }, { status: 502 });
  }
}
