import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import {
  castQuestionVote,
  closeCommunityQuestion,
  questionVoteCounts,
  settleQuestionRecord,
  userQuestionVote,
} from '@/lib/community-questions';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { id: questionId } = await params;
  const body = await req.json().catch(() => ({}));
  const tokenAddress = normalizeAddr(String(body.tokenAddress || ''));
  const action = String(body.action || 'vote');

  if (!tokenAddress) {
    return NextResponse.json({ error: 'tokenAddress required' }, { status: 400 });
  }

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (action === 'close') {
      const question = await closeCommunityQuestion({
        questionId,
        tokenAddress,
        wallet,
        chain: community.chain || 'base',
      });
      return NextResponse.json({
        success: true,
        question: {
          ...question,
          tallies: questionVoteCounts(question),
          userVote: userQuestionVote(question, wallet),
        },
      });
    }

    const optionId = String(body.optionId || '').trim();
    if (!optionId) {
      return NextResponse.json({ error: 'optionId required' }, { status: 400 });
    }

    const question = await castQuestionVote({
      questionId,
      tokenAddress,
      wallet,
      optionId,
      chain: community.chain || 'base',
    });

    return NextResponse.json({
      success: true,
      question: {
        ...question,
        tallies: questionVoteCounts(question),
        userVote: userQuestionVote(question, wallet),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vote failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id: questionId } = await params;

  try {
    const allTokens = await import('@/lib/community-questions').then((m) => m.getAllQuestions());
    for (const [token, questions] of Object.entries(allTokens)) {
      const found = questions.find((q) => q.id === questionId);
      if (found) {
        let question = found;
        if (question.status === 'active' && Date.now() >= question.endsAt) {
          question = settleQuestionRecord(question, { closeReason: 'expired' });
          const updated = questions.map((q) => (q.id === questionId ? question : q));
          const { setQuestionsForToken } = await import('@/lib/community-questions');
          await setQuestionsForToken(token, updated);
        }
        return NextResponse.json({
          question: {
            ...question,
            tallies: questionVoteCounts(question),
          },
        });
      }
    }
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  } catch (err) {
    console.error('GET /questions/[id]', err);
    return NextResponse.json({ error: 'Failed to load question' }, { status: 500 });
  }
}
