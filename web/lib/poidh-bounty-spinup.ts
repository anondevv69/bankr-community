import { getCommunities, getCommunity, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  buildPoidhSpinUpPrompt,
  extractPoidhBountyLinks,
  pendingPoidhBounties,
  bountyPublicUrl,
} from '@/lib/poidh-community-bounties';
import { fetchPoidhBountiesForSpace } from '@/lib/poidh-api';
import {
  getPlatformAgentBankrApiKey,
  pollBankrAgentJob,
  submitBankrAgentPrompt,
} from '@/lib/bankr-agent-client';
import { createPlatformAgentPost } from '@/lib/agent-pool-feed';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { communityUrl } from '@/lib/site-url';
import { extractPoidhBountyId, extractTxHash } from '@/lib/work-brief';
import type { Community, PoidhBountyState } from '@/lib/types';
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
  const issuers = [platformWallet, community.ownerWallet].filter(Boolean) as string[];
  if (!issuers.length) return 0;

  const onChain = await fetchPoidhBountiesForSpace({
    issuerWallets: issuers,
    symbol: community.symbol,
    tokenAddress: community.tokenAddress,
    scanLimit: 100,
  });

  let linked = 0;
  const bounties = state.bounties.map((b) => {
    if (b.poidhBountyId != null) return b;
    const titleHay = b.title.toLowerCase().slice(0, 32);
    const match = onChain.bounties.find((ob) => {
      const obHay = `${ob.name} ${ob.description}`.toLowerCase();
      return titleHay.length >= 8 && obHay.includes(titleHay);
    });
    if (match) {
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
    const stillPending = bounties.some((b) => b.poidhBountyId == null && b.status === 'pending');
    await savePoidhState(community.tokenAddress, {
      ...state,
      bounties,
      spinUpAt: stillPending ? state.spinUpAt ?? Date.now() : null,
    });
  }
  return linked;
}

async function spinUpNextPoidhBounty(
  community: Community
): Promise<{ status: string; message?: string; linked?: number }> {
  const merged = mergeCommunityDefaults(community);
  const state = merged.poidhBounties;
  if (!state?.enabled) {
    return { status: 'skipped', message: 'poidh bounties disabled' };
  }

  const pending = pendingPoidhBounties(state);
  if (!pending.length) {
    const linked = await linkFromOnChain(merged);
    return { status: 'skipped', message: 'nothing pending', linked };
  }

  if (!getPlatformAgentBankrApiKey()) {
    return { status: 'pending_api_key', message: 'PLATFORM_AGENT_BANKR_API_KEY not set' };
  }

  const batch = pending.slice(0, 1);
  let jobId = state.bankrAgentJobId?.trim() || null;
  let resultText = '';

  try {
    if (!jobId) {
      const prompt = buildPoidhSpinUpPrompt({
        symbol: merged.symbol,
        tokenAddress: merged.tokenAddress,
        bounties: batch,
      });
      jobId = await submitBankrAgentPrompt(prompt);
      await savePoidhState(merged.tokenAddress, { ...state, bankrAgentJobId: jobId });
    }

    const polled = await pollBankrAgentJob(jobId, { maxAttempts: 90, delayMs: 2000 });
    resultText = polled.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('timed out')) {
      return { status: 'pending_job', message: `Bankr agent running (${jobId})` };
    }
    await savePoidhState(merged.tokenAddress, { ...state, bankrAgentJobId: null });
    return { status: 'failed', message };
  }

  const links = extractPoidhBountyLinks(resultText);
  const txHash = extractTxHash(resultText);

  const communities = await getCommunities();
  const idx = communities.findIndex(
    (c) => c.tokenAddress.toLowerCase() === normalizeAddr(merged.tokenAddress)
  );
  if (idx === -1) return { status: 'failed', message: 'community missing' };

  const current = mergeCommunityDefaults(communities[idx]);
  const currentState = current.poidhBounties!;
  let linked = 0;

  const bounties = currentState.bounties.map((b) => {
    let onChainId: number | null = links[b.id] ?? null;
    if (onChainId == null && batch.some((p) => p.id === b.id)) {
      onChainId = extractPoidhBountyId(resultText);
    }
    if (onChainId != null && b.poidhBountyId == null && batch.some((p) => p.id === b.id)) {
      linked += 1;
      return {
        ...b,
        poidhBountyId: onChainId,
        status: 'live' as const,
        jobLinkedAt: Date.now(),
      };
    }
    return b;
  });

  const stillPending = bounties.some((b) => b.poidhBountyId == null && b.status === 'pending');

  communities[idx] = mergeCommunityDefaults({
    ...current,
    poidhBounties: {
      ...currentState,
      bounties,
      spinUpAt: stillPending ? currentState.spinUpAt ?? Date.now() : null,
      bankrAgentJobId: null,
    },
  });
  await setCommunities(communities);

  if (linked < batch.length) {
    linked += await linkFromOnChain(communities[idx]);
  }

  if (linked > 0) {
    const live = bounties.filter((b) => b.poidhBountyId != null);
    const lines = live
      .map((b) => bountyPublicUrl(b))
      .filter(Boolean)
      .slice(0, 5);
    await createPlatformAgentPost(
      merged.tokenAddress,
      [
        `$${merged.symbol} — POIDH open bounty live: ${batch[0].title}`,
        'Add funds on POIDH, complete the task, post proof here, then submit on poidh.xyz.',
        ...lines.map((u) => `Bounty: ${u}`),
        communityUrl(merged.tokenAddress),
      ].join('\n')
    ).catch(() => undefined);
  }

  return {
    status: linked > 0 ? 'live' : 'pending_link',
    message: txHash ? `tx ${txHash.slice(0, 10)}…` : resultText.slice(0, 120),
    linked,
  };
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
    if (!pending.length && !merged.poidhBounties?.bankrAgentJobId) break;

    last = await spinUpNextPoidhBounty(merged);
    totalLinked += last.linked ?? 0;

    if (
      last.status === 'pending_job' ||
      last.status === 'failed' ||
      last.status === 'pending_api_key'
    ) {
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
  const configured = Boolean(getPlatformAgentBankrApiKey());
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
      !merged.poidhBounties.spinUpAt &&
      !merged.poidhBounties.bankrAgentJobId
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
    if (result.status === 'pending_job') pendingJobs += 1;
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
} {
  const configured = Boolean(getPlatformAgentBankrApiKey());
  const pendingCount = pendingPoidhBounties(state).length;
  const agentJobRunning = Boolean(state?.bankrAgentJobId?.trim());

  let message: string | null = null;
  if (pendingCount === 0) {
    message = null;
  } else if (!configured) {
    message =
      'Platform agent is not configured — bounties will open once the operator adds the Bankr API key.';
  } else if (agentJobRunning) {
    message = 'Bankr agent is creating this bounty on POIDH right now — usually 1–3 minutes.';
  } else {
    message =
      'Bankr agent opens each bounty on POIDH (seeds a small ETH pool). Then anyone can add funds, do the task, and vote on proof.';
  }

  return { configured, pendingCount, agentJobRunning, message };
}
