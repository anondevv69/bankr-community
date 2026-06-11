import type { Community, PinnedPost, Post } from './types';
import { normalizeFundraising } from './fundraising';
import { normalizeAgentPool } from './agent-pool';

export function normalizePinnedPosts(community: Community): PinnedPost[] {
  if (community.pinnedPosts?.length) {
    return [...community.pinnedPosts].sort((a, b) => b.pinnedAt - a.pinnedAt);
  }

  if (community.pinnedPostId) {
    return [{ postId: community.pinnedPostId, pinnedAt: Date.now() }];
  }

  return [];
}

export function sortPostsWithPinned(posts: Post[], pinnedPosts: PinnedPost[]): Post[] {
  if (!pinnedPosts.length) {
    return [...posts].sort((a, b) => b.timestamp - a.timestamp);
  }

  const byId = new Map(posts.map((post) => [post.id, post]));
  const pinned = pinnedPosts
    .map((entry) => byId.get(entry.postId))
    .filter((post): post is Post => !!post);

  const pinnedIds = new Set(pinnedPosts.map((entry) => entry.postId));
  const rest = posts
    .filter((post) => !pinnedIds.has(post.id))
    .sort((a, b) => b.timestamp - a.timestamp);

  return [...pinned, ...rest];
}

export function pinPost(pinnedPosts: PinnedPost[], postId: string): PinnedPost[] {
  const now = Date.now();
  const without = pinnedPosts.filter((entry) => entry.postId !== postId);
  return [{ postId, pinnedAt: now }, ...without];
}

export function unpinPost(pinnedPosts: PinnedPost[], postId: string): PinnedPost[] {
  return pinnedPosts.filter((entry) => entry.postId !== postId);
}

export function mergeCommunityDefaults(community: Community): Community {
  const pinnedPosts = normalizePinnedPosts(community);
  return {
    ...community,
    socialLinks: community.socialLinks || {},
    customIconUrl: community.customIconUrl ?? null,
    customBannerUrl: community.customBannerUrl ?? null,
    useBankrImage: community.useBankrImage ?? true,
    useDexIcon: community.useDexIcon ?? true,
    useDexBanner: community.useDexBanner ?? true,
    useDexDescription: community.useDexDescription ?? true,
    useDexLinks: community.useDexLinks ?? true,
    pinnedBankrIconUri: community.pinnedBankrIconUri ?? null,
    pinnedDexIconUri: community.pinnedDexIconUri ?? null,
    pinnedDexBannerUri: community.pinnedDexBannerUri ?? null,
    dexIconSrc: community.dexIconSrc ?? null,
    dexBannerSrc: community.dexBannerSrc ?? null,
    dexDescription: community.dexDescription ?? null,
    dexSocialLinks: community.dexSocialLinks || {},
    profileSyncMeta: community.profileSyncMeta || {},
    fundraising: normalizeFundraising(community.fundraising),
    agentPool: normalizeAgentPool(community.agentPool),
    allowDeployerEdit: community.allowDeployerEdit ?? false,
    trustedDelegates: community.trustedDelegates ?? [],
    feeRecipientAgent: community.feeRecipientAgent ?? null,
    usePlatformAgent: community.usePlatformAgent ?? false,
    platformAgentSkills: community.platformAgentSkills ?? false,
    blockedKeywords: community.blockedKeywords ?? [],
    pinnedPosts,
    pinnedPostId: pinnedPosts[0]?.postId ?? null,
  };
}

export function isPostPinned(pinnedPosts: PinnedPost[], postId: string): boolean {
  return pinnedPosts.some((entry) => entry.postId === postId);
}
