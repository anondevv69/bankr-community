'use client';

import { useState } from 'react';
import { BANKR_SKILL, BANKR_SKILL_EXAMPLES } from '@/lib/bankr-skill';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface-2 text-text hover:border-accent transition-colors"
    >
      {copied ? 'Copied' : label || 'Copy'}
    </button>
  );
}

export function SkillInstallCard() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bankr agent skill</h1>
        <p className="text-muted text-sm mt-2 max-w-2xl">
          Install the {BANKR_SKILL.displayName} skill so your Bankr agent can verify spaces, post
          updates, pin threads, resolve space links, and reply on X with the correct{' '}
          <span className="text-text">bankr.space/community/0x…</span> URLs.
        </p>
      </div>

      <div className="p-4 bg-surface border border-border rounded-xl">
        <div className="text-sm font-semibold mb-1">1. Install in Bankr</div>
        <p className="text-xs text-muted mb-3">
          Paste this into Bankr chat (terminal, DM, or @bankrbot):
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <code className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-surface-2 border border-border rounded-lg break-all">
            {BANKR_SKILL.installCommand}
          </code>
          <CopyButton text={BANKR_SKILL.installCommand} label="Copy install" />
        </div>
        <p className="text-xs text-muted mt-3">
          Skill pack v{BANKR_SKILL.version} ·{' '}
          <a
            href={BANKR_SKILL.githubUrl}
            className="text-accent-hover hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </p>
      </div>

      <div className="p-4 bg-surface border border-border rounded-xl">
        <div className="text-sm font-semibold mb-1">2. Try it</div>
        <p className="text-xs text-muted mb-3">After install, examples you can send to Bankr:</p>
        <ul className="space-y-2">
          {BANKR_SKILL_EXAMPLES.slice(1).map((example) => (
            <li
              key={example}
              className="flex flex-wrap items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-lg"
            >
              <code className="text-xs flex-1 min-w-0 break-words">{example}</code>
              <CopyButton text={example} />
            </li>
          ))}
        </ul>
      </div>

      <div className="p-4 bg-surface border border-border rounded-xl text-sm text-muted">
        <p>
          <span className="text-text font-medium">For any AI agent:</span> read{' '}
          <a href="/agent.md" className="text-accent-hover hover:underline" target="_blank" rel="noopener noreferrer">
            agent.md
          </a>{' '}
          for HTTP API docs. The skill adds Bankr-specific routing, link rules, and post-source
          requirements for X replies.
        </p>
      </div>
    </section>
  );
}
