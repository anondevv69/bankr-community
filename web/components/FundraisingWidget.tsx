'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { buildSpaceFundUrl, campaignProgress } from '@/lib/fundraising';
import { paySpaceFundUrl, SPACE_FUND_X402_MAX_USDC } from '@/lib/x402-pay';
import { useAppWallet } from '@/hooks/useAppWallet';
import { usePaymentWalletClient } from '@/hooks/usePaymentWalletClient';
import type { FundraisingCampaign } from '@/lib/types';

type FundraisingView = FundraisingCampaign & {
  progressPct: number;
  remainingUsd: number;
  funded: boolean;
};

const PRESET_AMOUNTS = [5, 25, 50];

export function FundraisingWidget({
  tokenAddress,
  symbol,
  refreshKey,
  layout = 'horizontal',
}: {
  tokenAddress: string;
  symbol: string;
  refreshKey?: string;
  layout?: 'horizontal' | 'sidebar';
}) {
  const { isEmbedded, connectWallet } = useAppWallet();
  const { address, isConnected, onBase } = usePaymentWalletClient();
  const { switchChain } = useSwitchChain();
  const [campaigns, setCampaigns] = useState<FundraisingView[]>([]);
  const [x402BaseUrl, setX402BaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('10');
  const [activeCampaignId, setActiveCampaignId] = useState<string>('dex-profile');
  const [payHint, setPayHint] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}/fundraising`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCampaigns(data.campaigns || []);
      setX402BaseUrl(data.x402BaseUrl || null);
      if (data.campaigns?.[0]?.id) {
        setActiveCampaignId(data.campaigns[0].id);
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

  async function contribute(amountUsd: number) {
    const campaignId = activeCampaignId;
    if (!x402BaseUrl) {
      setPayHint(
        `x402 payments are not configured yet. Ask the space operator to set NEXT_PUBLIC_X402_SPACE_FUND_URL, or tip via @bankrbot: fund $${amountUsd} to ${symbol} space for Dex.`
      );
      return;
    }

    if (isEmbedded) {
      setPayHint(
        `In the Bankr app, pay via @bankrbot: fund $${amountUsd} to ${symbol} space for Dex. On bankr.space, connect a Base wallet with USDC and try again.`
      );
      return;
    }

    if (!isConnected) {
      setPayHint('Connect a Base wallet with USDC to pay.');
      connectWallet();
      return;
    }

    if (!onBase) {
      setPayHint('Switch your wallet to Base network, then try Contribute again.');
      switchChain({ chainId: base.id });
      return;
    }

    if (!address) {
      setPayHint('Connect a Base wallet with USDC to pay.');
      connectWallet();
      return;
    }

    const url = buildSpaceFundUrl(x402BaseUrl, tokenAddress, campaignId, amountUsd);
    setPaying(true);
    setPayHint(`Confirm the $${SPACE_FUND_X402_MAX_USDC} USDC payment in your wallet…`);

    try {
      const result = await paySpaceFundUrl(address, url);
      if (result.success) {
        setPayHint(
          result.message ||
            `Thank you — $${amountUsd} credited. Progress: $${result.raisedUsd ?? '?'} / $${result.goalUsd ?? '?'}.`
        );
        await load();
      } else {
        setPayHint(result.error || 'Payment did not complete.');
      }
    } catch (err) {
      setPayHint(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`p-5 rounded-xl border border-border bg-surface text-sm text-muted ${
          layout === 'horizontal' ? 'mt-4' : ''
        }`}
      >
        Loading fund…
      </div>
    );
  }

  if (!campaigns.length) {
    return null;
  }

  const active =
    campaigns.find((c) => c.id === activeCampaignId) || campaigns[0];

  const campaignTabs =
    campaigns.length > 1 ? (
      <div className="flex flex-wrap gap-1">
        {campaigns.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCampaignId(c.id)}
            className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
              active.id === c.id
                ? 'bg-surface-2 border border-border text-text'
                : 'text-muted hover:text-text'
            }`}
          >
            {c.id === 'dex-profile' ? 'Dex profile' : c.id === 'dex-boost' ? 'Dex boost' : 'Custom'}
          </button>
        ))}
      </div>
    ) : null;

  const progressBlock = (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="text-sm font-medium truncate">{active.label}</div>
        <div className="text-xs text-muted tabular-nums shrink-0">
          ${active.raisedUsd.toLocaleString()} / ${active.goalUsd.toLocaleString()}
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
        <div
          className={`h-full transition-all ${active.funded ? 'bg-green-500' : 'bg-accent'}`}
          style={{ width: `${campaignProgress(active)}%` }}
        />
      </div>
      <p className="text-[11px] text-muted mt-1">
        {active.funded ? (
          <span className="text-green-600 dark:text-green-400">Goal reached — thank you!</span>
        ) : (
          <>${active.remainingUsd.toLocaleString()} remaining</>
        )}
      </p>
    </div>
  );

  const controlsBlock = (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {PRESET_AMOUNTS.map((amount) => (
        <button
          key={amount}
          type="button"
          disabled={paying}
          onClick={() => void contribute(amount)}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent bg-surface-2 disabled:opacity-50"
        >
          ${amount}
        </button>
      ))}
      <input
        type="number"
        min={1}
        step={1}
        value={customAmount}
        disabled={paying}
        onChange={(e) => setCustomAmount(e.target.value)}
        className="w-16 px-2 py-1.5 bg-bg border border-border rounded-lg text-sm disabled:opacity-50"
        placeholder="USD"
        aria-label="Custom contribution amount"
      />
      <button
        type="button"
        disabled={paying}
        onClick={() => void contribute(Math.max(1, Number(customAmount) || 1))}
        className="px-4 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-50 whitespace-nowrap"
      >
        {paying ? 'Paying…' : 'Contribute'}
      </button>
    </div>
  );

  if (layout === 'sidebar') {
    return (
      <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
        <div>
          <div className="text-sm font-semibold">Fund this space</div>
          <p className="text-xs text-muted mt-1">
            Optional USDC toward DexScreener or community goals.
          </p>
        </div>
        {campaignTabs}
        {progressBlock}
        {controlsBlock}
        {payHint ? (
          <p className="text-xs text-muted border-t border-border pt-3">{payHint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 md:p-5 rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-6">
        <div className="shrink-0 xl:w-[168px]">
          <div className="text-sm font-semibold">Fund this space</div>
          <p className="text-[11px] text-muted mt-0.5 leading-snug">
            USDC on Base · posts stay free
          </p>
          {campaignTabs ? <div className="mt-2">{campaignTabs}</div> : null}
        </div>

        {progressBlock}

        {controlsBlock}
      </div>

      {payHint ? (
        <p className="text-xs text-muted border-t border-border mt-4 pt-3">{payHint}</p>
      ) : (
        <p className="text-[11px] text-muted mt-3 xl:mt-2 leading-snug">
          ${SPACE_FUND_X402_MAX_USDC} USDC per contribution via{' '}
          <a
            href="https://docs.bankr.bot/x402-cloud/overview/"
            target="_blank"
            rel="noreferrer"
            className="text-accent-hover hover:underline"
          >
            Bankr x402
          </a>
          . Connect wallet to pay.
        </p>
      )}
    </div>
  );
}
