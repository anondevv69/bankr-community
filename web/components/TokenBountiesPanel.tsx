'use client';

import { useCallback, useEffect, useState } from 'react';
import { PoidhOpenBountyGuide } from '@/components/PoidhOpenBountyGuide';
import { useAppWallet } from '@/hooks/useAppWallet';
import { poidhBountyUrl } from '@/lib/poidh-api';
import { formatEthPoolLabel } from '@/lib/poidh-format';
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
  onChainActive: boolean | null;
  requestedBy: string | null;
};

type SpinUpView = {
  configured: boolean;
  pendingCount: number;
  agentJobRunning: boolean;
  message: string | null;
  lastError?: string | null;
};

function truncateAddress(addr: string | null): string | null {
  if (!addr) return null;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function bountyExternalUrl(bounty: BountyView): string | null {
  if (bounty.url) return bounty.url;
  if (bounty.poidhBountyId != null) return poidhBountyUrl(bounty.poidhBountyId);
  return null;
}

function statusLabel(bounty: BountyView, spinUp: SpinUpView | null): string {
  if (bounty.status === 'live') {
    return bounty.onChainActive === false ? 'Paid out' : 'Open';
  }
  if (spinUp?.agentJobRunning) return 'Opening on-chain…';
  return 'Opening on-chain';
}

function statusClass(bounty: BountyView): string {
  if (bounty.status === 'live' && bounty.onChainActive !== false) {
    return 'bg-green-500/10 text-green-600 dark:text-green-400';
  }
  if (bounty.status === 'live' && bounty.onChainActive === false) {
    return 'bg-surface-2 text-muted';
  }
  return 'bg-surface-2 text-muted';
}

function pendingHint(spinUp: SpinUpView | null): string {
  if (spinUp?.message) return spinUp.message;
  return 'Opening on POIDH (0.001 ETH seed). This page refreshes automatically.';
}

function pendingHintClass(spinUp: SpinUpView | null): string {
  if (spinUp?.lastError) return 'text-red-600 dark:text-red-400';
  return 'text-muted';
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
      setHint(data.message || 'Bounty created — opening on POIDH…');
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
          Create tasks here or via @bankrbot. Fund, submit proof, claim, and vote on{' '}
          <a
            href="https://poidh.xyz/base"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-hover hover:underline"
          >
            poidh.xyz
          </a>
          . This tab shows what&apos;s open or paid out.
        </p>
        <PoidhOpenBountyGuide collapsible />
      </div>

      {canCreate !== false ? (
        <div className="p-4 rounded-xl border border-accent/30 bg-surface space-y-3">
          <div className="text-sm font-semibold">Create a bounty</div>
          <p className="text-[11px] text-muted">
            Describe anything the community should fund — Dex profile, boost, shoutout, listing,
            design work, etc. It opens on POIDH automatically.
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
        <p className={`text-[11px] px-1 leading-relaxed ${pendingHintClass(spinUp)}`}>
          {pendingHint(spinUp)}
        </p>
      ) : null}

      {bounties.length ? (
        <div className="space-y-3">
          <div className="text-sm font-semibold">Bounties</div>
          {bounties.map((bounty) => {
            const externalUrl = bountyExternalUrl(bounty);
            const poolLabel = formatEthPoolLabel(bounty.amountWei);
            const showDescription =
              bounty.description && bounty.description.trim() !== bounty.title.trim();

            return (
              <div
                key={bounty.id}
                className="p-4 rounded-xl border border-border bg-surface space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{bounty.title}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${statusClass(bounty)}`}
                      >
                        {statusLabel(bounty, spinUp)}
                      </span>
                    </div>
                    {bounty.requestedBy ? (
                      <p className="text-[10px] text-muted mt-0.5">
                        Created by {truncateAddress(bounty.requestedBy)}
                      </p>
                    ) : null}
                    {showDescription ? (
                      <p className="text-xs text-muted mt-1 whitespace-pre-wrap line-clamp-4">
                        {bounty.description}
                      </p>
                    ) : null}
                  </div>
                  {poolLabel ? (
                    <div className="text-sm font-semibold tabular-nums shrink-0 text-right">
                      {poolLabel}
                    </div>
                  ) : null}
                </div>

                {bounty.poidhBountyId != null && bounty.status === 'live' ? (
                  externalUrl ? (
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90"
                    >
                      Open on poidh.xyz ↗
                    </a>
                  ) : null
                ) : (
                  <p className={`text-[11px] leading-relaxed ${pendingHintClass(spinUp)}`}>
                    {pendingHint(spinUp)}
                  </p>
                )}
              </div>
            );
          })}
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
