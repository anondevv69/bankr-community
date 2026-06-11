import { NextResponse } from 'next/server';
import { getCommunity, getCommunities, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { migrateLegacyPoidhAgentPool } from '@/lib/agent-pool-legacy-poidh';
import {
  bountyPublicUrl,
  bountyDescriptionForDisplay,
  POIDH_BOUNTY_GUIDE_URL,
  pendingPoidhBounties,
} from '@/lib/poidh-community-bounties';
import {
  poidhSpinUpSummary,
  spinUpPoidhBountiesForCommunity,
} from '@/lib/poidh-bounty-spinup';
import { fetchPoidhBountyById } from '@/lib/poidh-api';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const trySpinUp = new URL(req.url).searchParams.get('spinUp') === '1';

  try {
    let community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const migrated = migrateLegacyPoidhAgentPool(community);
    if (migrated.changed) {
      const communities = await getCommunities();
      const idx = communities.findIndex(
        (c) => c.tokenAddress.toLowerCase() === tokenAddress
      );
      if (idx !== -1) {
        communities[idx] = migrated.community;
        await setCommunities(communities);
      }
      community = migrated.community;
    }

    let merged = mergeCommunityDefaults(community);
    const hasPending = pendingPoidhBounties(merged.poidhBounties).length > 0;

    if (trySpinUp && hasPending && !merged.poidhBounties?.bankrAgentJobId) {
      await spinUpPoidhBountiesForCommunity(merged, { maxBounties: 1 });
      const refreshed = await getCommunity(tokenAddress);
      if (refreshed) merged = mergeCommunityDefaults(refreshed);
    }

    const state = merged.poidhBounties;
    const spinUp = poidhSpinUpSummary(state);

    const bounties = await Promise.all(
      (state?.bounties ?? []).map(async (b) => {
        let amountWei: string | null = null;
        if (b.poidhBountyId != null) {
          const onChain = await fetchPoidhBountyById(b.poidhBountyId).catch(() => null);
          amountWei = onChain?.amountWei.toString() ?? null;
        }
        const live = b.poidhBountyId != null;
        return {
          id: b.id,
          kind: b.kind,
          title: b.title,
          description: bountyDescriptionForDisplay(b.description),
          status: live ? 'live' : 'pending',
          poidhBountyId: b.poidhBountyId,
          url: bountyPublicUrl(b),
          amountWei,
          requestedBy: b.requestedBy,
          createdAt: b.createdAt,
        };
      })
    );

    return NextResponse.json({
      bounties,
      total: bounties.length,
      symbol: merged.symbol,
      enabled: state?.enabled !== false,
      spinUp,
      links: {
        poidh: 'https://poidh.xyz/base',
        openBountyGuide: POIDH_BOUNTY_GUIDE_URL,
        skill: 'https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md',
      },
    });
  } catch (err) {
    console.error('GET poidh', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
