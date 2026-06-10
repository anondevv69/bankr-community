import type { FundraisingCampaign, FundraisingState } from './types';

export const CAMPAIGN_IDS = ['dex-profile', 'dex-boost', 'custom'] as const;
export type CampaignId = (typeof CAMPAIGN_IDS)[number];

export const DEFAULT_CAMPAIGNS: FundraisingCampaign[] = [
  {
    id: 'dex-profile',
    label: 'Enhanced DexScreener profile',
    goalUsd: 299,
    raisedUsd: 0,
    enabled: false,
  },
  {
    id: 'dex-boost',
    label: 'DexScreener boost',
    goalUsd: 99,
    raisedUsd: 0,
    enabled: false,
  },
  {
    id: 'custom',
    label: 'Community goal',
    goalUsd: 500,
    raisedUsd: 0,
    enabled: false,
  },
];

function mergeCampaigns(raw: FundraisingState | null | undefined): FundraisingCampaign[] {
  const byId = new Map<CampaignId, FundraisingCampaign>();

  for (const defaults of DEFAULT_CAMPAIGNS) {
    byId.set(defaults.id, { ...defaults });
  }

  if (raw && Array.isArray(raw.campaigns)) {
    for (const item of raw.campaigns) {
      if (!item || typeof item !== 'object') continue;
      const id = String((item as FundraisingCampaign).id || '') as CampaignId;
      if (!CAMPAIGN_IDS.includes(id)) continue;
      const current = byId.get(id)!;
      byId.set(id, {
        id,
        label: String((item as FundraisingCampaign).label || current.label).slice(0, 80),
        goalUsd: clampGoal((item as FundraisingCampaign).goalUsd ?? current.goalUsd),
        raisedUsd: clampRaised((item as FundraisingCampaign).raisedUsd ?? 0),
        enabled: Boolean((item as FundraisingCampaign).enabled),
      });
    }
  }

  return CAMPAIGN_IDS.map((id) => byId.get(id)!);
}

/**
 * Normalize fundraising from stored community data or beneficiary save payload.
 * @param fromSave When true (PATCH from Edit profile), sets optedIn from checkbox state.
 */
export function normalizeFundraising(
  input: unknown,
  options?: { fromSave?: boolean }
): FundraisingState {
  const raw = input && typeof input === 'object' ? (input as FundraisingState) : null;
  const campaigns = mergeCampaigns(raw);

  if (options?.fromSave) {
    const optedIn = campaigns.some((c) => c.enabled);
    return { optedIn, campaigns };
  }

  const optedIn = Boolean(raw?.optedIn);
  if (!optedIn) {
    // Legacy rows may have enabled:true from an old default — hide until beneficiary opts in.
    return {
      optedIn: false,
      campaigns: campaigns.map((c) => ({ ...c, enabled: false })),
    };
  }

  return { optedIn: true, campaigns };
}

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

/** Read fundraising as stored in KV — no display-only optedIn mask. */
export function readStoredFundraising(input: unknown): FundraisingState {
  const raw = input && typeof input === 'object' ? (input as FundraisingState) : null;
  return {
    optedIn: Boolean(raw?.optedIn),
    campaigns: mergeCampaigns(raw),
  };
}

export function activeCampaigns(state: FundraisingState | undefined | null): FundraisingCampaign[] {
  if (!state?.optedIn) return [];
  return state.campaigns.filter((c) => c.enabled);
}

export function hasPublicFundraising(state: FundraisingState | undefined | null): boolean {
  return activeCampaigns(state).length > 0;
}

export function campaignProgress(campaign: FundraisingCampaign): number {
  if (campaign.goalUsd <= 0) return 0;
  return Math.min(100, (campaign.raisedUsd / campaign.goalUsd) * 100);
}

export function creditCampaignUsd(
  state: FundraisingState,
  campaignId: CampaignId,
  amountUsd: number
): FundraisingState {
  const amount = clampRaised(amountUsd);
  if (amount <= 0) return state;

  return {
    ...state,
    campaigns: state.campaigns.map((c) =>
      c.id === campaignId ? { ...c, raisedUsd: clampRaised(c.raisedUsd + amount) } : c
    ),
  };
}

export function buildSpaceFundUrl(
  baseUrl: string,
  tokenAddress: string,
  campaignId: string,
  amountUsd: number
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('token', tokenAddress.toLowerCase());
  url.searchParams.set('campaign', campaignId);
  url.searchParams.set('amount', String(amountUsd));
  return url.toString();
}
