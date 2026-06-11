'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { payAgentPoolFund, SPACE_FUND_X402_MAX_USDC } from '@/lib/x402-pay';
import { useAppWallet } from '@/hooks/useAppWallet';
import { usePaymentWalletClient } from '@/hooks/usePaymentWalletClient';
import type { AgentPoolSkillId } from '@/lib/types';

type AgentPoolView = {
  skillId: AgentPoolSkillId;
  label: string;
  goalUsd: number;
  raisedUsd: number;
  progressPct: number;
  remainingUsd: number;
  funded: boolean;
  workBrief?: string | null;
};

const PRESET_PAYMENTS = [1, 5, 10];

export function AgentPoolWidget({
  tokenAddress,
  symbol,
  refreshKey,
}: {
  tokenAddress: string;
  symbol: string;
  refreshKey?: string;
}) {
  const { isEmbedded, connectWallet } = useAppWallet();
  const { address, isConnected, onBase } = usePaymentWalletClient();
  const { switchChain } = useSwitchChain();
  const [campaigns, setCampaigns] = useState<AgentPoolView[]>([]);
  const [x402BaseUrl, setX402BaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('5');
  const [activeSkillId, setActiveSkillId] = useState<AgentPoolSkillId>('qrcoin');
  const [payHint, setPayHint] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}/agent-pool`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const open = (data.campaigns || []).filter((c: AgentPoolView) => !c.funded);
      setCampaigns(open);
      setX402BaseUrl(data.x402BaseUrl || null);
      if (open[0]?.skillId) {
        setActiveSkillId(open[0].skillId);
      }
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function contribute(paymentCount: number) {
    const skillId = activeSkillId;
    const count = Math.max(1, Math.min(10, Math.round(paymentCount)));
    if (!x402BaseUrl) {
      setPayHint('Community agent pool x402 is not configured yet.');
      return;
    }

    if (isEmbedded) {
      setPayHint(
        `On bankr.space in a browser, connect a Base wallet with USDC to fund the community agent for ${symbol}.`
      );
      return;
    }

    if (!isConnected) {
      setPayHint('Connect a Base wallet with USDC to pay.');
      connectWallet();
      return;
    }

    if (!onBase) {
      setPayHint('Switch your wallet to Base network, then try again.');
      switchChain({ chainId: base.id });
      return;
    }

    if (!address) {
      connectWallet();
      return;
    }

    setPaying(true);
    setPayHint(
      count > 1
        ? `Authorizing ${count} × $${SPACE_FUND_X402_MAX_USDC} USDC to the community agent pool…`
        : `Approve $${SPACE_FUND_X402_MAX_USDC} USDC via Bankr x402.`
    );

    try {
      let last: Awaited<ReturnType<typeof payAgentPoolFund>> | null = null;
      for (let i = 0; i < count; i++) {
        if (count > 1) {
          setPayHint(`Payment ${i + 1} of ${count} — approve in wallet…`);
        }
        last = await payAgentPoolFund(address, tokenAddress, skillId, SPACE_FUND_X402_MAX_USDC);
        if (!last.success) {
          setPayHint(last.error || `Payment ${i + 1} did not complete.`);
          break;
        }
      }

      if (last?.success) {
        const totalUsd = count * SPACE_FUND_X402_MAX_USDC;
        setPayHint(
          last.message ||
            `Thank you — $${totalUsd} credited to the agent pool. Progress: $${last.raisedUsd ?? '?'} / $${last.goalUsd ?? '?'}.`
        );
        await load();
      }
    } catch (err) {
      setPayHint(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-4 p-5 rounded-xl border border-accent/30 bg-surface text-sm text-muted">
        Loading community agent goals…
      </div>
    );
  }

  if (!campaigns.length) {
    return null;
  }

  const active = campaigns.find((c) => c.skillId === activeSkillId) || campaigns[0];

  return (
    <div className="mt-4 p-4 md:p-5 rounded-xl border border-accent/40 bg-surface ring-1 ring-accent/10">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-sm font-semibold">Fund the community agent</div>
          <p className="text-xs text-muted mt-1">
            Holders chip in so the Bankr Space Agent can run tasks for ${symbol} — QRCoin
            listings, 0xWork bounties, and more. USDC goes to the platform agent wallet, not the
            fee recipient.
          </p>
        </div>

        {campaigns.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {campaigns.map((c) => (
              <button
                key={c.skillId}
                type="button"
                onClick={() => setActiveSkillId(c.skillId)}
                className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
                  active.skillId === c.skillId
                    ? 'bg-surface-2 border border-border text-text'
                    : 'text-muted hover:text-text'
                }`}
              >
                {c.skillId === 'qrcoin' ? 'QRCoin' : '0xWork'}
              </button>
            ))}
          </div>
        ) : null}

        <div>
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <div className="text-sm font-medium">{active.label}</div>
            <div className="text-xs text-muted tabular-nums">
              ${active.raisedUsd.toLocaleString()} / ${active.goalUsd.toLocaleString()}
            </div>
          </div>
          <div className="h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${active.progressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted mt-1">
            ${active.remainingUsd.toLocaleString()} remaining · agent executes when goal is met
          </p>
          {active.skillId === '0xwork' && active.workBrief?.trim() ? (
            <div className="mt-2 p-2 rounded-md border border-border bg-bg/50">
              <div className="text-[10px] uppercase tracking-wide text-muted mb-1">
                Planned work
              </div>
              <pre className="text-[11px] text-muted whitespace-pre-wrap font-sans leading-snug">
                {active.workBrief.trim()}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESET_PAYMENTS.map((count) => (
            <button
              key={count}
              type="button"
              disabled={paying}
              onClick={() => void contribute(count)}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent bg-surface-2 disabled:opacity-50"
            >
              +${count * SPACE_FUND_X402_MAX_USDC}
            </button>
          ))}
          <input
            type="number"
            min={1}
            step={1}
            value={customAmount}
            disabled={paying}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-16 px-2 py-1.5 bg-bg border border-border rounded-lg text-sm"
            aria-label="Number of payments"
          />
          <button
            type="button"
            disabled={paying}
            onClick={() =>
              void contribute(Math.max(1, Math.min(10, Number(customAmount) || 1)))
            }
            className="px-4 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            {paying ? 'Paying…' : 'Fund agent'}
          </button>
        </div>

        {payHint ? (
          <p className="text-xs text-muted border-t border-border pt-3">{payHint}</p>
        ) : (
          <p className="text-[11px] text-muted leading-snug">
            ${SPACE_FUND_X402_MAX_USDC} USDC per click · Lane B community pool ·{' '}
            <a
              href="https://skills.bankr.bot/"
              target="_blank"
              rel="noreferrer"
              className="text-accent-hover hover:underline"
            >
              Bankr Skills
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
