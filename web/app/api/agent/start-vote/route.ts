import { NextResponse } from 'next/server';
import { getCommunity, getCommunities } from '@/lib/db';
import { createCommunityQuestion, questionVoteCounts } from '@/lib/community-questions';
import { NATIVE_SPACE_TOKEN_ADDRESS } from '@/lib/featured-community';
import { resolveSpacePermissions } from '@/lib/community-owner';
import { communityUrl } from '@/lib/site-url';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SPACE_ALIASES = new Set([
  'space',
  'bankr space',
  'bankrspace',
  '$space',
  'native space',
]);

function resolveTokenFromBody(body: Record<string, unknown>): string | null {
  const rawToken = String(body.token || body.tokenAddress || '').trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(rawToken)) {
    return normalizeAddr(rawToken);
  }

  const rawSymbol = String(body.symbol || body.ticker || '').trim();
  if (!rawSymbol) return null;

  const sym = rawSymbol.replace(/^\$/, '');
  if (SPACE_ALIASES.has(sym.toLowerCase()) || sym.toLowerCase() === 'space') {
    return NATIVE_SPACE_TOKEN_ADDRESS;
  }

  return null;
}

async function resolveTokenAddress(body: Record<string, unknown>): Promise<string | null> {
  const direct = resolveTokenFromBody(body);
  if (direct) return direct;

  const rawSymbol = String(body.symbol || body.ticker || '')
    .trim()
    .replace(/^\$/, '');
  if (!rawSymbol) return null;

  const communities = await getCommunities();
  const q = rawSymbol.toLowerCase();
  const match =
    communities.find((c) => c.symbol.toLowerCase() === q) ||
    communities.find((c) => c.name.toLowerCase() === q);
  return match ? normalizeAddr(match.tokenAddress) : null;
}

/** One-shot holder vote start for agents — resolves Space ticker + creates ballot. */
export async function POST(req: Request) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'x-wallet-address required' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || '').trim();
  const voteType = body.voteType === 'choice' ? ('choice' as const) : ('yes_no' as const);
  const optionLabels = Array.isArray(body.options)
    ? body.options.map((o: unknown) => String(o || ''))
    : [];
  const durationHours = body.durationHours != null ? Number(body.durationHours) : undefined;

  if (prompt.length < 8) {
    return NextResponse.json({ error: 'prompt required (min 8 characters)' }, { status: 400 });
  }

  const tokenAddress = await resolveTokenAddress(body);
  if (!tokenAddress) {
    return NextResponse.json(
      {
        error:
          'Could not resolve token — pass token (0x…), symbol (e.g. TMP), or use symbol "Space" for Bankr Space native token',
      },
      { status: 400 }
    );
  }

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const permissions = await resolveSpacePermissions(
      wallet,
      tokenAddress,
      community.chain || 'base'
    );
    if (!permissions.canCreateQuestion) {
      return NextResponse.json(
        { error: 'Linked wallet cannot start votes on this space (need canCreateQuestion)' },
        { status: 403 }
      );
    }

    const question = await createCommunityQuestion({
      tokenAddress,
      wallet,
      prompt,
      voteType,
      optionLabels: voteType === 'choice' ? optionLabels : undefined,
      durationHours,
      chain: community.chain || 'base',
    });

    const durationH = Math.round((question.durationMs || question.endsAt - question.createdAt) / 3600000);

    return NextResponse.json({
      success: true,
      symbol: community.symbol,
      tokenAddress,
      communityLink: communityUrl(tokenAddress),
      durationHours: durationH,
      tweetReply:
        `Opened a ${durationH}h holder vote on $${community.symbol} space: "${prompt}"\n` +
        `Holders vote on the Votes tab.\n` +
        communityUrl(tokenAddress),
      question: {
        ...question,
        tallies: questionVoteCounts(question),
        userVote: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start vote';
    const status = message.includes('already has an active') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
