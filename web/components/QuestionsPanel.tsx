'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import { AuthorBlock } from '@/components/AuthorBlock';
import { apiFetch } from '@/lib/wagmi';
import { formatTime } from '@/lib/utils';
import type { CommunityQuestion, QuestionOption } from '@/lib/types';

type QuestionView = CommunityQuestion & {
  tallies: {
    counts: Record<string, number>;
    winningOptionId: string | null;
    totalVotes: number;
  };
  userVote?: { optionId: string } | null;
};

function timeLeft(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return 'Ending soon';
}

function OptionBar({
  option,
  count,
  total,
  selected,
  disabled,
  onVote,
}: {
  option: QuestionOption;
  count: number;
  total: number;
  selected: boolean;
  disabled: boolean;
  onVote: () => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onVote}
      className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
        selected
          ? 'border-accent bg-accent/10'
          : disabled
            ? 'border-border bg-surface-2 cursor-default'
            : 'border-border bg-surface-2 hover:border-accent/50'
      }`}
    >
      <div className="flex justify-between gap-2 mb-1">
        <span>{option.label}</span>
        <span className="text-xs text-muted tabular-nums shrink-0">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

function QuestionCard({
  question,
  canVote,
  onVoted,
}: {
  question: QuestionView;
  canVote: boolean;
  onVoted: () => void;
}) {
  const { address } = useAppWallet();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const isActive = question.status === 'active' && Date.now() < question.endsAt;

  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [isActive]);

  void tick;

  async function vote(optionId: string) {
    if (!address || !canVote || !isActive) return;
    setBusy(true);
    try {
      await apiFetch(`/api/questions/${question.id}/vote`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({
          tokenAddress: question.tokenAddress,
          optionId,
        }),
      });
      onVoted();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setBusy(false);
    }
  }

  const userOptionId = question.userVote?.optionId || null;

  return (
    <article className="p-4 rounded-xl border border-border bg-surface space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <AuthorBlock author={question.author} compact />
        <div className="text-right text-[10px] text-muted">
          {isActive ? (
            <span className="text-accent font-medium">{timeLeft(question.endsAt)}</span>
          ) : (
            <span className="uppercase tracking-wide">Settled</span>
          )}
          <div>{formatTime(question.createdAt)}</div>
        </div>
      </div>

      <p className="text-sm font-medium whitespace-pre-wrap">{question.prompt}</p>

      <div className="space-y-2">
        {question.options.map((option) => (
          <OptionBar
            key={option.id}
            option={option}
            count={question.tallies.counts[option.id] || 0}
            total={question.tallies.totalVotes}
            selected={userOptionId === option.id}
            disabled={!isActive || !canVote || busy}
            onVote={() => void vote(option.id)}
          />
        ))}
      </div>

      <p className="text-[10px] text-muted">
        {question.tallies.totalVotes} vote{question.tallies.totalVotes === 1 ? '' : 's'} · holders
        only
        {isActive && canVote
          ? userOptionId
            ? ' · tap another option to change your vote'
            : ' · tap an option to vote'
          : null}
        {!isActive && question.winningOptionId ? (
          <>
            {' '}
            · winner:{' '}
            <strong className="text-text">
              {question.options.find((o) => o.id === question.winningOptionId)?.label || '—'}
            </strong>
          </>
        ) : null}
      </p>
    </article>
  );
}

export function QuestionsPanel({
  tokenAddress,
  canCreate,
  canVote,
}: {
  tokenAddress: string;
  canCreate: boolean;
  canVote: boolean;
}) {
  const { address, connectWallet, isConnected } = useAppWallet();
  const [questions, setQuestions] = useState<QuestionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState(['', '']);

  const load = useCallback(async () => {
    try {
      const qs = address ? `?wallet=${address}` : '';
      const res = await fetch(`/api/communities/${tokenAddress}/questions${qs}`);
      const data = await res.json();
      if (res.ok) setQuestions(data.questions || []);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [address, tokenAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hasActive = questions.some(
      (q) => q.status === 'active' && Date.now() < q.endsAt
    );
    if (!hasActive) return;
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load, questions]);

  async function submitQuestion() {
    if (!address) {
      connectWallet();
      return;
    }
    setCreating(true);
    try {
      await apiFetch(`/api/communities/${tokenAddress}/questions`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({
          prompt,
          options: options.filter((o) => o.trim()),
        }),
      });
      setPrompt('');
      setOptions(['', '']);
      setShowForm(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post question');
    } finally {
      setCreating(false);
    }
  }

  const hasActive = questions.some((q) => q.status === 'active' && Date.now() < q.endsAt);

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-muted border border-border rounded-xl bg-surface">
        Loading questions…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Holder questions</h2>
            <p className="text-[11px] text-muted mt-1 leading-snug">
              Space admins post a question; token holders vote for 24 hours, then results settle
              automatically.
            </p>
          </div>
          {canCreate && !hasActive ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="shrink-0 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg"
            >
              {showForm ? 'Cancel' : 'Ask question'}
            </button>
          ) : null}
        </div>

        {canCreate && hasActive ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            One active question at a time — wait for the current poll to settle before posting
            another.
          </p>
        ) : null}

        {!isConnected ? (
          <p className="text-[11px] text-muted">
            <button type="button" onClick={connectWallet} className="text-accent-hover underline">
              Connect wallet
            </button>{' '}
            to vote{canCreate ? ' or post questions' : ''}.
          </p>
        ) : canVote ? (
          <p className="text-[11px] text-green-600 dark:text-green-400">
            ✓ You hold this token — you can vote on active questions
          </p>
        ) : (
          <p className="text-[11px] text-muted">Hold this token to vote on questions.</p>
        )}
      </div>

      {showForm && canCreate ? (
        <div className="p-4 rounded-xl border border-accent/30 bg-surface space-y-3">
          <label className="block text-xs text-muted">
            Question
            <textarea
              rows={3}
              maxLength={500}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should we prioritize next?"
              className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm resize-y"
            />
          </label>
          <div className="space-y-2">
            <div className="text-xs text-muted">Answer options (2–5)</div>
            {options.map((opt, i) => (
              <input
                key={i}
                maxLength={80}
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`Option ${i + 1}`}
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
              />
            ))}
            {options.length < 5 ? (
              <button
                type="button"
                onClick={() => setOptions([...options, ''])}
                className="text-xs text-accent-hover hover:underline"
              >
                + Add option
              </button>
            ) : null}
          </div>
          <button
            type="button"
            disabled={creating || prompt.trim().length < 8}
            onClick={() => void submitQuestion()}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            {creating ? 'Posting…' : 'Post question (24h)'}
          </button>
        </div>
      ) : null}

      {questions.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted border border-dashed border-border rounded-xl">
          No questions yet.
        </div>
      ) : (
        questions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            canVote={canVote}
            onVoted={load}
          />
        ))
      )}
    </div>
  );
}
