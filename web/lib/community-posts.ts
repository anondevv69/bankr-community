import type { Community, PinnedPost, Post } from './types';

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
    pinnedPosts,
    pinnedPostId: pinnedPosts[0]?.postId ?? null,
  };
}

export function isPostPinned(pinnedPosts: PinnedPost[], postId: string): boolean {
  return pinnedPosts.some((entry) => entry.postId === postId);
}
