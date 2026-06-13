import { kvGet, kvSet } from './kv-store';
import { getCommunity } from './db';
import { holdsToken } from './holder';
import { resolveSpacePermissions } from './community-owner';
import { getPetitionUnitBalance } from './petition-unit-holders';
import { resolveAuthorProfile } from './profiles';
import { normalizeAddr } from './utils';
import type { Author, CommunityQuestion, QuestionOption, QuestionVote, QuestionVoteType } from './types';

const QUESTIONS_KEY = 'community_questions';
export const QUESTION_DURATION_MS = 24 * 60 * 60 * 1000;
export const MAX_VOTE_DURATION_HOURS = 24;
export const MIN_VOTE_DURATION_HOURS = 1;

export function parseVoteDurationMs(durationHours?: number): number {
  const h = Number(durationHours);
  const hours = Number.isFinite(h) ? h : MAX_VOTE_DURATION_HOURS;
  const clamped = Math.min(
    MAX_VOTE_DURATION_HOURS,
    Math.max(MIN_VOTE_DURATION_HOURS, Math.round(hours))
  );
  return clamped * 60 * 60 * 1000;
}

export function isQuestionActive(question: CommunityQuestion): boolean {
  return question.status === 'active' && Date.now() < question.endsAt;
}

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
      const weight = question.weightedByUnits ? Math.max(0, vote.balance || 0) : 1;
      counts[vote.optionId] += weight;
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
  const totalVotes = question.weightedByUnits
    ? question.votes.reduce((sum, v) => sum + Math.max(0, v.balance || 0), 0)
    : question.votes.length;
  return {
    counts,
    winningOptionId: max > 0 ? winningOptionId : null,
    totalVotes,
  };
}

export function settleQuestionRecord(
  question: CommunityQuestion,
  options?: { closedBy?: string; closeReason?: 'expired' | 'manual' }
): CommunityQuestion {
  if (question.status === 'settled') return question;
  const { winningOptionId } = tallyQuestionVotes(question);
  return {
    ...question,
    status: 'settled',
    winningOptionId,
    settledAt: Date.now(),
    closeReason: options?.closeReason ?? question.closeReason ?? 'expired',
    closedBy: options?.closedBy ?? question.closedBy ?? null,
  };
}

export const YES_NO_LABELS = ['Yes', 'No'] as const;

export function isYesNoVote(question: CommunityQuestion): boolean {
  if (question.voteType === 'yes_no') return true;
  if (question.voteType === 'choice') return false;
  if (question.options.length !== 2) return false;
  const labels = question.options.map((o) => o.label.trim().toLowerCase());
  return labels[0] === 'yes' && labels[1] === 'no';
}

export async function createCommunityQuestion(options: {
  tokenAddress: string;
  wallet: string;
  prompt: string;
  voteType?: QuestionVoteType;
  optionLabels?: string[];
  durationHours?: number;
  chain?: string;
}): Promise<CommunityQuestion> {
  const token = normalizeAddr(options.tokenAddress);
  const wallet = options.wallet.toLowerCase();
  const chain = options.chain || 'base';

  const permissions = await resolveSpacePermissions(wallet, token, chain);
  if (!permissions.canCreateQuestion) {
    throw new Error(
      'Only the fee recipient, deployer, delegate, or space admin can start a vote'
    );
  }

  const community = await getCommunity(token);
  const weightedByUnits = !!(community?.fromPetition || permissions.voteUsesUnits);

  const questions = await getQuestions(token);
  const active = questions.filter((q) => isQuestionActive(q));
  if (active.length > 0) {
    throw new Error('This space already has an active vote. Wait for it to settle first.');
  }

  const prompt = options.prompt.trim();
  if (prompt.length < 8) {
    throw new Error('Vote question must be at least 8 characters');
  }
  if (prompt.length > 500) {
    throw new Error('Vote question too long (max 500 characters)');
  }

  const voteType: QuestionVoteType =
    options.voteType === 'choice' ? 'choice' : 'yes_no';
  const labels =
    voteType === 'yes_no'
      ? [...YES_NO_LABELS]
      : (options.optionLabels || []).map((l) => l.trim()).filter(Boolean);

  if (voteType === 'choice') {
    if (labels.length < 2) {
      throw new Error('Add at least 2 answer choices');
    }
    if (labels.length > 4) {
      throw new Error('Maximum 4 answer choices');
    }
    for (const label of labels) {
      if (label.length > 80) {
        throw new Error('Each answer must be 80 characters or less');
      }
    }
  }

  const author = await resolveAuthorProfile(wallet);
  const now = Date.now();
  const durationMs = parseVoteDurationMs(options.durationHours);
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
    voteType,
    options: questionOptions,
    votes: [],
    createdAt: now,
    durationMs,
    endsAt: now + durationMs,
    status: 'active',
    winningOptionId: null,
    settledAt: null,
    closeReason: undefined,
    closedBy: null,
    weightedByUnits: weightedByUnits || undefined,
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
    throw new Error(
      permissions.voteUsesUnits
        ? 'You must hold fee-right units from this petition to vote'
        : 'You must hold this token to vote'
    );
  }

  const questions = await getQuestions(token);
  const index = questions.findIndex((q) => q.id === options.questionId);
  if (index === -1) {
    throw new Error('Question not found');
  }

  let question = questions[index];
  if (!isQuestionActive(question)) {
    question = settleQuestionRecord(question, { closeReason: 'expired' });
    questions[index] = question;
    await setQuestionsForToken(token, questions);
    throw new Error('This vote has ended');
  }

  if (!question.options.some((o) => o.id === options.optionId)) {
    throw new Error('Invalid option');
  }

  const voteWeight = permissions.voteUsesUnits
    ? permissions.unitBalance
    : (await holdsToken(wallet, token, chain)).balance;
  const vote: QuestionVote = {
    wallet,
    optionId: options.optionId,
    balance: voteWeight,
    votedAt: Date.now(),
  };

  const withoutWallet = question.votes.filter((v) => v.wallet.toLowerCase() !== wallet);
  question = { ...question, votes: [...withoutWallet, vote] };
  questions[index] = question;
  await setQuestionsForToken(token, questions);
  return question;
}

export async function closeCommunityQuestion(options: {
  questionId: string;
  tokenAddress: string;
  wallet: string;
  chain?: string;
}): Promise<CommunityQuestion> {
  const token = normalizeAddr(options.tokenAddress);
  const wallet = options.wallet.toLowerCase();
  const chain = options.chain || 'base';

  const permissions = await resolveSpacePermissions(wallet, token, chain);
  if (!permissions.canCreateQuestion) {
    throw new Error('Only space admins can close a vote early');
  }

  const questions = await getQuestions(token);
  const index = questions.findIndex((q) => q.id === options.questionId);
  if (index === -1) {
    throw new Error('Vote not found');
  }

  let question = questions[index];
  if (!isQuestionActive(question)) {
    if (question.status !== 'settled') {
      question = settleQuestionRecord(question, { closeReason: 'expired' });
      questions[index] = question;
      await setQuestionsForToken(token, questions);
    }
    throw new Error('This vote is already closed');
  }

  question = settleQuestionRecord(question, {
    closedBy: wallet,
    closeReason: 'manual',
  });
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
        return settleQuestionRecord(q, { closeReason: 'expired' });
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
