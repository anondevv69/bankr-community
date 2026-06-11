import type { AgentPoolCampaign, AgentPoolSkillId, AgentPoolState } from './types';

export const AGENT_POOL_SKILL_IDS: AgentPoolSkillId[] = ['qrcoin', '0xwork'];

export const AGENT_POOL_SKILL_META: Record<
  AgentPoolSkillId,
  { label: string; defaultGoalUsd: number; description: string }
> = {
  qrcoin: {
    label: 'QRCoin — QR listing for this space',
    defaultGoalUsd: 50,
    description: 'Agent places a qrcoin.fun bid with your space URL when funded.',
  },
  '0xwork': {
    label: '0xWork — bagwork & bounties',
    defaultGoalUsd: 200,
    description: 'Agent posts paid tasks (tweets, art, banner) on 0xWork when funded.',
  },
};

export const DEFAULT_AGENT_POOL_CAMPAIGNS: AgentPoolCampaign[] = AGENT_POOL_SKILL_IDS.map(
  (skillId) => ({
    skillId,
    label: AGENT_POOL_SKILL_META[skillId].label,
    goalUsd: AGENT_POOL_SKILL_META[skillId].defaultGoalUsd,
    raisedUsd: 0,
    enabled: false,
    executedAt: null,
    executionNote: null,
  })
);

function clampGoal(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.round(n * 100) / 100, 1_000_000);
}

function clampRaised(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function mergeCampaigns(raw: AgentPoolState | null | undefined): AgentPoolCampaign[] {
  const bySkill = new Map<AgentPoolSkillId, AgentPoolCampaign>();
  for (const defaults of DEFAULT_AGENT_POOL_CAMPAIGNS) {
    bySkill.set(defaults.skillId, { ...defaults });
  }
  if (raw && Array.isArray(raw.campaigns)) {
    for (const item of raw.campaigns) {
      if (!item || typeof item !== 'object') continue;
      const skillId = String((item as AgentPoolCampaign).skillId || '') as AgentPoolSkillId;
      if (!AGENT_POOL_SKILL_IDS.includes(skillId)) continue;
      const current = bySkill.get(skillId)!;
      bySkill.set(skillId, {
        skillId,
        label: String((item as AgentPoolCampaign).label || current.label).slice(0, 120),
        goalUsd: clampGoal((item as AgentPoolCampaign).goalUsd ?? current.goalUsd),
        raisedUsd: clampRaised((item as AgentPoolCampaign).raisedUsd ?? 0),
        enabled: Boolean((item as AgentPoolCampaign).enabled),
        executedAt:
          (item as AgentPoolCampaign).executedAt != null
            ? Number((item as AgentPoolCampaign).executedAt)
            : null,
        executionNote:
          (item as AgentPoolCampaign).executionNote != null
            ? String((item as AgentPoolCampaign).executionNote).slice(0, 500)
            : null,
      });
    }
  }
  return AGENT_POOL_SKILL_IDS.map((id) => bySkill.get(id)!);
}

export function normalizeAgentPool(input: unknown, options?: { fromSave?: boolean }): AgentPoolState {
  const raw = input && typeof input === 'object' ? (input as AgentPoolState) : null;
  const campaigns = mergeCampaigns(raw);

  if (options?.fromSave) {
    return { optedIn: campaigns.some((c) => c.enabled), campaigns };
  }

  return {
    optedIn: Boolean(raw?.optedIn),
    campaigns,
  };
}

export function readStoredAgentPool(input: unknown): AgentPoolState {
  return normalizeAgentPool(input);
}

export function isAgentPoolCampaignFunded(campaign: AgentPoolCampaign): boolean {
  return campaign.goalUsd > 0 && campaign.raisedUsd >= campaign.goalUsd;
}

export function openAgentPoolCampaigns(state: AgentPoolState | undefined | null): AgentPoolCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter((c) => c.enabled && !isAgentPoolCampaignFunded(c));
}

export function matchedAgentPoolCampaigns(
  state: AgentPoolState | undefined | null
): AgentPoolCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter(
    (c) => c.enabled && isAgentPoolCampaignFunded(c) && !c.executedAt
  );
}

export function completedAgentPoolCampaigns(
  state: AgentPoolState | undefined | null
): AgentPoolCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter((c) => c.enabled && Boolean(c.executedAt));
}

export function hasPublicAgentPool(state: AgentPoolState | undefined | null): boolean {
  return openAgentPoolCampaigns(state).length > 0;
}

export function agentPoolCampaignProgress(campaign: AgentPoolCampaign): number {
  if (campaign.goalUsd <= 0) return 0;
  return Math.min(100, (campaign.raisedUsd / campaign.goalUsd) * 100);
}

export function creditAgentPoolUsd(
  state: AgentPoolState,
  skillId: AgentPoolSkillId,
  amountUsd: number
): AgentPoolState {
  const amount = clampRaised(amountUsd);
  if (amount <= 0) return state;
  return {
    ...state,
    optedIn: true,
    campaigns: state.campaigns.map((c) =>
      c.skillId === skillId ? { ...c, raisedUsd: clampRaised(c.raisedUsd + amount) } : c
    ),
  };
}

/** x402 campaign query param for agent pool credits (distinct from beneficiary campaigns). */
export function agentPoolX402CampaignId(skillId: AgentPoolSkillId): string {
  return `agent-${skillId}`;
}

export function parseAgentPoolX402CampaignId(
  campaignId: string
): AgentPoolSkillId | null {
  const id = campaignId.trim().toLowerCase();
  if (!id.startsWith('agent-')) return null;
  const skillId = id.slice('agent-'.length) as AgentPoolSkillId;
  return AGENT_POOL_SKILL_IDS.includes(skillId) ? skillId : null;
}
