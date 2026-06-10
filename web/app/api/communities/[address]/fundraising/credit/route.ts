import { NextResponse } from 'next/server';
import { getCommunities, setCommunities, getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  CAMPAIGN_IDS,
  creditCampaignUsd,
  readStoredFundraising,
  type CampaignId,
} from '@/lib/fundraising';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

function authorizeWebhook(req: Request): boolean {
  const secret = process.env.X402_FUND_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request, { params }: RouteParams) {
  if (!authorizeWebhook(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));
  const campaignId = String(body.campaignId || body.campaign || '').trim() as CampaignId;
  const amountUsd = Number(body.amountUsd ?? body.amount);

  if (!CAMPAIGN_IDS.includes(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'amountUsd must be positive' }, { status: 400 });
  }

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const communities = await getCommunities();
    const index = communities.findIndex(
      (item) => item.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const stored = readStoredFundraising(communities[index].fundraising);
    const campaign = stored.campaigns.find((c) => c.id === campaignId);
    if (!campaign?.enabled) {
      return NextResponse.json(
        {
          error:
            'Campaign is not enabled for this space. Beneficiary must enable fundraising in Edit profile.',
        },
        { status: 400 }
      );
    }

    const nextFundraising = creditCampaignUsd(stored, campaignId, amountUsd);
    const updated = mergeCommunityDefaults({
      ...mergeCommunityDefaults(communities[index]),
      fundraising: nextFundraising,
    });

    communities[index] = updated;
    await setCommunities(communities);

    const credited = updated.fundraising!.campaigns.find((c) => c.id === campaignId)!;

    return NextResponse.json({
      success: true,
      tokenAddress,
      campaignId,
      creditedUsd: amountUsd,
      raisedUsd: credited.raisedUsd,
      goalUsd: credited.goalUsd,
      funded: credited.raisedUsd >= credited.goalUsd,
      txRef: body.txRef || null,
    });
  } catch (err) {
    console.error('POST fundraising credit', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
