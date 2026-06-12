'use client';

import { useState } from 'react';
import {
  POIDH_BASE_URL,
  POIDH_OPEN_BOUNTY_STEPS,
} from '@/lib/poidh-open-bounty';

export function PoidhOpenBountyGuide({
  compact = false,
  collapsible = false,
}: {
  compact?: boolean;
  /** Full guide tucked under a chevron — for Bounties tab intro */
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <p className="text-[11px] text-muted leading-relaxed">
        <strong className="font-medium text-text">Open bounty</strong> — create here, then fund and
        claim on{' '}
        <a
          href={POIDH_BASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-hover hover:underline"
        >
          poidh.xyz
        </a>
        .
      </p>
    );
  }

  if (collapsible) {
    return (
      <div className="border-t border-border pt-2 mt-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-medium text-accent-hover hover:text-accent transition-colors"
          aria-expanded={open}
        >
          <span>How POIDH open bounties work</span>
          <span
            className={`text-muted text-xs transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {open ? (
          <div className="mt-3 space-y-3">
            <p className="text-[11px] text-muted leading-relaxed">
              Crowdfunded outcome markets on Base. bankr.space creates bounties and shows status;
              POIDH handles funding, claims, and voting.
            </p>
            <ol className="space-y-2.5">
              {POIDH_OPEN_BOUNTY_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-2.5 text-[11px] leading-snug">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-medium text-text">{step.title}. </span>
                    <span className="text-muted">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3">
      <div>
        <div className="text-sm font-semibold">How POIDH open bounties work</div>
        <p className="text-[11px] text-muted mt-1 leading-relaxed">
          Create on bankr.space — fund, claim, and vote on{' '}
          <a
            href={POIDH_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-hover hover:underline"
          >
            poidh.xyz
          </a>
          .
        </p>
      </div>
      <ol className="space-y-2.5">
        {POIDH_OPEN_BOUNTY_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-2.5 text-[11px] leading-snug">
            <span className="shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-semibold flex items-center justify-center">
              {i + 1}
            </span>
            <span>
              <span className="font-medium text-text">{step.title}. </span>
              <span className="text-muted">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
