import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  agentPoolCampaignProgress,
  isAgentPoolCampaignFunded,
  openAgentPoolCampaigns,
  readStoredAgentPool,
} from '@/lib/agent-pool';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { buildFundraisingX402BaseUrl } from '@/lib/x402-fund-url';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const merged = mergeCommunityDefaults(community);
    const pool = readStoredAgentPool(merged.agentPool);
    const open = openAgentPoolCampaigns(pool);
    const platformWallet = getPlatformAgentWallet();
    const x402BaseUrl = buildFundraisingX402BaseUrl(platformWallet);

    const campaigns = open.map((c) => ({
      ...c,
      skillId: c.skillId,
      progressPct: agentPoolCampaignProgress(c),
      remainingUsd: Math.max(0, Math.round((c.goalUsd - c.raisedUsd) * 100) / 100),
      funded: isAgentPoolCampaignFunded(c),
      x402CampaignId: `agent-${c.skillId}`,
    }));

    return NextResponse.json({
      tokenAddress,
      symbol: merged.symbol,
      usePlatformAgent: merged.usePlatformAgent,
      verified: merged.verified,
      platformAgentWallet: platformWallet,
      x402BaseUrl,
      x402PayTo: 'platform-agent',
      campaigns,
      count: campaigns.length,
    });
  } catch (err) {
    console.error('GET agent-pool', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
