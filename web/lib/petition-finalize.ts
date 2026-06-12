import { fetchLaunchByAddress } from './bankr-api';
import { getCommunity } from './db';
import { createCommunityFromLaunch } from './create-community-from-launch';
import {
  getPetitionPosts,
  getPetitionSpace,
  getPetitionSpaces,
  savePetitionSpace,
  setPetitionPosts,
} from './petition-spaces';
import { tmpGetPetitionStatus } from './tmp-petition';
import { getPosts, setPostsForToken } from './db';
import type { PetitionSpace } from './types';

export async function syncPetitionFromTmp(
  space: PetitionSpace
): Promise<{ space: PetitionSpace; tmpStatus: string }> {
  const status = await tmpGetPetitionStatus(space.tmpPetitionId);
  const petition = status.petition;
  let updated: PetitionSpace = {
    ...space,
    updatedAt: Date.now(),
    tokenName: petition.tokenName || space.tokenName,
    tokenSymbol: petition.tokenSymbol || space.tokenSymbol,
  };

  const tmpPhase = petition.status;
  if (tmpPhase === 'finalized') {
    const tokenAddress =
      petition.finalResult?.tokenAddress?.toLowerCase() || null;
    updated = {
      ...updated,
      phase: tokenAddress ? 'live' : 'finalizing',
      tokenAddress,
    };
  } else if (tmpPhase === 'locked' || tmpPhase === 'finalizing') {
    updated = { ...updated, phase: 'finalizing' };
  } else if (tmpPhase === 'expired' || tmpPhase === 'failed' || tmpPhase === 'cancelled') {
    updated = { ...updated, phase: 'expired' };
  } else {
    updated = { ...updated, phase: 'petition' };
  }

  await savePetitionSpace(updated);
  return { space: updated, tmpStatus: tmpPhase };
}

async function migratePetitionPostsToCommunity(
  petitionId: string,
  tokenAddress: string
): Promise<number> {
  const petitionPosts = await getPetitionPosts(petitionId);
  if (!petitionPosts.length) return 0;

  const existing = await getPosts(tokenAddress);
  const existingIds = new Set(existing.map((p) => p.id));
  const toAdd = petitionPosts.filter((p) => !existingIds.has(p.id));
  if (!toAdd.length) return 0;

  await setPostsForToken(tokenAddress, [...toAdd, ...existing]);
  return toAdd.length;
}

export async function upgradePetitionToCommunity(options: {
  petitionId: string;
  wallet: string;
}): Promise<{
  space: PetitionSpace;
  communityCreated: boolean;
  communityPage: string;
  postsMigrated: number;
}> {
  const space = await getPetitionSpace(options.petitionId);
  if (!space) {
    throw new Error('Petition space not found');
  }
  if (space.founderWallet.toLowerCase() !== options.wallet.toLowerCase()) {
    throw new Error('Only the petition creator can upgrade the space');
  }

  const { space: synced } = await syncPetitionFromTmp(space);
  if (synced.phase !== 'live' && synced.phase !== 'finalizing') {
    throw new Error('Petition is not finalized yet');
  }

  let tokenAddress = synced.tokenAddress;
  if (!tokenAddress) {
    const status = await tmpGetPetitionStatus(synced.tmpPetitionId);
    tokenAddress =
      status.petition.finalResult?.tokenAddress?.toLowerCase() || null;
  }
  if (!tokenAddress) {
    throw new Error('Token address not available yet — wait for TMP deploy to finish');
  }

  const launch = await fetchLaunchByAddress(tokenAddress);
  if (!launch) {
    throw new Error('Token not indexed in Bankr launches yet — retry shortly');
  }

  const result = await createCommunityFromLaunch({
    tokenAddress,
    founderWallet: synced.founderWallet,
    description: synced.description,
    fromPetition: true,
  });

  const postsMigrated = await migratePetitionPostsToCommunity(
    synced.tmpPetitionId,
    tokenAddress
  );

  const upgraded: PetitionSpace = {
    ...synced,
    phase: 'live',
    tokenAddress,
    updatedAt: Date.now(),
  };
  await savePetitionSpace(upgraded);

  return {
    space: upgraded,
    communityCreated: result.created,
    communityPage: result.links.communityPage,
    postsMigrated,
  };
}

export async function finalizeAllPendingPetitions(): Promise<{
  checked: number;
  upgraded: number;
  errors: string[];
}> {
  const spaces = await getPetitionSpaces();
  const pending = spaces.filter(
    (s) => s.phase === 'petition' || s.phase === 'finalizing'
  );
  const errors: string[] = [];
  let upgraded = 0;

  for (const space of pending) {
    try {
      const { space: synced, tmpStatus } = await syncPetitionFromTmp(space);
      if (tmpStatus !== 'finalized' || !synced.tokenAddress) continue;

      const existing = await getCommunity(synced.tokenAddress);
      if (existing) {
        if (!existing.verified) {
          await createCommunityFromLaunch({
            tokenAddress: synced.tokenAddress,
            founderWallet: synced.founderWallet,
            description: synced.description,
            fromPetition: true,
          });
        }
        await savePetitionSpace({ ...synced, phase: 'live', updatedAt: Date.now() });
        upgraded += 1;
        continue;
      }

      await createCommunityFromLaunch({
        tokenAddress: synced.tokenAddress,
        founderWallet: synced.founderWallet,
        description: synced.description,
        fromPetition: true,
      });
      await migratePetitionPostsToCommunity(synced.tmpPetitionId, synced.tokenAddress);
      await savePetitionSpace({ ...synced, phase: 'live', updatedAt: Date.now() });
      upgraded += 1;
    } catch (err) {
      errors.push(
        `${space.tmpPetitionId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { checked: pending.length, upgraded, errors };
}
