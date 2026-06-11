import type {
  AgentPoolCampaign,
  AgentPoolSkillId,
  AgentPoolState,
  FundraisingCampaign,
  FundraisingState,
} from './types';
import { isCampaignFunded, readStoredFundraising } from './fundraising';
import {
  isAgentPoolCampaignFunded,
  openAgentPoolCampaigns,
  readStoredAgentPool,
} from './agent-pool';

export function isGoalFunded(raisedUsd: number, goalUsd: number): boolean {
  return goalUsd > 0 && raisedUsd >= goalUsd;
}

/** Active fundraiser with contributions — cannot be closed until goal is met. */
export function isFundraiserLocked(
  raisedUsd: number,
  goalUsd: number,
  enabled: boolean
): boolean {
  return enabled && raisedUsd > 0 && !isGoalFunded(raisedUsd, goalUsd);
}

export function isBeneficiaryCampaignLocked(campaign: FundraisingCampaign): boolean {
  return isFundraiserLocked(campaign.raisedUsd, campaign.goalUsd, campaign.enabled);
}

export function isAgentPoolCampaignLocked(campaign: AgentPoolCampaign): boolean {
  return isFundraiserLocked(campaign.raisedUsd, campaign.goalUsd, campaign.enabled);
}

export type FundraiserSaveResult =
  | { ok: true; campaigns: FundraisingCampaign[] }
  | { ok: false; error: string; status: number };

export function applyBeneficiaryFundraisingSave(
  stored: FundraisingState | undefined | null,
  incomingCampaigns: FundraisingCampaign[]
): FundraiserSaveResult {
  const prev = readStoredFundraising(stored);
  const campaigns: FundraisingCampaign[] = [];

  for (const inc of incomingCampaigns) {
    const was = prev.campaigns.find((c) => c.id === inc.id);
    if (!was) continue;

    let enabled = Boolean(inc.enabled);
    const goalUsd = Number(inc.goalUsd);
    const label = String(inc.label || was.label).slice(0, 80);
    const raisedUsd = was.raisedUsd;

    if (isFundraiserLocked(was.raisedUsd, was.goalUsd, was.enabled)) {
      if (!enabled) {
        return {
          ok: false,
          error: `Cannot close "${was.label}" — $${was.raisedUsd.toLocaleString()} USDC already contributed. Finish the goal or wait until it is met.`,
          status: 400,
        };
      }
      enabled = true;
      if (!Number.isFinite(goalUsd) || goalUsd < was.raisedUsd) {
        return {
          ok: false,
          error: `Goal for "${was.label}" cannot be below $${was.raisedUsd.toLocaleString()} already raised.`,
          status: 400,
        };
      }
    }

    campaigns.push({
      ...was,
      enabled,
      goalUsd: Number.isFinite(goalUsd) && goalUsd >= 1 ? goalUsd : was.goalUsd,
      label,
      raisedUsd,
    });
  }

  const open = campaigns.filter((c) => c.enabled && !isCampaignFunded(c));
  if (open.length > 1) {
    return {
      ok: false,
      error:
        'Only one beneficiary fundraiser can be open at a time. Close or complete the other goal first (goals with contributions cannot be closed).',
      status: 400,
    };
  }

  const lockedOpen = open.find((c) => isBeneficiaryCampaignLocked(c));
  if (lockedOpen && open.length === 1 && open[0].id !== lockedOpen.id) {
    // unreachable if only one open
  }

  return { ok: true, campaigns };
}

export type AgentPoolSaveResult =
  | { ok: true; campaigns: AgentPoolCampaign[] }
  | { ok: false; error: string; status: number };

export function applyAgentPoolAdminSave(
  stored: AgentPoolState | undefined | null,
  incomingCampaigns: AgentPoolCampaign[]
): AgentPoolSaveResult {
  const prev = readStoredAgentPool(stored);
  const campaigns: AgentPoolCampaign[] = [];

  for (const inc of incomingCampaigns) {
    const was = prev.campaigns.find((c) => c.skillId === inc.skillId);
    if (!was) continue;

    let enabled = Boolean(inc.enabled);
    const goalUsd = Number(inc.goalUsd);
    const raisedUsd = was.raisedUsd;

    if (isFundraiserLocked(was.raisedUsd, was.goalUsd, was.enabled)) {
      if (!enabled) {
        return {
          ok: false,
          error: `Cannot close "${was.label}" — $${was.raisedUsd.toLocaleString()} USDC already contributed to the community agent pool.`,
          status: 400,
        };
      }
      enabled = true;
      if (!Number.isFinite(goalUsd) || goalUsd < was.raisedUsd) {
        return {
          ok: false,
          error: `Goal cannot be below $${was.raisedUsd.toLocaleString()} already raised.`,
          status: 400,
        };
      }
    }

    campaigns.push({
      ...was,
      ...inc,
      enabled,
      goalUsd: Number.isFinite(goalUsd) && goalUsd >= 1 ? goalUsd : was.goalUsd,
      raisedUsd,
      workBrief: inc.skillId === '0xwork' ? inc.workBrief : was.workBrief,
    });
  }

  const open = campaigns.filter((c) => c.enabled && !isAgentPoolCampaignFunded(c));
  if (open.length > 1) {
    return {
      ok: false,
      error:
        'Only one community agent goal can be open at a time. Complete or close the other first (goals with contributions cannot be closed).',
      status: 400,
    };
  }

  return { ok: true, campaigns };
}

/** Block starting a second open community agent goal. */
export function assertCanOpenAgentPoolGoal(
  pool: AgentPoolState | undefined | null,
  skillId: AgentPoolSkillId
): string | null {
  const stored = readStoredAgentPool(pool);
  const open = openAgentPoolCampaigns(stored);
  const other = open.filter((c) => c.skillId !== skillId);
  if (other.length > 0) {
    const active = other[0];
    return `Only one community agent goal can be open at a time. "${active.label}" is still active ($${active.raisedUsd.toLocaleString()} / $${active.goalUsd.toLocaleString()}).`;
  }
  return null;
}

export function assertCanOpenBeneficiaryCampaign(
  stored: FundraisingState | undefined | null,
  campaignId: string,
  enabling: boolean
): string | null {
  if (!enabling) return null;
  const prev = readStoredFundraising(stored);
  const open = prev.campaigns.filter((c) => c.enabled && !isCampaignFunded(c));
  const other = open.filter((c) => c.id !== campaignId);
  if (other.length === 0) return null;
  const active = other[0];
  if (active.raisedUsd > 0 || isBeneficiaryCampaignLocked(active)) {
    return `Only one fundraiser can be open at a time. "${active.label}" has active contributions and cannot be closed until the goal is met.`;
  }
  return null;
}
