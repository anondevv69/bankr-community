import { NextResponse } from 'next/server';
import { getCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { completedCampaigns, openCampaigns } from '@/lib/fundraising';
import {
  isAgentPoolCampaignFunded,
  matchedAgentPoolCampaigns,
  openAgentPoolCampaigns,
  readStoredAgentPool,
} from '@/lib/agent-pool';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { communityUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

/**
 * List spaces that opted in to the platform agent (for cron / worker).
 * Protected by CRON_SECRET when set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const communities = await getCommunities();
    const platformWallet = getPlatformAgentWallet();

    const spaces = communities
      .filter((c) => c.usePlatformAgent && c.verified)
      .map((c) => {
        const normalized = mergeCommunityDefaults(c);
        const beneficiaryOpen = openCampaigns(normalized.fundraising);
        const beneficiaryFunded = completedCampaigns(normalized.fundraising);
        const pool = readStoredAgentPool(normalized.agentPool);
        const poolOpen = openAgentPoolCampaigns(pool);
        const poolReady = matchedAgentPoolCampaigns(pool);
        const canExecuteSkills = !!normalized.platformAgentSkills;

        return {
          tokenAddress: normalized.tokenAddress,
          symbol: normalized.symbol,
          communityLink: communityUrl(normalized.tokenAddress),
          platformAgentSkills: canExecuteSkills,
          feeRecipientWallet: normalized.ownerWallet,
          blockedKeywords: normalized.blockedKeywords ?? [],
          /** Lane A — beneficiary fundraisers (x402 → fee recipient). */
          openFundraisers: beneficiaryOpen.map((campaign) => ({
            lane: 'beneficiary' as const,
            id: campaign.id,
            label: campaign.label,
            raisedUsd: campaign.raisedUsd,
            goalUsd: campaign.goalUsd,
            remainingUsd: Math.max(
              0,
              Math.round((campaign.goalUsd - campaign.raisedUsd) * 100) / 100
            ),
          })),
          fundedCampaigns: beneficiaryFunded.map((campaign) => ({
            lane: 'beneficiary' as const,
            id: campaign.id,
            label: campaign.label,
            raisedUsd: campaign.raisedUsd,
            goalUsd: campaign.goalUsd,
            matched: true,
            readyForSkillExecution: canExecuteSkills,
          })),
          /** Lane B — community agent pool (x402 → platform agent wallet). */
          agentPool: {
            open: poolOpen.map((campaign) => ({
              skillId: campaign.skillId,
              label: campaign.label,
              raisedUsd: campaign.raisedUsd,
              goalUsd: campaign.goalUsd,
              remainingUsd: Math.max(
                0,
                Math.round((campaign.goalUsd - campaign.raisedUsd) * 100) / 100
              ),
            })),
            readyForExecution: poolReady.map((campaign) => ({
              skillId: campaign.skillId,
              label: campaign.label,
              raisedUsd: campaign.raisedUsd,
              goalUsd: campaign.goalUsd,
              matched: isAgentPoolCampaignFunded(campaign),
              readyForSkillExecution: canExecuteSkills,
              spendFrom: 'platform-agent-wallet' as const,
            })),
          },
        };
      });

    return NextResponse.json({
      platformAgentWallet: platformWallet,
      moneyRules: {
        laneA: 'x402 → fee recipient',
        laneB: 'x402 → platform agent wallet (community pool)',
      },
      count: spaces.length,
      spaces,
    });
  } catch (err) {
    console.error('GET /api/agent/platform-spaces', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
