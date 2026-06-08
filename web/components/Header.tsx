'use client';

import { WalletButton } from '@/components/WalletButton';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';
import { formatTime } from '@/lib/utils';

export function Header({ syncUpdatedAt }: { syncUpdatedAt?: number | null }) {
  const embed = useEmbeddedBankr();

  return (
    <header className="mb-7">
      {!embed.isEmbedded ? (
        <>
          <h1 className="text-[26px] font-bold tracking-tight">Bankr Space</h1>
          <p className="text-muted text-sm mt-1">
            Token-gated communities for Bankr-launched tokens
          </p>
        </>
      ) : (
        <p className="text-muted text-sm">
          Bankr Space — wallet via Bankr sign-in
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px]">
        <WalletButton />
        {syncUpdatedAt ? (
          <span className="text-muted text-xs">
            Last synced: {formatTime(syncUpdatedAt)}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export function Footer() {
  const embed = useEmbeddedBankr();

  if (embed.isEmbedded) {
    return (
      <footer className="text-center py-6 text-muted text-xs">
        Bankr Space · embedded
      </footer>
    );
  }

  return (
  <footer className="text-center py-8 text-muted text-[13px]">
    made with love &lt;3 rayblanco.eth · Bankr Space
    {' · '}
    <a
      href="/agent.md"
      className="text-accent-hover hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      agent.md
    </a>
  </footer>
  );
}
