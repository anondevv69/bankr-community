'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import { AuthorBlock } from '@/components/AuthorBlock';
import { apiFetch } from '@/lib/wagmi';
import { formatTime } from '@/lib/utils';
import type { CommunityQuestion, QuestionOption, QuestionVoteType } from '@/lib/types';

type QuestionView = CommunityQuestion & {
  tallies: {
    counts: Record<string, number>;
    winningOptionId: string | null;
    totalVotes: number;
  };
  userVote?: { optionId: string } | null;
};

function voteCountLabel(count: number, weightedByUnits?: boolean): string {
  if (weightedByUnits) {
    return `${count} unit${count === 1 ? '' : 's'}`;
  }
  return `${count} vote${count === 1 ? '' : 's'}`;
}

function isYesNoBallot(question: QuestionView): boolean {
  if (question.voteType === 'yes_no') return true;
  if (question.voteType === 'choice') return false;
  if (question.options.length !== 2) return false;
  const labels = question.options.map((o) => o.label.trim().toLowerCase());
  return labels[0] === 'yes' && labels[1] === 'no';
}

function timeLeft(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return 'Ending soon';
}

function YesNoButtons({
  options,
  counts,
  total,
  selectedId,
  disabled,
  onVote,
  weightedByUnits,
}: {
  options: QuestionOption[];
  counts: Record<string, number>;
  total: number;
  selectedId: string | null;
  disabled: boolean;
  onVote: (optionId: string) => void;
  weightedByUnits?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option, i) => {
        const count = counts[option.id] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const selected = selectedId === option.id;
        const isYes = i === 0;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onVote(option.id)}
            className={`rounded-xl border px-3 py-4 text-center transition-colors ${
              selected
                ? isYes
                  ? 'border-green-500 bg-green-500/15'
                  : 'border-red-500/70 bg-red-500/10'
                : disabled
                  ? 'border-border bg-surface-2 cursor-default'
                  : isYes
                    ? 'border-border bg-surface-2 hover:border-green-500/50'
                    : 'border-border bg-surface-2 hover:border-red-500/40'
            }`}
          >
            <div className="text-base font-semibold">{option.label}</div>
            <div className="text-xs text-muted mt-1 tabular-nums">
              {pct}% · {voteCountLabel(count, weightedByUnits)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ChoiceOption({
  option,
  count,
  total,
  selected,
  disabled,
  onVote,
  weightedByUnits,
}: {
  option: QuestionOption;
  count: number;
  total: number;
  selected: boolean;
  disabled: boolean;
  onVote: () => void;
  weightedByUnits?: boolean;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onVote}
      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        selected
          ? 'border-accent bg-accent/10'
          : disabled
            ? 'border-border bg-surface-2 cursor-default'
            : 'border-border bg-surface-2 hover:border-accent/50'
      }`}
    >
      <div className="flex justify-between gap-2 mb-1.5">
        <span className="font-medium">{option.label}</span>
        <span className="text-xs text-muted tabular-nums shrink-0">
          {pct}% · {weightedByUnits ? `${count} units` : count}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

function VoteCard({
  question,
  canVote,
  canClose,
  onVoted,
}: {
  question: QuestionView;
  canVote: boolean;
  canClose: boolean;
  onVoted: () => void;
}) {
  const { address } = useAppWallet();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const isActive = question.status === 'active' && Date.now() < question.endsAt;
  const yesNo = isYesNoBallot(question);

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

  async function closePoll() {
    if (!address || !canClose || !isActive) return;
    if (!window.confirm('Close this vote now and settle results?')) return;
    setBusy(true);
    try {
      await apiFetch(`/api/questions/${question.id}/vote`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({
          tokenAddress: question.tokenAddress,
          action: 'close',
        }),
      });
      onVoted();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to close vote');
    } finally {
      setBusy(false);
    }
  }

  const userOptionId = question.userVote?.optionId || null;
  const winnerLabel = question.winningOptionId
    ? question.options.find((o) => o.id === question.winningOptionId)?.label
    : null;

  return (
    <article className="p-4 rounded-xl border border-border bg-surface space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <AuthorBlock author={question.author} compact />
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted">
            {yesNo ? 'Yes / No' : 'Multiple choice'}
          </span>
        </div>
        <div className="text-right text-[10px] text-muted shrink-0">
          {isActive ? (
            <span className="text-accent font-medium">{timeLeft(question.endsAt)}</span>
          ) : (
            <span className="uppercase tracking-wide text-green-600 dark:text-green-400">
              {question.closeReason === 'manual' ? 'Closed early' : 'Settled'}
            </span>
          )}
          <div>{formatTime(question.createdAt)}</div>
          {canClose && isActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void closePoll()}
              className="mt-1 text-[10px] text-red-500 hover:underline disabled:opacity-50"
            >
              {busy ? 'Closing…' : 'Close vote'}
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-sm font-medium whitespace-pre-wrap leading-snug">{question.prompt}</p>

      {yesNo ? (
        <YesNoButtons
          options={question.options}
          counts={question.tallies.counts}
          total={question.tallies.totalVotes}
          selectedId={userOptionId}
          disabled={!isActive || !canVote || busy}
          onVote={(id) => void vote(id)}
          weightedByUnits={question.weightedByUnits}
        />
      ) : (
        <div className="space-y-2">
          {question.options.map((option) => (
            <ChoiceOption
              key={option.id}
              option={option}
              count={question.tallies.counts[option.id] || 0}
              total={question.tallies.totalVotes}
              selected={userOptionId === option.id}
              disabled={!isActive || !canVote || busy}
              onVote={() => void vote(option.id)}
              weightedByUnits={question.weightedByUnits}
            />
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted">
        {question.weightedByUnits
          ? `${question.tallies.totalVotes} fee-right unit${question.tallies.totalVotes === 1 ? '' : 's'} cast`
          : `${question.tallies.totalVotes} holder vote${question.tallies.totalVotes === 1 ? '' : 's'}`}
        {isActive && canVote
          ? userOptionId
            ? ' · tap another answer to change your vote'
            : ' · tap to cast your vote'
          : null}
        {!isActive && winnerLabel ? (
          <>
            {' '}
            · <strong className="text-text">Result: {winnerLabel}</strong>
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
  const [voteType, setVoteType] = useState<QuestionVoteType>('yes_no');
  const [prompt, setPrompt] = useState('');
  const [choices, setChoices] = useState(['', '']);
  const [durationHours, setDurationHours] = useState(24);

  const DURATION_OPTIONS = [1, 3, 6, 12, 24];

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

  async function submitVote() {
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
          voteType,
          durationHours,
          options: voteType === 'choice' ? choices.filter((o) => o.trim()) : undefined,
        }),
      });
      setPrompt('');
      setChoices(['', '']);
      setVoteType('yes_no');
      setDurationHours(24);
      setShowForm(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start vote');
    } finally {
      setCreating(false);
    }
  }

  const hasActive = questions.some((q) => q.status === 'active' && Date.now() < q.endsAt);

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-muted border border-border rounded-xl bg-surface">
        Loading votes…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Holder votes</h2>
            <p className="text-[11px] text-muted mt-1 leading-snug">
              Space admins put a yes/no or multiple-choice question to holders. Choose how long
              the ballot stays open (max 24 hours), then results settle automatically.
            </p>
          </div>
          {canCreate && !hasActive ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="shrink-0 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg"
            >
              {showForm ? 'Cancel' : 'Start vote'}
            </button>
          ) : null}
        </div>

        {canCreate && hasActive ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            One active vote at a time — close the current ballot or wait for it to settle before
            starting another.
          </p>
        ) : null}

        {!isConnected ? (
          <p className="text-[11px] text-muted">
            <button type="button" onClick={connectWallet} className="text-accent-hover underline">
              Connect wallet
            </button>{' '}
            to vote{canCreate ? ' or start a ballot' : ''}.
          </p>
        ) : canVote ? (
          <p className="text-[11px] text-green-600 dark:text-green-400">
            ✓ You hold this token — you can vote on active ballots
          </p>
        ) : (
          <p className="text-[11px] text-muted">Hold this token to vote.</p>
        )}
      </div>

      {showForm && canCreate ? (
        <div className="p-4 rounded-xl border border-accent/30 bg-surface space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVoteType('yes_no')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border ${
                voteType === 'yes_no'
                  ? 'bg-accent text-white border-accent'
                  : 'border-border bg-surface-2'
              }`}
            >
              Yes / No
            </button>
            <button
              type="button"
              onClick={() => setVoteType('choice')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border ${
                voteType === 'choice'
                  ? 'bg-accent text-white border-accent'
                  : 'border-border bg-surface-2'
              }`}
            >
              Multiple choice
            </button>
          </div>

          <label className="block text-xs text-muted">
            {voteType === 'yes_no' ? 'Question for holders' : 'Question'}
            <textarea
              rows={3}
              maxLength={500}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                voteType === 'yes_no'
                  ? 'Should we apply for a DexScreener boost this week?'
                  : 'Which direction should we take?'
              }
              className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm resize-y"
            />
          </label>

          {voteType === 'yes_no' ? (
            <p className="text-[11px] text-muted">
              Holders vote <strong className="text-text">Yes</strong> or{' '}
              <strong className="text-text">No</strong>.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted">Answer choices (2–4)</div>
              {choices.map((opt, i) => (
                <input
                  key={i}
                  maxLength={80}
                  value={opt}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setChoices(next);
                  }}
                  placeholder={
                    i === 0
                      ? 'e.g. Focus on marketing'
                      : i === 1
                        ? 'e.g. Focus on product'
                        : `Choice ${i + 1}`
                  }
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                />
              ))}
              {choices.length < 4 ? (
                <button
                  type="button"
                  onClick={() => setChoices([...choices, ''])}
                  className="text-xs text-accent-hover hover:underline"
                >
                  + Add choice
                </button>
              ) : null}
            </div>
          )}

          <label className="block text-xs text-muted">
            Voting window (max 24 hours)
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDurationHours(h)}
                  className={`px-2.5 py-1 text-xs rounded-lg border ${
                    durationHours === h
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'border-border bg-surface-2 text-muted'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </label>

          <button
            type="button"
            disabled={
              creating ||
              prompt.trim().length < 8 ||
              (voteType === 'choice' && choices.filter((c) => c.trim()).length < 2)
            }
            onClick={() => void submitVote()}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            {creating ? 'Starting…' : `Open vote for ${durationHours}h`}
          </button>
        </div>
      ) : null}

      {questions.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted border border-dashed border-border rounded-xl">
          No votes yet.
        </div>
      ) : (
        questions.map((q) => (
          <VoteCard
            key={q.id}
            question={q}
            canVote={canVote}
            canClose={canCreate}
            onVoted={load}
          />
        ))
      )}
    </div>
  );
}
