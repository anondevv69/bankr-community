import { kvGet, kvSet } from './kv-store';
import { holdsToken } from './holder';
import { resolveSpacePermissions } from './community-owner';
import { resolveAuthorProfile } from './profiles';
import { normalizeAddr } from './utils';
import type { Author, CommunityQuestion, QuestionOption, QuestionVote } from './types';

const QUESTIONS_KEY = 'community_questions';
export const QUESTION_DURATION_MS = 24 * 60 * 60 * 1000;

export async function getAllQuestions(): Promise<Record<string, CommunityQuestion[]>> {
  return (await kvGet<Record<string, CommunityQuestion[]>>(QUESTIONS_KEY)) || {};
}

export async function getQuestions(tokenAddress: string): Promise<CommunityQuestion[]> {
  const all = await getAllQuestions();
  return all[normalizeAddr(tokenAddress).toLowerCase()] || [];
}

export async function setQuestionsForToken(
  tokenAddress: string,
  questions: CommunityQuestion[]
): Promise<void> {
  const all = await getAllQuestions();
  all[normalizeAddr(tokenAddress).toLowerCase()] = questions;
  await kvSet(QUESTIONS_KEY, all);
}

export async function deleteQuestionsForToken(tokenAddress: string): Promise<void> {
  const all = await getAllQuestions();
  delete all[normalizeAddr(tokenAddress).toLowerCase()];
  await kvSet(QUESTIONS_KEY, all);
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function tallyQuestionVotes(question: CommunityQuestion): {
  counts: Record<string, number>;
  winningOptionId: string | null;
  totalVotes: number;
} {
  const counts: Record<string, number> = {};
  for (const opt of question.options) {
    counts[opt.id] = 0;
  }
  for (const vote of question.votes) {
    if (counts[vote.optionId] !== undefined) {
      counts[vote.optionId]++;
    }
  }
  let winningOptionId: string | null = null;
  let max = -1;
  for (const opt of question.options) {
    if (counts[opt.id] > max) {
      max = counts[opt.id];
      winningOptionId = opt.id;
    }
  }
  return {
    counts,
    winningOptionId: max > 0 ? winningOptionId : null,
    totalVotes: question.votes.length,
  };
}

export function settleQuestionRecord(question: CommunityQuestion): CommunityQuestion {
  if (question.status === 'settled') return question;
  const { winningOptionId } = tallyQuestionVotes(question);
  return {
    ...question,
    status: 'settled',
    winningOptionId,
    settledAt: Date.now(),
  };
}

export async function createCommunityQuestion(options: {
  tokenAddress: string;
  wallet: string;
  prompt: string;
  optionLabels: string[];
  chain?: string;
}): Promise<CommunityQuestion> {
  const token = normalizeAddr(options.tokenAddress);
  const wallet = options.wallet.toLowerCase();
  const chain = options.chain || 'base';

  const permissions = await resolveSpacePermissions(wallet, token, chain);
  if (!permissions.canCreateQuestion) {
    throw new Error(
      'Only the fee recipient, deployer, delegate, or space admin can post a question'
    );
  }

  const questions = await getQuestions(token);
  const active = questions.filter((q) => q.status === 'active' && q.endsAt > Date.now());
  if (active.length > 0) {
    throw new Error('This space already has an active question. Wait for it to settle first.');
  }

  const prompt = options.prompt.trim();
  if (prompt.length < 8) {
    throw new Error('Question must be at least 8 characters');
  }
  if (prompt.length > 500) {
    throw new Error('Question too long (max 500 characters)');
  }

  const labels = options.optionLabels.map((l) => l.trim()).filter(Boolean);
  if (labels.length < 2) {
    throw new Error('Add at least 2 answer options');
  }
  if (labels.length > 5) {
    throw new Error('Maximum 5 answer options');
  }
  for (const label of labels) {
    if (label.length > 80) {
      throw new Error('Each option must be 80 characters or less');
    }
  }

  const author = await resolveAuthorProfile(wallet);
  const now = Date.now();
  const questionOptions: QuestionOption[] = labels.map((label, i) => ({
    id: newId(`opt${i}`),
    label,
  }));

  const question: CommunityQuestion = {
    id: newId('question'),
    tokenAddress: token,
    wallet,
    author,
    prompt,
    options: questionOptions,
    votes: [],
    createdAt: now,
    endsAt: now + QUESTION_DURATION_MS,
    status: 'active',
    winningOptionId: null,
    settledAt: null,
  };

  questions.unshift(question);
  await setQuestionsForToken(token, questions);
  return question;
}

export async function castQuestionVote(options: {
  questionId: string;
  tokenAddress: string;
  wallet: string;
  optionId: string;
  chain?: string;
}): Promise<CommunityQuestion> {
  const token = normalizeAddr(options.tokenAddress);
  const wallet = options.wallet.toLowerCase();
  const chain = options.chain || 'base';

  const permissions = await resolveSpacePermissions(wallet, token, chain);
  if (!permissions.canVoteOnQuestion) {
    throw new Error('You must hold this token to vote on questions');
  }

  const questions = await getQuestions(token);
  const index = questions.findIndex((q) => q.id === options.questionId);
  if (index === -1) {
    throw new Error('Question not found');
  }

  let question = questions[index];
  if (question.status !== 'active' || Date.now() >= question.endsAt) {
    question = settleQuestionRecord(question);
    questions[index] = question;
    await setQuestionsForToken(token, questions);
    throw new Error('This question has ended');
  }

  if (!question.options.some((o) => o.id === options.optionId)) {
    throw new Error('Invalid option');
  }

  const holdResult = await holdsToken(wallet, token, chain);
  const vote: QuestionVote = {
    wallet,
    optionId: options.optionId,
    balance: holdResult.balance,
    votedAt: Date.now(),
  };

  const withoutWallet = question.votes.filter((v) => v.wallet.toLowerCase() !== wallet);
  question = { ...question, votes: [...withoutWallet, vote] };
  questions[index] = question;
  await setQuestionsForToken(token, questions);
  return question;
}

export async function settleExpiredQuestions(): Promise<{
  settled: number;
  tokens: string[];
}> {
  const all = await getAllQuestions();
  let settled = 0;
  const tokens: string[] = [];
  const now = Date.now();

  for (const [token, questions] of Object.entries(all)) {
    let changed = false;
    const next = questions.map((q) => {
      if (q.status === 'active' && now >= q.endsAt) {
        settled++;
        changed = true;
        tokens.push(token);
        return settleQuestionRecord(q);
      }
      return q;
    });
    if (changed) {
      await setQuestionsForToken(token, next);
    }
  }

  return { settled, tokens: [...new Set(tokens)] };
}

export function questionVoteCounts(question: CommunityQuestion) {
  return tallyQuestionVotes(question);
}

export function userQuestionVote(
  question: CommunityQuestion,
  wallet: string | null | undefined
): QuestionVote | null {
  if (!wallet) return null;
  return (
    question.votes.find((v) => v.wallet.toLowerCase() === wallet.toLowerCase()) || null
  );
}

export type QuestionAuthor = Author;
