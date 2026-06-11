import { NextResponse } from 'next/server';
import {
  getCommunity,
  getPosts,
  setPostsForToken,
  updateCommunityCounts,
} from '@/lib/db';
import { checkParticipation } from '@/lib/participation';
import { resolveSpacePermissions } from '@/lib/community-owner';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { contentMatchesBlockedKeyword } from '@/lib/content-moderation';
import { resolveAuthorProfile } from '@/lib/profiles';
import { parsePostSource } from '@/lib/post-source';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';
import { communityUrl } from '@/lib/site-url';
import { buildPostReplyText } from '@/lib/agent-reply';
import type { Post } from '@/lib/types';

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
  const content = String(body.content || '').trim();
  const parentPostId = body.parentPostId
    ? String(body.parentPostId).trim()
    : null;

  if (!content) {
    return NextResponse.json({ error: 'Post cannot be empty' }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: 'Post too long (max 2000 characters)' }, { status: 400 });
  }

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const participation = await checkParticipation(
      wallet,
      tokenAddress,
      community.chain || 'base'
    );
    if (!participation.canPost) {
      return NextResponse.json(
        {
          error:
            'You must hold the token, be the fee recipient, or be the deployer (before verify or when allowed) to post',
        },
        { status: 403 }
      );
    }

    const normalized = mergeCommunityDefaults(community);
    const permissions = await resolveSpacePermissions(
      wallet,
      tokenAddress,
      community.chain || 'base'
    );
    if (!permissions.isPrivilegedPoster) {
      const blocked = contentMatchesBlockedKeyword(
        content,
        normalized.blockedKeywords
      );
      if (blocked) {
        return NextResponse.json(
          {
            error: `Post blocked: content matches a blocked phrase on this space`,
            blockedKeyword: blocked,
          },
          { status: 403 }
        );
      }
    }

    const posts = await getPosts(tokenAddress);

    if (parentPostId) {
      const parent = posts.find((post) => post.id === parentPostId);
      if (!parent) {
        return NextResponse.json({ error: 'Parent post not found' }, { status: 404 });
      }
      if (parent.parentPostId) {
        return NextResponse.json(
          { error: 'Replies are one level deep — reply to the main post only' },
          { status: 400 }
        );
      }
    }

    const author = await resolveAuthorProfile(wallet);
    const source = parsePostSource(req, body);
    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newPost: Post = {
      id: postId,
      wallet,
      author,
      content,
      reactions: { '👍': [], '❤️': [], '🔥': [] },
      timestamp: Date.now(),
      balance: participation.balance,
      ...(parentPostId ? { parentPostId } : {}),
      ...(source ? { source } : {}),
    };

    posts.push(newPost);
    await setPostsForToken(tokenAddress, posts);
    await updateCommunityCounts(tokenAddress, posts);

    return NextResponse.json({
      success: true,
      postId,
      author,
      post: newPost,
      communityLink: communityUrl(tokenAddress),
      replyText: buildPostReplyText(community.symbol, content, tokenAddress),
      links: {
        communityPage: communityUrl(tokenAddress),
      },
    });
  } catch (err) {
    console.error('POST /posts', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
