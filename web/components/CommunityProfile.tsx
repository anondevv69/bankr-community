'use client';

import { useEffect, useState } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import type {
  BeneficiaryInfo,
  Community,
  CustomSocialLink,
  SocialLinks,
  StandardSocialLinkKey,
  TokenMarketStats,
} from '@/lib/types';
import { getSocialLinkPills } from '@/lib/social-links';
import { VerifiedBeneficiarySection } from '@/components/VerifiedBeneficiarySection';
import { MarketStats } from '@/components/MarketStats';
import { TokenAvatar } from '@/components/TokenAvatar';
import { apiFetch } from '@/lib/wagmi';
import { shortAddr } from '@/lib/utils';

const SOCIAL_FIELDS: Array<{ key: StandardSocialLinkKey; label: string; placeholder: string }> = [
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

const EMPTY_CUSTOM_LINK: CustomSocialLink = { title: '', url: '' };

function SocialPills({ pills }: { pills: ReturnType<typeof getSocialLinkPills> }) {
  if (!pills.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {pills.map((item) => (
        <a
          key={`${item.label}-${item.href}`}
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
  const [customBannerUrl, setCustomBannerUrl] = useState(community.customBannerUrl || '');
  const [useDexBanner, setUseDexBanner] = useState(community.useDexBanner ?? false);
  const [market, setMarket] = useState<TokenMarketStats | null>(null);

  const linkPills = getSocialLinkPills(community.socialLinks, market?.dexUrl);
  const dexBannerAvailable = !!market?.bannerUrl;
  const previewBanner = customBannerUrl.trim()
    ? customBannerUrl.trim()
    : useDexBanner && market?.bannerUrl
      ? market.bannerUrl
      : null;

  useEffect(() => {
    setDescription(community.description);
    setSocialLinks(community.socialLinks || {});
    setCustomBannerUrl(community.customBannerUrl || '');
    setUseDexBanner(community.useDexBanner ?? false);
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
        body: JSON.stringify({
          description,
          socialLinks,
          customBannerUrl: customBannerUrl.trim() || null,
          useDexBanner,
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

  function addCustomLink() {
    setSocialLinks((current) => ({
      ...current,
      custom: [...(current.custom || []), { ...EMPTY_CUSTOM_LINK }],
    }));
  }

  function updateCustomLink(index: number, patch: Partial<CustomSocialLink>) {
    setSocialLinks((current) => {
      const custom = [...(current.custom || [])];
      custom[index] = { ...custom[index], ...patch };
      return { ...current, custom };
    });
  }

  function removeCustomLink(index: number) {
    setSocialLinks((current) => ({
      ...current,
      custom: (current.custom || []).filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="mb-6">
      {community.bannerUrl && !editing ? (
        <div className="relative w-full h-36 sm:h-44 md:h-52 rounded-xl overflow-hidden mb-4 border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={community.bannerUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/70 via-transparent to-transparent pointer-events-none" />
        </div>
      ) : null}

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
                    setCustomBannerUrl(community.customBannerUrl || '');
                    setUseDexBanner(community.useDexBanner ?? false);
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

          {!editing && linkPills.length > 0 ? (
            <SocialPills pills={linkPills} />
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
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">Additional links</div>
                  <button
                    type="button"
                    onClick={addCustomLink}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent bg-surface-2"
                  >
                    + Add link
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Any title and URL — Bankr App, Agent skill, docs, etc.
                </p>
                {(socialLinks.custom || []).length === 0 ? (
                  <p className="text-xs text-muted italic">No extra links yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(socialLinks.custom || []).map((link, index) => (
                      <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] items-end">
                        <div>
                          <label className="block text-xs text-muted mb-1">Title</label>
                          <input
                            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                            placeholder="Bankr App"
                            maxLength={40}
                            value={link.title}
                            onChange={(event) =>
                              updateCustomLink(index, { title: event.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1">URL</label>
                          <input
                            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                            placeholder="https://…"
                            value={link.url}
                            onChange={(event) =>
                              updateCustomLink(index, { url: event.target.value })
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomLink(index)}
                          className="px-3 py-2 text-xs text-red-400 border border-border rounded-lg hover:border-red-400/50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <div className="text-sm font-medium">Banner</div>
                <p className="text-xs text-muted">
                  Custom URL overrides DexScreener. Paste an https:// or ipfs:// image link — file
                  upload is not supported yet.
                </p>
                <div>
                  <label className="block text-sm text-muted mb-2">Custom banner URL</label>
                  <input
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-xs"
                    placeholder="https://… or ipfs://…"
                    value={customBannerUrl}
                    onChange={(event) => setCustomBannerUrl(event.target.value)}
                  />
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={useDexBanner}
                    disabled={!dexBannerAvailable && !customBannerUrl.trim()}
                    onChange={(event) => setUseDexBanner(event.target.checked)}
                  />
                  <span>
                    Use DexScreener banner
                    {dexBannerAvailable ? (
                      <span className="block text-xs text-muted mt-0.5">
                        Paid Dex profile detected — pulls header from DexScreener.
                      </span>
                    ) : (
                      <span className="block text-xs text-muted mt-0.5">
                        No Dex banner found for this token yet.
                      </span>
                    )}
                  </span>
                </label>
                {previewBanner && editing ? (
                  <div className="relative w-full h-24 rounded-lg overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewBanner} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null}
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
