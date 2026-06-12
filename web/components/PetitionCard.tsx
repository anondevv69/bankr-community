'use client';

import Link from 'next/link';
import type { PetitionSpace } from '@/lib/types';

export function PetitionCard({ petition }: { petition: PetitionSpace }) {
  const phaseLabel =
    petition.phase === 'finalizing'
      ? 'Deploying'
      : petition.phase === 'expired'
        ? 'Expired'
        : 'Petition';

  return (
    <Link
      href={`/community/petition/${petition.tmpPetitionId}`}
      className="block rounded-xl bg-surface border border-accent/40 hover:border-accent transition-all hover:-translate-y-0.5 p-[18px]"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-accent/15 text-accent font-bold text-sm flex items-center justify-center shrink-0">
          {petition.tokenSymbol.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold text-accent-hover">{petition.tokenSymbol}</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent uppercase tracking-wide">
              {phaseLabel}
            </span>
          </div>
          <div className="text-[15px] font-semibold mt-1 truncate">{petition.tokenName}</div>
          <p className="text-xs text-muted mt-2 line-clamp-2">{petition.description}</p>
          <div className="flex gap-3 mt-3 text-xs text-muted">
            <span className="uppercase bg-surface-2 px-2 py-0.5 rounded-full">base</span>
            <span>Pre-launch</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
