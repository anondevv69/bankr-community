'use client';

import { useCallback, useEffect, useState } from 'react';
import { PoidhOpenBountyGuide } from '@/components/PoidhOpenBountyGuide';
import { PoidhBountyActions } from '@/components/PoidhBountyActions';
import { useAppWallet } from '@/hooks/useAppWallet';
import { apiFetch } from '@/lib/wagmi';

type BountyView = {
  id: string;
  kind: string;
  title: string;
  description: string;
  status: string;
  poidhBountyId: number | null;
  url: string | null;
  amountWei: string | null;
  requestedBy: string | null;
};

type SpinUpView = {
  configured: boolean;
  pendingCount: number;
  agentJobRunning: boolean;
  message: string | null;
};

function formatEth(wei: string | null): string | null {
  if (!wei) return null;
  try {
    const eth = Number(BigInt(wei)) / 1e18;
    if (eth < 0.001) return `${eth.toFixed(4)} ETH pool`;
    return `${eth.toFixed(3)} ETH pool`;
  } catch {
    return null;
  }
}

function truncateAddress(addr: string | null): string | null {
  if (!addr) return null;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function pendingLabel(bounty: BountyView, spinUp: SpinUpView | null): string {
  if (bounty.status === 'live') return 'Live';
  if (spinUp?.agentJobRunning) return 'Opening on-chain…';
  return 'Opening on-chain';
}

function pendingHint(spinUp: SpinUpView | null): string {
  if (spinUp?.message) return spinUp.message;
  return 'The issuer wallet creates an open bounty on Base (0.001 ETH seed). This page refreshes automatically.';
}

export function TokenBountiesPanel({
  tokenAddress,
  symbol,
  canCreate,
}: {
  tokenAddress: string;
  symbol: string;
  canCreate?: boolean;
}) {
  const { address, isEmbedded, connectWallet } = useAppWallet();
  const [bounties, setBounties] = useState<BountyView[]>([]);
  const [spinUp, setSpinUp] = useState<SpinUpView | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(
    async (options?: { triggerSpinUp?: boolean }) => {
      try {
        const qs = options?.triggerSpinUp ? '?spinUp=1' : '';
        const res = await fetch(`/api/communities/${tokenAddress}/poidh${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setBounties(data.bounties || []);
        setSpinUp(data.spinUp || null);
      } catch (err) {
        setHint(err instanceof Error ? err.message : 'Failed to load bounties');
        setBounties([]);
        setSpinUp(null);
      } finally {
        setLoading(false);
      }
    },
    [tokenAddress]
  );

  useEffect(() => {
    void load({ triggerSpinUp: true });
  }, [load]);

  const hasPending = bounties.some((b) => b.status !== 'live');

  useEffect(() => {
    if (!hasPending) return;
    const id = window.setInterval(() => {
      void load({ triggerSpinUp: true });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [hasPending, load]);

  async function submitCreate() {
    if (!address) {
      connectWallet();
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (!trimmedTitle || !trimmedDesc) {
      setHint('Title and description required.');
      return;
    }
    setSubmitting(true);
    setHint(null);
    try {
      const data = await apiFetch(`/api/communities/${tokenAddress}/poidh/request`, {
        method: 'POST',
        wallet: address,
        client: isEmbedded ? 'bankr-app' : 'web',
        body: JSON.stringify({ title: trimmedTitle, description: trimmedDesc }),
      });
      setTitle('');
      setDescription('');
      setHint(data.message || 'Bounty created.');
      await load({ triggerSpinUp: true });
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Could not create bounty');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <p className="text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface">
        Loading bounties…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl border border-border bg-surface space-y-1">
        <div className="text-sm font-semibold">Community bounties for ${symbol}</div>
        <p className="text-[11px] text-muted leading-relaxed">
          Create a task → opens on-chain automatically → add ETH below → do the work →{' '}
          <strong className="font-medium text-text">post proof in community</strong> → submit claim
          here → contributors vote 48h to pay out.
        </p>
        <PoidhOpenBountyGuide collapsible />
      </div>

      {canCreate !== false ? (
        <div className="p-4 rounded-xl border border-accent/30 bg-surface space-y-3">
          <div className="text-sm font-semibold">Create a bounty</div>
          <p className="text-[11px] text-muted">
            Describe anything the community should fund — Dex profile, boost, shoutout, listing,
            design work, etc.
          </p>
          <input
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
            placeholder="e.g. Pay for CoinGecko listing"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            rows={4}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm resize-y"
            placeholder="What should be done? Include links, requirements, and how to prove it."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submitCreate()}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            {submitting ? 'Creating bounty…' : address ? 'Create bounty' : 'Connect to create'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted text-center py-2">
          Connect and hold ${symbol} to create bounties.
        </p>
      )}

      {hasPending && spinUp ? (
        <p className="text-[11px] text-muted px-1 leading-relaxed">{pendingHint(spinUp)}</p>
      ) : null}

      {bounties.length ? (
        <div className="space-y-3">
          <div className="text-sm font-semibold">Open bounties</div>
          {bounties.map((bounty) => (
            <div
              key={bounty.id}
              className="p-4 rounded-xl border border-border bg-surface space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{bounty.title}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        bounty.status === 'live'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {pendingLabel(bounty, spinUp)}
                    </span>
                  </div>
                  {bounty.requestedBy ? (
                    <p className="text-[10px] text-muted mt-0.5">
                      Created by {truncateAddress(bounty.requestedBy)}
                    </p>
                  ) : null}
                  {bounty.description ? (
                    <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{bounty.description}</p>
                  ) : null}
                </div>
                {formatEth(bounty.amountWei) ? (
                  <div className="text-sm font-semibold tabular-nums shrink-0">
                    {formatEth(bounty.amountWei)}
                  </div>
                ) : null}
              </div>
              {bounty.poidhBountyId != null && bounty.status === 'live' ? (
                <PoidhBountyActions
                  tokenAddress={tokenAddress}
                  symbol={symbol}
                  poidhBountyId={bounty.poidhBountyId}
                  onAction={() => void load()}
                />
              ) : (
                <p className="text-[11px] text-muted">{pendingHint(spinUp)}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted text-sm py-6 border border-dashed border-border rounded-xl bg-surface">
          No bounties yet — create the first one above.
        </p>
      )}

      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
