import { NextResponse } from 'next/server';
import {
  getCommunities,
  getCommunity,
  getPosts,
  setCommunities,
  setPostsForToken,
  updateCommunityCounts,
} from '@/lib/db';
import { canPinCommunityPosts } from '@/lib/community-owner';
import {
  mergeCommunityDefaults,
  normalizePinnedPosts,
  unpinPost,
} from '@/lib/community-posts';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string; postId: string }> };

export async function DELETE(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address, postId } = await params;
  const tokenAddress = normalizeAddr(address);
  const targetId = String(postId || '').trim();

  if (!targetId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 });
  }

  try {
    const allowed = await canPinCommunityPosts(wallet, tokenAddress);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            'Only the fee recipient, deployer (when allowed), trusted delegate, or platform agent can remove posts on a verified space',
        },
        { status: 403 }
      );
    }

    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const posts = await getPosts(tokenAddress);
    const target = posts.find((post) => post.id === targetId);
    if (!target) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const removeIds = new Set<string>([targetId]);
    if (!target.parentPostId) {
      for (const post of posts) {
        if (post.parentPostId === targetId) removeIds.add(post.id);
      }
    }

    const nextPosts = posts.filter((post) => !removeIds.has(post.id));
    await setPostsForToken(tokenAddress, nextPosts);
    await updateCommunityCounts(tokenAddress, nextPosts);

    const communities = await getCommunities();
    const index = communities.findIndex(
      (item) => item.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index !== -1) {
      const current = mergeCommunityDefaults(communities[index]);
      const pinnedPosts = normalizePinnedPosts(current);
      let changed = false;
      let nextPins = pinnedPosts;
      for (const id of removeIds) {
        if (nextPins.some((entry) => entry.postId === id)) {
          nextPins = unpinPost(nextPins, id);
          changed = true;
        }
      }
      if (changed) {
        communities[index] = mergeCommunityDefaults({
          ...current,
          pinnedPosts: nextPins,
          pinnedPostId: nextPins[0]?.postId ?? null,
        });
        await setCommunities(communities);
      }
    }

    return NextResponse.json({
      success: true,
      removedPostIds: [...removeIds],
      removedCount: removeIds.size,
    });
  } catch (err) {
    console.error('DELETE post', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
