import { NextResponse } from 'next/server';
import {
  getCommunity,
  getPosts,
  setPostsForToken,
  updateCommunityCounts,
} from '@/lib/db';
import { checkParticipation } from '@/lib/participation';
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
            'You must hold the token or be the fee recipient / deployer to post',
        },
        { status: 403 }
      );
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
      ...(source ? { source } : {}),
    };

    const posts = await getPosts(tokenAddress);
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
