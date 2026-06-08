'use client';

import type { BeneficiaryInfo } from '@/lib/types';

export function BeneficiaryCard({ beneficiary }: { beneficiary: BeneficiaryInfo | null }) {
  if (!beneficiary) return null;

  return (
    <div className="mt-4 p-4 bg-surface-2 border border-border rounded-xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        Fee beneficiary (from Bankr)
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <a
          href={beneficiary.walletUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-accent-hover hover:underline"
        >
          {beneficiary.wallet}
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(beneficiary.wallet)}
          className="px-2 py-1 text-xs border border-border rounded-lg hover:border-accent"
        >
          Copy
        </button>
        {beneficiary.xUrl ? (
          <a
            href={beneficiary.xUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 text-xs border border-border rounded-lg hover:border-accent"
          >
            @{beneficiary.xUsername?.replace(/^@/, '')}
          </a>
        ) : null}
      </div>
      <p className="text-xs text-muted mt-2">
        Pulled from Bankr launch data — not editable here.
      </p>
    </div>
  );
}
