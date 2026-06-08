'use client';

import { useEffect, useState } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import type { BeneficiaryInfo, Community, SocialLinks, TokenMarketStats } from '@/lib/types';
import { hasSocialLinks, socialLinksForDisplay } from '@/lib/social-links';
import { VerifiedBeneficiarySection } from '@/components/VerifiedBeneficiarySection';
import { MarketStats } from '@/components/MarketStats';
import { TokenAvatar } from '@/components/TokenAvatar';
import { apiFetch } from '@/lib/wagmi';
import { shortAddr } from '@/lib/utils';

const SOCIAL_FIELDS: Array<{ key: keyof SocialLinks; label: string; placeholder: string }> = [
  {
    key: 'x',
    label: 'Token X account',
    placeholder: 'https://x.com/TokenAccount or @TokenAccount',
  },
  {
    key: 'website',
    label: 'Website',
    placeholder: 'https://tokenmarketplace.shop',
  },
  { key: 'github', label: 'GitHub', placeholder: 'username or https://github.com/...' },
  { key: 'telegram', label: 'Telegram', placeholder: 'handle or https://t.me/...' },
  { key: 'discord', label: 'Discord', placeholder: 'invite code or https://discord.gg/...' },
];

const SOCIAL_PILLS: Array<{ key: keyof SocialLinks; label: string }> = [
  { key: 'website', label: 'Website' },
  { key: 'x', label: 'X' },
  { key: 'telegram', label: 'Telegram' },
];

function SocialPills({ links, dexUrl }: { links: ReturnType<typeof socialLinksForDisplay>; dexUrl?: string | null }) {
  const items = SOCIAL_PILLS.filter(({ key }) => links[key]).map(({ key, label }) => ({
    label,
    href: links[key]!,
  }));
  if (dexUrl) {
    items.push({ label: 'DexScreener', href: dexUrl });
  }

  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border rounded-lg bg-surface hover:border-accent hover:bg-surface-2 transition-colors"
        >
          {item.label}
          {item.label === 'DexScreener' ? <span className="text-muted text-xs">↗</span> : null}
        </a>
      ))}
    </div>
  );
}

export function CommunityProfile({
  community,
  beneficiary,
  canManage,
  onUpdated,
}: {
  community: Community;
  beneficiary: BeneficiaryInfo | null;
  canManage: boolean;
  onUpdated: () => void;
}) {
  const { address } = useAppWallet();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState(community.description);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(community.socialLinks || {});
  const [market, setMarket] = useState<TokenMarketStats | null>(null);

  const displayLinks = socialLinksForDisplay(community.socialLinks);

  useEffect(() => {
    setDescription(community.description);
    setSocialLinks(community.socialLinks || {});
  }, [community]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/market/${community.tokenAddress}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMarket(data.market || null);
      })
      .catch(() => {
        if (!cancelled) setMarket(null);
      });
    return () => {
      cancelled = true;
    };
  }, [community.tokenAddress]);

  async function saveProfile() {
    if (!canManage || !address) return;
    setSaving(true);
    try {
      await apiFetch(`/api/communities/${community.tokenAddress}`, {
        method: 'PATCH',
        wallet: address,
        body: JSON.stringify({ description, socialLinks }),
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

  return (
    <div className="mb-6">
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <TokenAvatar symbol={community.symbol} imageUrl={community.imageUrl} size={72} />
              <div className="min-w-0">
                <div className="text-3xl font-bold tracking-tight">{community.symbol}</div>
                <div className="text-lg font-medium text-muted mt-0.5">{community.name}</div>
                <button
                  type="button"
                  onClick={copyContract}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-accent-hover"
                  title="Copy contract"
                >
                  {shortAddr(community.tokenAddress)}
                  <span className="text-[10px]">📋</span>
                </button>
              </div>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  if (editing) {
                    setDescription(community.description);
                    setSocialLinks(community.socialLinks || {});
                  }
                  setEditing((value) => !value);
                }}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:border-accent bg-surface-2"
              >
                {editing ? 'Cancel' : 'Edit profile'}
              </button>
            ) : null}
          </div>

          <MarketStats market={market} variant="hero" />

          {!editing && hasSocialLinks(community.socialLinks) ? (
            <SocialPills links={displayLinks} dexUrl={market?.dexUrl} />
          ) : null}

          {editing ? (
            <div className="mt-5 space-y-4 border-t border-border pt-5">
              <p className="text-xs text-muted">
                Token socials are separate from the Bankr beneficiary account.
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
                type="button"
                onClick={saveProfile}
                disabled={saving || !description.trim()}
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          ) : community.description ? (
            <p className="text-muted text-sm mt-4 whitespace-pre-wrap leading-relaxed">
              {community.description}
            </p>
          ) : null}
        </div>

        <VerifiedBeneficiarySection
          community={community}
          beneficiary={beneficiary}
          layout="sidebar"
        />
      </div>
    </div>
  );
}
