import { getCommunities, getCommunity, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { pendingPoidhBounties } from '@/lib/poidh-community-bounties';
import { fetchPoidhBountiesForSpace } from '@/lib/poidh-api';
import { createPlatformAgentPost } from '@/lib/agent-pool-feed';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import {
  getPoidhIssuerWallet,
  isPoidhIssuerConfigured,
  poidhIssuerCreateOpenBounty,
} from '@/lib/poidh-issuer';
import { communityUrl } from '@/lib/site-url';
import type { Community, PoidhBountyState, PoidhCommunityBounty } from '@/lib/types';
import { normalizeAddr } from '@/lib/utils';

export type PoidhSpinUpResult = {
  configured: boolean;
  spacesProcessed: number;
  attempted: number;
  linked: number;
  pendingJobs: number;
  failed: number;
  items: Array<{
    tokenAddress: string;
    symbol: string;
    status: string;
    message?: string;
  }>;
};

async function savePoidhState(tokenAddress: string, state: PoidhBountyState): Promise<void> {
  const communities = await getCommunities();
  const index = communities.findIndex(
    (c) => c.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (index === -1) return;
  communities[index] = mergeCommunityDefaults({
    ...mergeCommunityDefaults(communities[index]),
    poidhBounties: state,
  });
  await setCommunities(communities);
}

async function linkFromOnChain(community: Community): Promise<number> {
  const state = community.poidhBounties;
  if (!state?.enabled) return 0;

  const platformWallet = getPlatformAgentWallet();
  const issuerWallet = getPoidhIssuerWallet();
  const issuers = [issuerWallet, platformWallet, community.ownerWallet].filter(
    Boolean
  ) as string[];
  if (!issuers.length) return 0;

  const onChain = await fetchPoidhBountiesForSpace({
    issuerWallets: issuers,
    symbol: community.symbol,
    tokenAddress: community.tokenAddress,
    scanLimit: 100,
  });

  let linked = 0;
  const usedOnChainIds = new Set(
    state.bounties
      .map((b) => b.poidhBountyId)
      .filter((id): id is number => id != null)
  );

  const bounties = state.bounties.map((b) => {
    if (b.poidhBountyId != null) return b;
    const titleHay = b.title.toLowerCase().slice(0, 32);
    const match = onChain.bounties.find((ob) => {
      if (usedOnChainIds.has(ob.id)) return false;
      const obName = ob.name.toLowerCase();
      const obHay = `${ob.name} ${ob.description}`.toLowerCase();
      if (obName === b.title.toLowerCase()) return true;
      return titleHay.length >= 8 && obHay.includes(titleHay);
    });
    if (match) {
      usedOnChainIds.add(match.id);
      linked += 1;
      return {
        ...b,
        poidhBountyId: match.id,
        status: 'live' as const,
        jobLinkedAt: b.jobLinkedAt ?? Date.now(),
      };
    }
    return b;
  });

  if (linked > 0) {
    const stillPending = bounties.some(
      (b) => b.poidhBountyId == null && b.status !== 'completed'
    );
    await savePoidhState(community.tokenAddress, {
      ...state,
      bounties,
      spinUpAt: stillPending ? state.spinUpAt ?? Date.now() : null,
      bankrAgentJobId: null,
      lastSpinUpError: null,
      lastSpinUpAt: null,
    });
  }
  return linked;
}

async function openBountyOnChain(
  community: Community,
  bounty: PoidhCommunityBounty
): Promise<{ bountyId: number; txHash: string }> {
  const { bountyId, txHash } = await poidhIssuerCreateOpenBounty({
    name: bounty.title,
    description: bounty.description,
  });
  return { bountyId, txHash };
}

async function spinUpNextPoidhBounty(
  community: Community
): Promise<{ status: string; message?: string; linked?: number }> {
  let mergedCommunity = mergeCommunityDefaults(community);
  const state = mergedCommunity.poidhBounties;
  if (!state?.enabled) {
    return { status: 'skipped', message: 'poidh bounties disabled' };
  }

  const pending = pendingPoidhBounties(state);
  if (!pending.length) {
    const linked = await linkFromOnChain(mergedCommunity);
    return { status: 'skipped', message: 'nothing pending', linked };
  }

  if (!isPoidhIssuerConfigured()) {
    return {
      status: 'pending_issuer',
      message: 'POIDH_ISSUER_PRIVATE_KEY not set on server',
    };
  }

  let linked = await linkFromOnChain(mergedCommunity);
  if (linked > 0) {
    const refreshed = await getCommunity(mergedCommunity.tokenAddress);
    if (refreshed) mergedCommunity = mergeCommunityDefaults(refreshed);
    const still = pendingPoidhBounties(mergedCommunity.poidhBounties);
    if (!still.length) {
      return { status: 'live', message: `linked ${linked} on-chain`, linked };
    }
  }

  const pendingAfterLink = pendingPoidhBounties(mergedCommunity.poidhBounties);
  if (!pendingAfterLink.length) {
    return { status: 'skipped', message: 'nothing pending', linked };
  }

  const batch = pendingAfterLink.slice(0, 1);
  const target = batch[0];

  try {
    await savePoidhState(mergedCommunity.tokenAddress, {
      ...mergedCommunity.poidhBounties!,
      bankrAgentJobId: null,
    });

    const { bountyId, txHash } = await openBountyOnChain(mergedCommunity, target);

    const communities = await getCommunities();
    const idx = communities.findIndex(
      (c) => c.tokenAddress.toLowerCase() === normalizeAddr(mergedCommunity.tokenAddress)
    );
    if (idx === -1) return { status: 'failed', message: 'community missing' };

    const current = mergeCommunityDefaults(communities[idx]);
    const currentState = current.poidhBounties!;
    let linkedFromCreate = 0;

    const bounties = currentState.bounties.map((b) => {
      if (b.id !== target.id || b.poidhBountyId != null) return b;
      linkedFromCreate += 1;
      return {
        ...b,
        poidhBountyId: bountyId,
        status: 'live' as const,
        jobLinkedAt: Date.now(),
      };
    });

    const stillPending = bounties.some(
      (b) => b.poidhBountyId == null && b.status !== 'completed'
    );

    communities[idx] = mergeCommunityDefaults({
      ...current,
      poidhBounties: {
        ...currentState,
        bounties,
        spinUpAt: stillPending ? currentState.spinUpAt ?? Date.now() : null,
        bankrAgentJobId: null,
        lastSpinUpError: null,
        lastSpinUpAt: null,
      },
    });
    await setCommunities(communities);

    if (linkedFromCreate > 0) {
      await createPlatformAgentPost(
        mergedCommunity.tokenAddress,
        [
          `$${mergedCommunity.symbol} — open bounty live: ${target.title}`,
          'Add funds on the Bounties tab, complete the task, post proof in community, then submit your claim.',
          `On-chain bounty #${bountyId}`,
          communityUrl(mergedCommunity.tokenAddress),
        ].join('\n')
      ).catch(() => undefined);
    }

    return {
      status: 'live',
      message: `tx ${txHash.slice(0, 10)}… bounty #${bountyId}`,
      linked: linked + linkedFromCreate,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('poidh spin-up failed', mergedCommunity.tokenAddress, message);

    const relinked = await linkFromOnChain(mergedCommunity).catch(() => 0);
    if (relinked > 0) {
      return { status: 'live', message: `linked existing on-chain bounty`, linked: relinked };
    }

    await savePoidhState(mergedCommunity.tokenAddress, {
      ...state,
      bankrAgentJobId: null,
      lastSpinUpError: message.slice(0, 500),
      lastSpinUpAt: Date.now(),
    }).catch(() => undefined);
    return { status: 'failed', message };
  }
}

export async function spinUpPoidhBountiesForCommunity(
  community: Community,
  options?: { maxBounties?: number }
): Promise<{ status: string; message?: string; linked?: number }> {
  const maxBounties = options?.maxBounties ?? 2;
  let merged = mergeCommunityDefaults(community);
  let totalLinked = 0;
  let last: { status: string; message?: string; linked?: number } = {
    status: 'skipped',
    linked: 0,
  };

  for (let i = 0; i < maxBounties; i++) {
    const pending = pendingPoidhBounties(merged.poidhBounties);
    if (!pending.length) break;

    last = await spinUpNextPoidhBounty(merged);
    totalLinked += last.linked ?? 0;

    if (last.status === 'failed' || last.status === 'pending_issuer') {
      break;
    }

    const fresh = await getCommunity(merged.tokenAddress);
    if (!fresh) break;
    merged = mergeCommunityDefaults(fresh);

    if (!pendingPoidhBounties(merged.poidhBounties).length) break;
  }

  return { ...last, linked: totalLinked };
}

export async function spinUpAllPoidhBounties(): Promise<PoidhSpinUpResult> {
  const configured = isPoidhIssuerConfigured();
  const communities = await getCommunities();
  const items: PoidhSpinUpResult['items'] = [];
  let spacesProcessed = 0;
  let linked = 0;
  let pendingJobs = 0;
  let failed = 0;

  for (const raw of communities) {
    const merged = mergeCommunityDefaults(raw);
    if (!merged.poidhBounties?.enabled) continue;
    if (
      !pendingPoidhBounties(merged.poidhBounties).length &&
      !merged.poidhBounties.spinUpAt
    ) {
      continue;
    }

    spacesProcessed += 1;
    const result = await spinUpPoidhBountiesForCommunity(merged, { maxBounties: 3 });
    items.push({
      tokenAddress: merged.tokenAddress,
      symbol: merged.symbol,
      status: result.status,
      message: result.message,
    });
    linked += result.linked ?? 0;
    if (result.status === 'pending_issuer') pendingJobs += 1;
    if (result.status === 'failed') failed += 1;
  }

  return {
    configured,
    spacesProcessed,
    attempted: items.length,
    linked,
    pendingJobs,
    failed,
    items,
  };
}

export function poidhSpinUpSummary(state: PoidhBountyState | undefined | null): {
  configured: boolean;
  pendingCount: number;
  agentJobRunning: boolean;
  message: string | null;
  lastError: string | null;
} {
  const configured = isPoidhIssuerConfigured();
  const pendingCount = pendingPoidhBounties(state).length;
  const lastError = state?.lastSpinUpError?.trim() || null;
  const agentJobRunning = pendingCount > 0 && configured && !lastError;

  let message: string | null = null;
  if (pendingCount === 0) {
    message = null;
  } else if (!configured) {
    message =
      'POIDH issuer wallet is not configured — set POIDH_ISSUER_PRIVATE_KEY and POIDH_ISSUER_WALLET (must match) on Vercel.';
  } else if (lastError) {
    message = `Could not open on-chain: ${lastError}`;
  } else {
    message =
      'Opening bounty on-chain (seeds 0.001 ETH from issuer wallet). Usually completes in under a minute.';
  }

  return { configured, pendingCount, agentJobRunning, message, lastError };
}
