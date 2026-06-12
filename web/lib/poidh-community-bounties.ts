import type { PoidhBountyKind, PoidhBountyState, PoidhCommunityBounty } from './types';
import { normalizePoidhBountyId, poidhBountyUrl, poidhDisplayBountyId } from './poidh-api';

export const POIDH_BOUNTY_GUIDE_URL = 'https://words.poidh.xyz/poidh-open-bounties-guide';

export function emptyPoidhBountyState(): PoidhBountyState {
  return {
    enabled: true,
    bounties: [],
    spinUpAt: null,
    bankrAgentJobId: null,
  };
}

function communityProofBlock(symbol: string, tokenAddress: string): string {
  const spaceUrl = `https://www.bankr.space/community/${tokenAddress.toLowerCase()}`;
  return [
    `Token: $${symbol.replace(/^\$/, '')}`,
    `Community: ${spaceUrl}`,
    '',
    'Claim on POIDH (poidh.xyz — link on bankr.space Bounties tab):',
    '1. Complete the task described above',
    '2. Submit a public proof link (tweet, screenshot/image URL, etc.) on POIDH',
    '3. Optional: also post in the community tab so funders can discuss',
    '',
    'POIDH handles payout: single funder pays out directly; multiple funders vote 48h.',
  ].join('\n');
}

function normalizeOneBounty(item: unknown): PoidhCommunityBounty | null {
  if (!item || typeof item !== 'object') return null;
  const b = item as PoidhCommunityBounty;
  const id = String(b.id || '').slice(0, 64);
  if (!id) return null;
  const legacyKinds: PoidhBountyKind[] = ['dex-profile', 'dex-boost', 'shoutout', 'community'];
  const kind = legacyKinds.includes(b.kind as PoidhBountyKind)
    ? (b.kind as PoidhBountyKind)
    : 'community';

  const onChainId = b.poidhBountyId != null ? Number(b.poidhBountyId) : null;

  return {
    id,
    kind,
    title: String(b.title || 'Community bounty').slice(0, 120),
    description: String(b.description || '').slice(0, 4000),
    poidhBountyId: onChainId,
    status:
      onChainId != null
        ? b.status === 'completed'
          ? 'completed'
          : 'live'
        : 'pending',
    requestedBy: b.requestedBy ? String(b.requestedBy).toLowerCase() : null,
    createdAt: Number(b.createdAt) || Date.now(),
    jobLinkedAt: b.jobLinkedAt != null ? Number(b.jobLinkedAt) : null,
    bankrAgentJobId: b.bankrAgentJobId ? String(b.bankrAgentJobId).slice(0, 80) : null,
  };
}

export function normalizePoidhBounties(input: unknown): PoidhBountyState {
  const raw = input && typeof input === 'object' ? (input as PoidhBountyState) : null;
  const bounties = Array.isArray(raw?.bounties)
    ? raw!.bounties.map(normalizeOneBounty).filter(Boolean)
    : [];

  return {
    enabled: raw?.enabled !== false,
    bounties: bounties as PoidhCommunityBounty[],
    spinUpAt: raw?.spinUpAt ?? null,
    bankrAgentJobId: raw?.bankrAgentJobId ?? null,
    lastSpinUpError: raw?.lastSpinUpError ? String(raw.lastSpinUpError).slice(0, 500) : null,
    lastSpinUpAt: raw?.lastSpinUpAt != null ? Number(raw.lastSpinUpAt) : null,
  };
}

export function pendingPoidhBounties(state: PoidhBountyState | undefined | null): PoidhCommunityBounty[] {
  if (!state?.enabled) return [];
  return state.bounties.filter(
    (b) => b.poidhBountyId == null && b.status !== 'completed'
  );
}

export function normalizePoidhBountyTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Collapse duplicate pending rows (same title) — keeps earliest request. Not agent memory; KV cleanup. */
export function dedupePendingPoidhBounties(state: PoidhBountyState): {
  state: PoidhBountyState;
  removed: number;
} {
  const onChain = state.bounties.filter((b) => b.poidhBountyId != null);
  const completed = state.bounties.filter(
    (b) => b.poidhBountyId == null && b.status === 'completed'
  );
  const pending = state.bounties.filter(
    (b) => b.poidhBountyId == null && b.status !== 'completed'
  );

  const byTitle = new Map<string, PoidhCommunityBounty>();
  let removed = 0;
  for (const b of pending) {
    const key = normalizePoidhBountyTitle(b.title);
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, b);
      continue;
    }
    if (b.createdAt < existing.createdAt) {
      byTitle.set(key, b);
    }
    removed += 1;
  }

  if (removed === 0) {
    return { state, removed: 0 };
  }

  const bounties = [...onChain, ...byTitle.values(), ...completed].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  return {
    state: {
      ...state,
      bounties,
      lastSpinUpError: removed > 0 ? null : state.lastSpinUpError,
    },
    removed,
  };
}

export function hasPendingPoidhTitle(
  state: PoidhBountyState | undefined | null,
  title: string
): boolean {
  const key = normalizePoidhBountyTitle(title);
  return pendingPoidhBounties(state).some(
    (b) => normalizePoidhBountyTitle(b.title) === key
  );
}

export function spaceBountiesTabUrl(tokenAddress: string): string {
  return `https://www.bankr.space/community/${tokenAddress.toLowerCase()}#bounties`;
}

