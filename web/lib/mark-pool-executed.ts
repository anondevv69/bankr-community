import { getCommunities, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { AGENT_POOL_SKILL_IDS, readStoredAgentPool } from '@/lib/agent-pool';
import { normalizeAddr } from '@/lib/utils';
import type { AgentPoolSkillId } from '@/lib/types';

export async function markAgentPoolExecuted(input: {
  tokenAddress: string;
  skillId: AgentPoolSkillId;
  executionNote?: string | null;
  executionTxHash?: string | null;
  oxworkTaskId?: number | null;
}): Promise<boolean> {
  const tokenAddress = normalizeAddr(input.tokenAddress);
  const skillId = input.skillId;

  if (!AGENT_POOL_SKILL_IDS.includes(skillId)) return false;

  const communities = await getCommunities();
  const index = communities.findIndex(
    (c) => c.tokenAddress.toLowerCase() === tokenAddress
  );
  if (index === -1) return false;

  const current = mergeCommunityDefaults(communities[index]);
  const pool = readStoredAgentPool(current.agentPool);
  const campaign = pool.campaigns.find((c) => c.skillId === skillId);
  if (!campaign || campaign.executedAt) return false;

  const updatedPool = {
    ...pool,
    campaigns: pool.campaigns.map((c) =>
      c.skillId === skillId
        ? {
            ...c,
            executedAt: Date.now(),
            executionNote: input.executionNote?.slice(0, 500) ?? c.executionNote,
            executionTxHash:
              input.executionTxHash?.slice(0, 66) ?? c.executionTxHash ?? null,
            oxworkTaskId: input.oxworkTaskId ?? c.oxworkTaskId ?? null,
            jobLinkedAt:
              input.oxworkTaskId != null ? c.jobLinkedAt ?? Date.now() : c.jobLinkedAt,
          }
        : c
    ),
  };

  communities[index] = mergeCommunityDefaults({
    ...current,
    agentPool: updatedPool,
  });
  await setCommunities(communities);
  return true;
}
