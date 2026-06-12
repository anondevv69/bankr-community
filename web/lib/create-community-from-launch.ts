import {
  getCommunities,
  getLaunches,
  getAllPosts,
  setCommunities,
  setPostsForToken,
} from './db';
import { fetchLaunchByAddress, getLaunchOwnerWallets } from './bankr-api';
import { isTokenBeneficiary } from './community-owner';
import { mergeCommunityDefaults } from './community-posts';
import { syncCommunityProfile, withResolvedProfile } from './community-profile-sync';
import { emptyPoidhBountyState } from './poidh-community-bounties';
import { communityUrl } from './site-url';
import { normalizeAddr } from './utils';
import type { Community } from './types';

export async function createCommunityFromLaunch(options: {
  tokenAddress: string;
  founderWallet: string;
  description?: string;
  /** Completed TMP petition — mark space verified for the founder */
  fromPetition?: boolean;
}): Promise<{ community: Community; created: boolean; links: { communityPage: string } }> {
  const tokenAddress = normalizeAddr(options.tokenAddress);
  const wallet = options.founderWallet.toLowerCase();
  const description = String(options.description || '').trim();

  let launch = (await getLaunches()).find(
    (l) => l.tokenAddress?.toLowerCase() === tokenAddress
  );
  if (!launch) {
    launch = (await fetchLaunchByAddress(tokenAddress)) || undefined;
  }
  if (!launch) {
    throw new Error(
      'Token not found in Bankr launches yet. Retry in a minute after TMP finalizes.'
    );
  }

  const communities = await getCommunities();
  const existing = communities.find(
    (c) => c.tokenAddress.toLowerCase() === tokenAddress
  );
  if (existing) {
    let merged = mergeCommunityDefaults(existing);
    if (options.fromPetition && !merged.verified) {
      merged = {
        ...merged,
        verified: true,
        verifiedAt: Date.now(),
        verifiedBy: wallet,
      };
      const communities = await getCommunities();
      const idx = communities.findIndex(
        (c) => c.tokenAddress.toLowerCase() === tokenAddress
      );
      if (idx !== -1) {
        communities[idx] = merged;
        await setCommunities(communities);
      }
    }
    return {
      community: withResolvedProfile(merged),
      created: false,
      links: { communityPage: communityUrl(tokenAddress) },
    };
  }

  const { feeRecipient, deployer } = getLaunchOwnerWallets(launch);
  const isBeneficiary = await isTokenBeneficiary(wallet, tokenAddress);
  const verifiedFromPetition = !!options.fromPetition;

  const community = mergeCommunityDefaults({
    tokenAddress: launch.tokenAddress,
    name: launch.tokenName,
    symbol: launch.tokenSymbol,
    chain: launch.chain || 'base',
    founderWallet: wallet,
    ownerWallet: feeRecipient || deployer || wallet,
    allowDeployerEdit: false,
    trustedDelegates: [],
    usePlatformAgent: false,
    platformAgentSkills: false,
    verified: verifiedFromPetition || isBeneficiary,
    verifiedAt: verifiedFromPetition || isBeneficiary ? Date.now() : null,
    verifiedBy: verifiedFromPetition || isBeneficiary ? wallet : null,
    description: description || `${launch.tokenName} holder space`,
    imageUri: launch.imageUri ?? null,
    socialLinks: {},
    pinnedPosts: [],
    pinnedPostId: null,
    postCount: 0,
    memberCount: 0,
    createdAt: Date.now(),
    launchTimestamp: launch.timestamp,
    poidhBounties: emptyPoidhBountyState(),
  });

  const synced = await syncCommunityProfile(community, { force: true });
  communities.unshift(synced);
  await setCommunities(communities);

  const allPosts = await getAllPosts();
  if (!allPosts[tokenAddress]) {
    await setPostsForToken(tokenAddress, []);
  }

  return {
    community: withResolvedProfile(synced),
    created: true,
    links: { communityPage: communityUrl(tokenAddress) },
  };
}
