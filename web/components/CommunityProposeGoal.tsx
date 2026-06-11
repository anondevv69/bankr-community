'use client';

import { useState } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import {
  AGENT_POOL_SKILL_META,
  AGENT_POOL_SKILL_IDS,
  WORK_BRIEF_MAX_LENGTH,
  WORK_BRIEF_PLACEHOLDER,
} from '@/lib/agent-pool';
import { WORK_BRIEF_NOTE } from '@/lib/platform-agent-ui';
import type { AgentPoolSkillId } from '@/lib/types';
import { apiFetch } from '@/lib/wagmi';

export function CommunityProposeGoal({
  tokenAddress,
  symbol,
  onProposed,
}: {
  tokenAddress: string;
  symbol: string;
  onProposed: () => void;
}) {
  const { address, isEmbedded, connectWallet } = useAppWallet();
  const [skillId, setSkillId] = useState<AgentPoolSkillId>('0xwork');
  const [goalUsd, setGoalUsd] = useState('50');
  const [workBrief, setWorkBrief] = useState(`Share $${symbol} on X with screenshot — $5 — Social`);
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  async function submit() {
    if (!address) {
      connectWallet();
      return;
    }

    const goal = Math.max(1, Number(goalUsd) || 1);
    setSubmitting(true);
    setHint(null);
    try {
      const data = await apiFetch(`/api/communities/${tokenAddress}/agent-pool/propose`, {
        method: 'POST',
        wallet: address,
        client: isEmbedded ? 'bankr-app' : 'web',
        body: JSON.stringify({
          skillId,
          goalUsd: goal,
          workBrief: skillId === '0xwork' ? workBrief : undefined,
          label: AGENT_POOL_SKILL_META[skillId].label,
        }),
      });
      setHint(data.message || 'Goal proposed — fund it below.');
      onProposed();
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Could not propose goal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 rounded-xl border border-accent/30 bg-surface space-y-3">
      <div>
        <div className="text-sm font-semibold">Propose a community goal</div>
        <p className="text-[11px] text-muted mt-1 leading-snug">
          Holders choose what the Bankr Space Agent should do for ${symbol}. One open
          community goal at a time — once people contribute, it cannot be closed until the
          goal is met.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {AGENT_POOL_SKILL_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSkillId(id)}
            className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
              skillId === id
                ? 'bg-surface-2 border border-border text-text'
                : 'text-muted hover:text-text'
            }`}
          >
            {id === 'qrcoin' ? 'QRCoin' : '0xWork'}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Goal USD</label>
        <input
          type="number"
          min={1}
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
          value={goalUsd}
          onChange={(e) => setGoalUsd(e.target.value)}
        />
      </div>

      {skillId === '0xwork' ? (
        <div>
          <label className="block text-xs text-muted mb-1">What should workers do?</label>
          <p className="text-[10px] text-muted mb-1.5">{WORK_BRIEF_NOTE}</p>
          <textarea
            rows={4}
            maxLength={WORK_BRIEF_MAX_LENGTH}
            placeholder={WORK_BRIEF_PLACEHOLDER.replace(/\$SYMBOL/g, `$${symbol}`)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono leading-relaxed resize-y"
            value={workBrief}
            onChange={(e) => setWorkBrief(e.target.value.slice(0, WORK_BRIEF_MAX_LENGTH))}
          />
        </div>
      ) : (
        <p className="text-[11px] text-muted">
          Agent will place a qrcoin.fun bid with this space&apos;s URL when funded.
        </p>
      )}

      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit()}
        className="w-full px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
      >
        {submitting ? 'Proposing…' : address ? 'Propose community goal' : 'Connect to propose'}
      </button>

      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