/** Resolve stored bounty row from on-chain id, poidh.xyz display id (e.g. 1229), or title. */
export function resolveSpacePoidhBounty(
  state: PoidhBountyState | undefined | null,
  options: { bountyId?: number; title?: string }
): PoidhCommunityBounty | null {
  const bounties = state?.bounties ?? [];
  const rawId = Number(options.bountyId);
  if (Number.isFinite(rawId) && rawId > 0) {
    const onChain = normalizePoidhBountyId(rawId);
    const match = bounties.find(
      (b) =>
        b.poidhBountyId != null &&
        (b.poidhBountyId === rawId || b.poidhBountyId === onChain)
    );
    if (match) return match;
  }

  const titleQuery = String(options.title || '')
    .trim()
    .toLowerCase();
  if (!titleQuery) return null;

  return (
    bounties.find(
      (b) =>
        b.poidhBountyId != null &&
        b.title.toLowerCase().includes(titleQuery)
    ) ?? null
  );
}

export function bountyPublicUrl(bounty: PoidhCommunityBounty): string | null {
  if (bounty.poidhBountyId == null) return null;
  return poidhBountyUrl(bounty.poidhBountyId);
}

export function buildPoidhSpinUpPrompt(options: {
  symbol: string;
  tokenAddress: string;
  bounties: PoidhCommunityBounty[];
}): string {
  const skillUrl =
    'https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md';
  const tasks = options.bounties
    .map(
      (b) =>
        `- ID "${b.id}": title="${b.title}" | createOpenBounty | description:\n${b.description}`
    )
    .join('\n\n');

  return [
    `Use the poidh-bounty skill (${skillUrl}) on Base chain.`,
    'Create POIDH open bounties ONLY (createOpenBounty, not solo). Min seed 0.001 ETH each.',
    'Funding happens on POIDH (poidh.xyz) — bankr.space lists status and links.',
    `Token $${options.symbol.replace(/^\$/, '')}: ${options.tokenAddress}`,
    '',
    'Create these bounties:',
    tasks,
    '',
    'Return each template id, on-chain bounty id, and tx hash.',
    'Guide: https://words.poidh.xyz/poidh-open-bounties-guide',
  ].join('\n');
}

export function buildPoidhProposeClaimPrompt(options: {
  symbol: string;
  tokenAddress: string;
  bountyId: number;
  claimId: number;
  claimName: string;
  needsContributorVote?: boolean;
}): string {
  const skillUrl =
    'https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md';
  const finalize = options.needsContributorVote
    ? `Call submitClaimForVote(bountyId=${options.bountyId}, claimId=${options.claimId}). This starts a 48h contributor vote.`
    : `Call acceptClaim(bountyId=${options.bountyId}, claimId=${options.claimId}). Only the issuer funded this bounty — no vote needed.`;
  return [
    `Use the poidh-bounty skill (${skillUrl}) on Base chain.`,
    finalize,
    'Only the bounty issuer wallet may call this — use the platform agent wallet.',
    `Bounty: "${options.claimName}" for $${options.symbol.replace(/^\$/, '')} (${options.tokenAddress}).`,
    'Return tx hash and confirmation.',
  ].join('\n');
}

export function createCommunityPoidhBounty(options: {
  title: string;
  description: string;
  symbol: string;
  tokenAddress: string;
  requestedBy: string;
}): PoidhCommunityBounty {
  const sym = options.symbol.replace(/^\$/, '');
  const slug = options.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const proof = communityProofBlock(sym, options.tokenAddress);
  const body = options.description.trim();

  return {
    id: `req-${slug || 'bounty'}-${Date.now().toString(36)}`,
    kind: 'community',
    title: options.title.slice(0, 120),
    description: [body, '', proof].join('\n'),
    poidhBountyId: null,
    status: 'pending',
    requestedBy: options.requestedBy.toLowerCase(),
    createdAt: Date.now(),
    jobLinkedAt: null,
    bankrAgentJobId: null,
  };
}

/** @deprecated use createCommunityPoidhBounty */
export const createRequestedPoidhBounty = createCommunityPoidhBounty;

const PROOF_BLOCK_MARKER = '\n\nRequired when claiming:';

/** User-facing description only — hides auto-appended claim instructions. */
export function bountyDescriptionForDisplay(description: string): string {
  const tokenIdx = description.indexOf('\n\nToken: $');
  if (tokenIdx >= 0) return description.slice(0, tokenIdx).trim();
  const idx = description.indexOf(PROOF_BLOCK_MARKER);
  if (idx >= 0) return description.slice(0, idx).trim();
  return description.trim();
}

export function extractPoidhBountyLinks(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const patterns = [
    /ID\s*["']([\w-]+)["'][^.\n]{0,120}?bounty\s*#?\s*(\d+)/gi,
    /["']([\w-]+)["'][:\s]+.*?poidh\.xyz\/base\/bounty\/(\d+)/gi,
    /template\s*([\w-]+)[:\s]+(\d+)/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const templateId = match[1];
      const raw = Number(match[2]);
      if (templateId && Number.isFinite(raw) && raw > 0) {
        out[templateId] = raw > 500 ? raw - 986 : raw;
      }
    }
  }
  return out;
}
