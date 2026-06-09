'use client';

import Link from 'next/link';
import { WalletButton } from '@/components/WalletButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SiteLogo } from '@/components/SiteLogo';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';
import { formatTime } from '@/lib/utils';

function HeaderActions() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <ThemeToggle />
      <WalletButton />
    </div>
  );
}

export function Header({
  syncUpdatedAt,
  backHref,
}: {
  syncUpdatedAt?: number | null;
  backHref?: string;
}) {
  const embed = useEmbeddedBankr();

  if (backHref) {
    return (
      <header className="mb-7 pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <SiteLogo size={32} />
            <Link href={backHref} className="text-sm text-muted hover:text-text">
              ← Back to spaces
            </Link>
          </div>
          <HeaderActions />
        </div>
      </header>
    );
  }

  return (
    <header className="mb-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <SiteLogo size={40} />
          <div className="min-w-0">
            {!embed.isEmbedded ? (
              <>
                <h1 className="text-[26px] font-bold tracking-tight leading-tight">Bankr Space</h1>
                <p className="text-muted text-sm mt-1">
                  Token-gated spaces for Bankr-launched tokens
                </p>
                {syncUpdatedAt ? (
                  <p className="text-muted text-xs mt-1">
                    Last synced: {formatTime(syncUpdatedAt)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted text-sm pt-2">
                Bankr Space — wallet via Bankr sign-in
              </p>
            )}
          </div>
        </div>
        <HeaderActions />
      </div>
    </header>
  );
}

const BANKR_APP_URL =
  'https://bankr.bot/u/0x374d91a5674fa7cf86e725093b5848b97e1e13b4/apps/bankr-communities-v2';

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
      href={BANKR_APP_URL}
      className="text-accent-hover hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      Bankr App
    </a>
    {' · '}
    <a href="/skill" className="text-accent-hover hover:underline">
      Agent skill
    </a>
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
