'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import type { Community, SocialLinks } from '@/lib/types';
import {
  hasSocialLinks,
  shortWallet,
  socialLinksForDisplay,
} from '@/lib/social-links';
import { apiFetch } from '@/lib/wagmi';

const SOCIAL_FIELDS: Array<{ key: keyof SocialLinks; label: string; placeholder: string }> = [
  {
    key: 'x',
    label: 'Token X account',
    placeholder: 'https://x.com/TokenAccount or @TokenAccount',
  },
  {
    key: 'wallet',
    label: 'Beneficiary wallet',
    placeholder: '0x374d91a5674fa7cf86e725093b5848b97e1e13b4',
  },
  { key: 'github', label: 'GitHub', placeholder: 'username or https://github.com/...' },
  { key: 'telegram', label: 'Telegram', placeholder: 'handle or https://t.me/...' },
  { key: 'discord', label: 'Discord', placeholder: 'invite code or https://discord.gg/...' },
];

export function CommunityProfile({
  community,
  canManage,
  onUpdated,
}: {
  community: Community;
  canManage: boolean;
  onUpdated: () => void;
}) {
  const { address } = useAccount();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState(community.description);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(community.socialLinks || {});

  const displayLinks = socialLinksForDisplay(community.socialLinks, community.chain);

  useEffect(() => {
    setDescription(community.description);
    setSocialLinks(community.socialLinks || {});
  }, [community]);

  async function saveProfile() {
    if (!canManage || !address) return;
    setSaving(true);
    try {
      await apiFetch(`/api/communities/${community.tokenAddress}`, {
        method: 'PATCH',
        wallet: address,
        body: JSON.stringify({
          description,
          socialLinks,
        }),
      });
      setEditing(false);
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function copyContract() {
    navigator.clipboard.writeText(community.tokenAddress);
  }

  function copyWallet() {
    if (displayLinks.wallet) {
      navigator.clipboard.writeText(displayLinks.wallet);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-bold text-accent-hover">{community.symbol}</div>
          <div className="text-xl font-semibold mt-1">{community.name}</div>
        </div>
        {canManage ? (
          <button
            onClick={() => {
              if (editing) {
                setDescription(community.description);
                setSocialLinks(community.socialLinks || {});
              }
              setEditing((value) => !value);
            }}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:border-accent"
          >
            {editing ? 'Cancel' : 'Edit profile'}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 text-sm">
        <span className="text-muted">Contract</span>
        <code className="font-mono text-accent-hover">{community.tokenAddress}</code>
        <button
          onClick={copyContract}
          className="px-3 py-1 text-xs border border-border rounded-lg hover:border-accent"
        >
          Copy
        </button>
      </div>

      {editing ? (
        <div className="mt-5 space-y-4">
          <p className="text-xs text-muted">
            Token socials are separate from any admin personal accounts. Only the fee beneficiary
            can edit this profile.
          </p>
          <div>
            <label className="block text-sm text-muted mb-2">Description</label>
            <textarea
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm min-h-[120px]"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOCIAL_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-sm text-muted mb-2">{field.label}</label>
                <input
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                  placeholder={field.placeholder}
                  value={socialLinks[field.key] || ''}
                  onChange={(event) =>
                    setSocialLinks((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <button
            onClick={saveProfile}
            disabled={saving || !description.trim()}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      ) : (
        <>
          <p className="text-muted text-sm mt-4 whitespace-pre-wrap">{community.description}</p>
          {hasSocialLinks(community.socialLinks, community.chain) ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {displayLinks.x ? (
                <a
                  href={displayLinks.x}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent"
                >
                  Token X
                </a>
              ) : null}
              {displayLinks.wallet && displayLinks.walletUrl ? (
                <a
                  href={displayLinks.walletUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent font-mono"
                >
                  Wallet {shortWallet(displayLinks.wallet)}
                </a>
              ) : null}
              {displayLinks.github ? (
                <a
                  href={displayLinks.github}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent"
                >
                  GitHub
                </a>
              ) : null}
              {displayLinks.telegram ? (
                <a
                  href={displayLinks.telegram}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent"
                >
                  Telegram
                </a>
              ) : null}
              {displayLinks.discord ? (
                <a
                  href={displayLinks.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent"
                >
                  Discord
                </a>
              ) : null}
              {displayLinks.wallet ? (
                <button
                  onClick={copyWallet}
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent"
                >
                  Copy wallet
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <div className="mt-4">
        {community.verified ? (
          <span className="inline-block text-[11px] font-semibold px-2 py-1 rounded-full bg-green-500/10 text-green-500">
            ✓ Verified by token beneficiary
          </span>
        ) : (
          <span className="inline-block text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-500/15 text-amber-500">
            Unverified — awaiting token beneficiary
          </span>
        )}
      </div>
    </div>
  );
}
