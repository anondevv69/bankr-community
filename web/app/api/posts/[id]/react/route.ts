import { NextResponse } from 'next/server';
import { getPosts, setPostsForToken, getCommunity } from '@/lib/db';
import { checkParticipation } from '@/lib/participation';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

const ALLOWED = ['👍', '❤️', '🔥'];

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { id: postId } = await params;
  const body = await req.json().catch(() => ({}));
  const tokenAddress = normalizeAddr(String(body.tokenAddress || ''));
  const reaction = String(body.reaction || '');

  if (!tokenAddress || !postId || !ALLOWED.includes(reaction)) {
    return NextResponse.json({ error: 'Invalid arguments' }, { status: 400 });
  }

  try {
    const community = await getCommunity(tokenAddress);
    const participation = await checkParticipation(
      wallet,
      tokenAddress,
      community?.chain || 'base'
    );
    if (!participation.canPost) {
      return NextResponse.json(
        { error: 'You must hold the token or be the fee recipient / deployer to react' },
        { status: 403 }
      );
    }

    const posts = await getPosts(tokenAddress);
    const post = posts.find((p) => p.id === postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (!post.reactions) post.reactions = {};
    for (const emoji of ALLOWED) {
      if (!post.reactions[emoji]) post.reactions[emoji] = [];
      post.reactions[emoji] = post.reactions[emoji].filter((w) => w !== wallet);
    }
    if (!post.reactions[reaction].includes(wallet)) {
      post.reactions[reaction].push(wallet);
    }

    await setPostsForToken(tokenAddress, posts);
    return NextResponse.json({ success: true, reactions: post.reactions });
  } catch (err) {
    console.error('POST react', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
