import { NextResponse } from 'next/server';
import { getCommunities, getCommunity, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { resolveSpacePermissions } from '@/lib/community-owner';
import {
  AGENT_POOL_SKILL_IDS,
  applyCommunityAgentProposal,
  readStoredAgentPool,
} from '@/lib/agent-pool';
import {
  assertCanOpenAgentPoolGoal,
  isAgentPoolCampaignLocked,
} from '@/lib/fundraiser-locks';
import { normalizeAddr } from '@/lib/utils';
import type { AgentPoolSkillId } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

/**
 * Holders propose community agent pool goals (Lane B) — separate from beneficiary fundraisers.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const wallet = req.headers.get('x-wallet-address')?.trim().toLowerCase();

  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'x-wallet-address header required' }, { status: 401 });
  }

  let body: { skillId?: string; goalUsd?: number; workBrief?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const skillId = String(body.skillId || '').toLowerCase() as AgentPoolSkillId;
  const goalUsd = Number(body.goalUsd);

  if (!AGENT_POOL_SKILL_IDS.includes(skillId)) {
    return NextResponse.json({ error: 'skillId must be qrcoin or 0xwork' }, { status: 400 });
  }
  if (!Number.isFinite(goalUsd) || goalUsd < 1) {
    return NextResponse.json({ error: 'goalUsd must be at least 1' }, { status: 400 });
  }

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const permissions = await resolveSpacePermissions(wallet, tokenAddress);
    if (!permissions.canProposeCommunityAgentGoal) {
      return NextResponse.json(
        {
          error:
            'Only verified token holders can propose community agent goals when the Bankr Space Agent is enabled.',
        },
        { status: 403 }
      );
    }

    const communities = await getCommunities();
    const index = communities.findIndex(
      (c) => c.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const current = mergeCommunityDefaults(communities[index]);
    const storedPool = readStoredAgentPool(current.agentPool);
    const existing = storedPool.campaigns.find((c) => c.skillId === skillId);

    const openConflict = assertCanOpenAgentPoolGoal(current.agentPool, skillId);
    if (openConflict) {
      return NextResponse.json({ error: openConflict }, { status: 400 });
    }

    if (existing && isAgentPoolCampaignLocked(existing)) {
      if (goalUsd < existing.raisedUsd) {
        return NextResponse.json(
          {
            error: `Goal cannot be lowered below $${existing.raisedUsd} already raised.`,
          },
          { status: 400 }
        );
      }
    }

    const nextPool = applyCommunityAgentProposal(current.agentPool, {
      skillId,
      goalUsd,
      workBrief: body.workBrief,
      label: body.label,
      proposedBy: wallet,
    });

    communities[index] = mergeCommunityDefaults({
      ...current,
      agentPool: nextPool,
    });
    await setCommunities(communities);

    const campaign = nextPool.campaigns.find((c) => c.skillId === skillId)!;

    return NextResponse.json({
      success: true,
      message: 'Community agent goal proposed — holders can fund it now.',
      campaign,
      lane: 'community-agent',
    });
  } catch (err) {
    console.error('POST agent-pool/propose', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
