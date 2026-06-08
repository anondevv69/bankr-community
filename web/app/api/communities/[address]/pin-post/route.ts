import { NextResponse } from 'next/server';
import { getCommunities, getPosts, setCommunities } from '@/lib/db';
import { canPinCommunityPosts } from '@/lib/community-owner';
import {
  mergeCommunityDefaults,
  normalizePinnedPosts,
  pinPost,
  sortPostsWithPinned,
  unpinPost,
} from '@/lib/community-posts';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';
import { communityUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));
  const postId = String(body.postId || '').trim();
  const action = String(body.action || 'pin').toLowerCase();

  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 });
  }

  if (action !== 'pin' && action !== 'unpin') {
    return NextResponse.json({ error: 'action must be pin or unpin' }, { status: 400 });
  }

  try {
    const allowed = await canPinCommunityPosts(wallet, tokenAddress);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            'Only the verified token fee beneficiary can pin posts. Verify the community first.',
        },
        { status: 403 }
      );
    }

    const communities = await getCommunities();
    const index = communities.findIndex(
      (item) => item.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const posts = await getPosts(tokenAddress);
    const exists = posts.some((post) => post.id === postId);
    if (!exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const current = mergeCommunityDefaults(communities[index]);
    const existingPins = normalizePinnedPosts(current);
    const pinnedPosts =
      action === 'unpin'
        ? unpinPost(existingPins, postId)
        : pinPost(existingPins, postId);

    const updated = mergeCommunityDefaults({
      ...current,
      pinnedPosts,
      pinnedPostId: pinnedPosts[0]?.postId ?? null,
    });

    communities[index] = updated;
    await setCommunities(communities);

    const sortedPosts = sortPostsWithPinned(posts, pinnedPosts);

    return NextResponse.json({
      success: true,
      community: updated,
      posts: sortedPosts,
      pinnedPosts,
      links: {
        communityPage: communityUrl(tokenAddress),
      },
    });
  } catch (err) {
    console.error('POST pin-post', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
