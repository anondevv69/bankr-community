import type { PoidhBountyKind, PoidhBountyState, PoidhCommunityBounty } from './types';
import { poidhBountyUrl } from './poidh-api';

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
    'Required when claiming:',
    '1. Complete the task described above',
    '2. Post in the bankr.space community with proof (screenshot + tx link)',
    '3. Submit your POIDH claim with the community post URL as proof',
    '',
    'Contributors on POIDH vote to approve payout after the creator proposes the winner.',
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

  return {
    id,
    kind,
    title: String(b.title || 'Community bounty').slice(0, 120),
    description: String(b.description || '').slice(0, 4000),
    poidhBountyId: b.poidhBountyId != null ? Number(b.poidhBountyId) : null,
    status: b.status === 'live' || b.status === 'completed' ? b.status : 'pending',
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
  };
}

export function pendingPoidhBounties(state: PoidhBountyState | undefined | null): PoidhCommunityBounty[] {
  if (!state?.enabled) return [];
  return state.bounties.filter((b) => b.status === 'pending' && b.poidhBountyId == null);
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
    'Funding happens on POIDH — contributors use Add funds on poidh.xyz.',
    `Token $${options.symbol.replace(/^\$/, '')}: ${options.tokenAddress}`,
    '',
    'Create these bounties:',
    tasks,
    '',
    'Return each template id, on-chain bounty id, poidh.xyz/base/bounty/ URL, and tx hash.',
    'Guide: https://words.poidh.xyz/poidh-open-bounties-guide',
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
  const idx = description.indexOf(PROOF_BLOCK_MARKER);
  if (idx >= 0) return description.slice(0, idx).trim();
  const tokenIdx = description.indexOf('\n\nToken: $');
  if (tokenIdx >= 0) return description.slice(0, tokenIdx).trim();
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
