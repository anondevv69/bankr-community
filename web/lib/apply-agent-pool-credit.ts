import { getCommunities, getCommunity, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  AGENT_POOL_SKILL_IDS,
  creditAgentPoolUsd,
  isAgentPoolCampaignFunded,
  readStoredAgentPool,
} from '@/lib/agent-pool';
import type { AgentPoolSkillId } from '@/lib/types';
import { normalizeAddr } from '@/lib/utils';

export type ApplyAgentPoolCreditResult =
  | {
      success: true;
      tokenAddress: string;
      skillId: AgentPoolSkillId;
      creditedUsd: number;
      raisedUsd: number;
      goalUsd: number;
      funded: boolean;
    }
  | { success: false; error: string; status: number };

export async function applyAgentPoolCredit(
  tokenAddress: string,
  skillId: AgentPoolSkillId,
  amountUsd: number
): Promise<ApplyAgentPoolCreditResult> {
  const normalized = normalizeAddr(tokenAddress);

  if (!AGENT_POOL_SKILL_IDS.includes(skillId)) {
    return { success: false, error: 'Invalid agent pool skillId', status: 400 };
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { success: false, error: 'amountUsd must be positive', status: 400 };
  }

  const community = await getCommunity(normalized);
  if (!community) {
    return { success: false, error: 'Space not found', status: 404 };
  }

  const merged = mergeCommunityDefaults(community);
  if (!merged.usePlatformAgent) {
    return {
      success: false,
      error: 'Bankr Space Agent is not enabled on this space.',
      status: 400,
    };
  }
  if (!merged.verified) {
    return {
      success: false,
      error: 'Space must be verified before funding the community agent pool.',
      status: 400,
    };
  }

  const communities = await getCommunities();
  const index = communities.findIndex(
    (item) => item.tokenAddress.toLowerCase() === normalized
  );
  if (index === -1) {
    return { success: false, error: 'Space not found', status: 404 };
  }

  const stored = readStoredAgentPool(communities[index].agentPool);
  const campaign = stored.campaigns.find((c) => c.skillId === skillId);
  if (!campaign?.enabled) {
    return {
      success: false,
      error:
        'This community agent goal is not enabled. Enable it in Edit profile → Community agent pool.',
      status: 400,
    };
  }
  if (isAgentPoolCampaignFunded(campaign)) {
    return {
      success: false,
      error: 'This community agent goal is already fully funded.',
      status: 400,
    };
  }

  const nextPool = creditAgentPoolUsd(stored, skillId, amountUsd);
  const updated = mergeCommunityDefaults({
    ...mergeCommunityDefaults(communities[index]),
    agentPool: nextPool,
  });

  communities[index] = updated;
  await setCommunities(communities);

  const credited = updated.agentPool!.campaigns.find((c) => c.skillId === skillId)!;

  return {
    success: true,
    tokenAddress: normalized,
    skillId,
    creditedUsd: amountUsd,
    raisedUsd: credited.raisedUsd,
    goalUsd: credited.goalUsd,
    funded: credited.raisedUsd >= credited.goalUsd,
  };
}
