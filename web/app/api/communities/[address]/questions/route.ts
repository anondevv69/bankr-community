import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import {
  createCommunityQuestion,
  getQuestions,
  questionVoteCounts,
  settleExpiredQuestions,
  userQuestionVote,
} from '@/lib/community-questions';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.toLowerCase() || null;

  try {
    await settleExpiredQuestions();
    const questions = await getQuestions(tokenAddress);
    return NextResponse.json({
      questions: questions.map((q) => ({
        ...q,
        tallies: questionVoteCounts(q),
        userVote: userQuestionVote(q, wallet),
      })),
    });
  } catch (err) {
    console.error('GET /questions', err);
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || '').trim();
  const optionLabels = Array.isArray(body.options)
    ? body.options.map((o: unknown) => String(o || ''))
    : [];

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const question = await createCommunityQuestion({
      tokenAddress,
      wallet,
      prompt,
      optionLabels,
      chain: community.chain || 'base',
    });

    return NextResponse.json({
      success: true,
      question: {
        ...question,
        tallies: questionVoteCounts(question),
        userVote: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create question';
    const status = message.includes('already has an active') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
