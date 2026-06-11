'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import { AgentWalletBadge } from '@/components/AgentWalletBadge';
import type {
  BeneficiaryInfo,
  Community,
  CustomSocialLink,
  SocialLinks,
  StandardSocialLinkKey,
  TokenMarketStats,
  FundraisingCampaign,
  AgentPoolCampaign,
  TrustedDelegateEntry,
} from '@/lib/types';
import { DEFAULT_CAMPAIGNS, isCampaignFunded } from '@/lib/fundraising';
import {
  assertCanOpenBeneficiaryCampaign,
  isAgentPoolCampaignLocked,
  isBeneficiaryCampaignLocked,
} from '@/lib/fundraiser-locks';
import { isAgentPoolCampaignFunded } from '@/lib/agent-pool';
import {
  AGENT_POOL_SKILL_META,
  DEFAULT_AGENT_POOL_CAMPAIGNS,
  WORK_BRIEF_MAX_LENGTH,
  WORK_BRIEF_PLACEHOLDER,
} from '@/lib/agent-pool';
import { MAX_TRUSTED_DELEGATES } from '@/lib/space-delegates';
import { getSocialLinkPills } from '@/lib/social-links';
import { VerifiedBeneficiarySection } from '@/components/VerifiedBeneficiarySection';
import { MarketStats } from '@/components/MarketStats';
import { TokenAvatar } from '@/components/TokenAvatar';
import { BANNER_SIZE_LABEL, BANNER_ASPECT_LABEL } from '@/lib/banner-url';
import { ICON_SIZE_LABEL, ICON_ASPECT_LABEL, ICON_MIN_SIZE, ICON_MAX_SIZE } from '@/lib/image-specs';
import { isPlatformAgentUiEnabled } from '@/lib/platform-agent';
import {
  PLATFORM_AGENT_DOES,
  PLATFORM_AGENT_DOES_NOT,
  SPACE_MODERATION_NOTE,
  AGENT_POOL_NOTE,
  WORK_BRIEF_NOTE,
} from '@/lib/platform-agent-ui';
import { BLOCKED_KEYWORD_LIMITS, normalizeBlockedKeywords } from '@/lib/content-moderation';
import { shortAddr } from '@/lib/utils';
import { apiFetch } from '@/lib/wagmi';

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

function validateImageFileClient(file: File, kind: 'icon' | 'banner'): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      try {
        if (kind === 'icon') {
          if (width !== height) {
            throw new Error(`Token icon must be square (${ICON_ASPECT_LABEL}). Got ${width}×${height}px.`);
          }
          if (width < ICON_MIN_SIZE || width > ICON_MAX_SIZE) {
            throw new Error(
              `Token icon must be ${ICON_MIN_SIZE}–${ICON_MAX_SIZE}px square (Bankr standard ${ICON_SIZE_LABEL}). Got ${width}×${height}px.`
            );
          }
        } else if (width !== 1500 || height !== 500) {
          throw new Error(
            `Banner must be exactly ${BANNER_SIZE_LABEL} (${BANNER_ASPECT_LABEL}). Got ${width}×${height}px.`
          );
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file'));
    };
    img.src = url;
  });
}

function previewImageUrl(url: string | null | undefined): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (raw.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${raw.slice(7)}`;
  }
  return raw;
}

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

function SourceToggle({
  checked,
  disabled,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer sm:max-w-xs">
      <input
        type="checkbox"
        className="mt-0.5 shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="font-medium">{title}</span>
        <span className="block text-xs text-muted mt-0.5 leading-snug">{hint}</span>
      </span>
    </label>
  );
}

function EditSection({
  title,
  hint,
  toggles,
  children,
}: {
  title: string;
  hint?: string;
  toggles?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          {hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
        </div>
        {toggles ? (
          <div className="flex flex-col gap-2 lg:items-end shrink-0">{toggles}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function CommunityProfile({
  community,
  beneficiary,
  canManage,
  canEditFundraising = false,
  canManageTeamAccess = false,
  canManagePlatformAgent = false,
  canEnablePlatformAgentSkills = false,
  isDeployer = false,
  onUpdated,
}: {
  community: Community;
  beneficiary: BeneficiaryInfo | null;
  canManage: boolean;
  /** Fee recipient only — fundraisers / USDC goals */
  canEditFundraising?: boolean;
  /** Fee recipient only — deployer + trusted delegate wallets */
  canManageTeamAccess?: boolean;
  /** Fee recipient (verified) or deployer — enable Bankr Space Agent */
  canManagePlatformAgent?: boolean;
  /** Fee recipient only — QRCoin / 0xWork after x402 match */
  canEnablePlatformAgentSkills?: boolean;
  isDeployer?: boolean;
  onUpdated: () => void;
}) {
  const { address } = useAppWallet();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState(community.description);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(community.socialLinks || {});
  const [customIconUrl, setCustomIconUrl] = useState(community.customIconUrl || '');
  const [customBannerUrl, setCustomBannerUrl] = useState(community.customBannerUrl || '');
  const [useBankrImage, setUseBankrImage] = useState(community.useBankrImage ?? true);
  const [useDexIcon, setUseDexIcon] = useState(community.useDexIcon ?? true);
  const [useDexBanner, setUseDexBanner] = useState(community.useDexBanner ?? true);
  const [useDexDescription, setUseDexDescription] = useState(community.useDexDescription ?? true);
  const [useDexLinks, setUseDexLinks] = useState(community.useDexLinks ?? true);
  const [fundraisingCampaigns, setFundraisingCampaigns] = useState<FundraisingCampaign[]>(
    community.fundraising?.campaigns || DEFAULT_CAMPAIGNS.map((c) => ({ ...c }))
  );
  const [allowDeployerEdit, setAllowDeployerEdit] = useState(community.allowDeployerEdit ?? false);
  const [usePlatformAgent, setUsePlatformAgent] = useState(community.usePlatformAgent ?? false);
  const [platformAgentSkills, setPlatformAgentSkills] = useState(
    community.platformAgentSkills ?? false
  );
  const [trustedDelegates, setTrustedDelegates] = useState<TrustedDelegateEntry[]>(
    community.trustedDelegates || []
  );
  const [blockedKeywordsText, setBlockedKeywordsText] = useState(
    (community.blockedKeywords || []).join('\n')
  );
  const [agentPoolCampaigns, setAgentPoolCampaigns] = useState<AgentPoolCampaign[]>(
    community.agentPool?.campaigns || DEFAULT_AGENT_POOL_CAMPAIGNS.map((c) => ({ ...c }))
  );
  const [resolvingAgentIndex, setResolvingAgentIndex] = useState<number | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [pinningIconUrl, setPinningIconUrl] = useState(false);
  const [pinningBannerUrl, setPinningBannerUrl] = useState(false);
  const [market, setMarket] = useState<TokenMarketStats | null>(null);

  const displayLinks = community.displaySocialLinks || community.socialLinks;
  const linkPills = getSocialLinkPills(displayLinks, market?.dexUrl);

  const bankrIconAvailable = !!(community.imageUri || community.pinnedBankrIconUri);
  const dexIconAvailable = !!(market?.iconUrl || community.dexIconSrc || community.pinnedDexIconUri);
  const dexBannerAvailable = !!(market?.bannerUrl || community.dexBannerSrc || community.pinnedDexBannerUri);
  const dexDescriptionAvailable = !!community.dexDescription;

  const previewIconUrl = customIconUrl.trim()
    ? previewImageUrl(customIconUrl)
    : useBankrImage || useDexIcon
      ? community.imageUrl
      : null;

  const previewBannerUrl = customBannerUrl.trim()
    ? previewImageUrl(customBannerUrl)
    : useDexBanner
      ? community.bannerUrl
      : null;

  useEffect(() => {
    setDescription(community.description);
    setSocialLinks(community.socialLinks || {});
    setCustomIconUrl(community.customIconUrl || '');
    setCustomBannerUrl(community.customBannerUrl || '');
    setUseBankrImage(community.useBankrImage ?? true);
    setUseDexIcon(community.useDexIcon ?? true);
    setUseDexBanner(community.useDexBanner ?? true);
    setUseDexDescription(community.useDexDescription ?? true);
    setUseDexLinks(community.useDexLinks ?? true);
    setFundraisingCampaigns(
      community.fundraising?.campaigns || DEFAULT_CAMPAIGNS.map((c) => ({ ...c }))
    );
    setAllowDeployerEdit(community.allowDeployerEdit ?? false);
    setUsePlatformAgent(community.usePlatformAgent ?? false);
    setPlatformAgentSkills(community.platformAgentSkills ?? false);
    setTrustedDelegates(community.trustedDelegates || []);
    setBlockedKeywordsText((community.blockedKeywords || []).join('\n'));
    setAgentPoolCampaigns(
      community.agentPool?.campaigns || DEFAULT_AGENT_POOL_CAMPAIGNS.map((c) => ({ ...c }))
    );
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

  function resetEditForm() {
    setDescription(community.description);
    setSocialLinks(community.socialLinks || {});
    setCustomIconUrl(community.customIconUrl || '');
    setCustomBannerUrl(community.customBannerUrl || '');
    setUseBankrImage(community.useBankrImage ?? true);
    setUseDexIcon(community.useDexIcon ?? true);
    setUseDexBanner(community.useDexBanner ?? true);
    setUseDexDescription(community.useDexDescription ?? true);
    setUseDexLinks(community.useDexLinks ?? true);
    setFundraisingCampaigns(
      community.fundraising?.campaigns || DEFAULT_CAMPAIGNS.map((c) => ({ ...c }))
    );
    setAllowDeployerEdit(community.allowDeployerEdit ?? false);
    setUsePlatformAgent(community.usePlatformAgent ?? false);
    setPlatformAgentSkills(community.platformAgentSkills ?? false);
    setTrustedDelegates(community.trustedDelegates || []);
    setBlockedKeywordsText((community.blockedKeywords || []).join('\n'));
    setAgentPoolCampaigns(
      community.agentPool?.campaigns || DEFAULT_AGENT_POOL_CAMPAIGNS.map((c) => ({ ...c }))
    );
  }

  function parseBlockedKeywordsFromText(): string[] {
    const lines = blockedKeywordsText.split(/\r?\n/);
    return normalizeBlockedKeywords(lines);
  }

  function updateCampaign(id: FundraisingCampaign['id'], patch: Partial<FundraisingCampaign>) {
    setFundraisingCampaigns((current) => {
      const target = current.find((c) => c.id === id);
      if (!target) return current;

      if (patch.enabled === false && isBeneficiaryCampaignLocked(target)) {
        alert(
          'This fundraiser cannot be closed while contributors have paid in. It stays open until the goal is met.'
        );
        return current;
      }

      if (patch.enabled === true) {
        const conflict = assertCanOpenBeneficiaryCampaign(
          { optedIn: true, campaigns: current },
          id,
          true
        );
        if (conflict) {
          alert(conflict);
          return current;
        }
        return current.map((c) => {
          if (c.id === id) return { ...c, ...patch, enabled: true };
          if (c.enabled && !isCampaignFunded(c) && c.raisedUsd === 0) {
            return { ...c, enabled: false };
          }
          return c;
        });
      }

      if (
        patch.goalUsd !== undefined &&
        isBeneficiaryCampaignLocked(target) &&
        patch.goalUsd < target.raisedUsd
      ) {
        alert(`Goal cannot be below $${target.raisedUsd} already raised.`);
        return current;
      }

      return current.map((c) => (c.id === id ? { ...c, ...patch } : c));
    });
  }

  function updateAgentPoolCampaign(
    skillId: AgentPoolCampaign['skillId'],
    patch: Partial<AgentPoolCampaign>
  ) {
    setAgentPoolCampaigns((current) => {
      const target = current.find((c) => c.skillId === skillId);
      if (!target) return current;

      if (patch.enabled === false && isAgentPoolCampaignLocked(target)) {
        alert(
          'This community goal cannot be closed while contributors have paid in. It stays open until the goal is met.'
        );
        return current;
      }

      if (patch.enabled === true) {
        const otherOpen = current.find(
          (c) =>
            c.skillId !== skillId && c.enabled && !isAgentPoolCampaignFunded(c)
        );
        if (otherOpen?.raisedUsd && otherOpen.raisedUsd > 0) {
          alert(
            `Only one community agent goal can be open at a time. "${otherOpen.label}" has active contributions.`
          );
          return current;
        }
        return current.map((c) => {
          if (c.skillId === skillId) return { ...c, ...patch, enabled: true };
          if (c.enabled && !isAgentPoolCampaignFunded(c) && c.raisedUsd === 0) {
            return { ...c, enabled: false };
          }
          return c;
        });
      }

      if (
        patch.goalUsd !== undefined &&
        isAgentPoolCampaignLocked(target) &&
        patch.goalUsd < target.raisedUsd
      ) {
        alert(`Goal cannot be below $${target.raisedUsd} already raised.`);
        return current;
      }

      return current.map((c) => (c.skillId === skillId ? { ...c, ...patch } : c));
    });
  }

  async function identifyDelegateAgent(index: number) {
    const entry = trustedDelegates[index];
    const w = entry?.wallet?.trim().toLowerCase();
    if (!w || !/^0x[a-f0-9]{40}$/.test(w)) {
      alert('Enter a valid wallet address first');
      return;
    }
    setResolvingAgentIndex(index);
    try {
      const res = await fetch(
        `/api/agent/resolve-wallet?wallet=${encodeURIComponent(w)}&token=${encodeURIComponent(community.tokenAddress)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      setTrustedDelegates((current) =>
        current.map((item, i) => (i === index ? { wallet: w, agent: data } : item))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Agent lookup failed');
    } finally {
      setResolvingAgentIndex(null);
    }
  }

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
          customIconUrl: customIconUrl.trim() || null,
          customBannerUrl: customBannerUrl.trim() || null,
          useBankrImage,
          useDexIcon,
          useDexBanner,
          useDexDescription,
          useDexLinks,
          ...(canEditFundraising ? { fundraising: { campaigns: fundraisingCampaigns } } : {}),
          ...(canManageTeamAccess
            ? { allowDeployerEdit, trustedDelegates }
            : {}),
          blockedKeywords: parseBlockedKeywordsFromText(),
          ...(canManagePlatformAgent && isPlatformAgentUiEnabled() && editing
            ? {
                usePlatformAgent,
                ...(canEnablePlatformAgentSkills ? { platformAgentSkills } : {}),
                ...(usePlatformAgent
                  ? { agentPool: { campaigns: agentPoolCampaigns } }
                  : {}),
              }
            : {}),
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

  async function uploadImage(file: File, kind: 'icon' | 'banner') {
    if (!canManage || !address) return;
    const setUploading = kind === 'icon' ? setUploadingIcon : setUploadingBanner;
    const setUrl = kind === 'icon' ? setCustomIconUrl : setCustomBannerUrl;
    setUploading(true);
    try {
      await validateImageFileClient(file, kind);
      const form = new FormData();
      form.append('file', file);
      form.append('tokenAddress', community.tokenAddress);
      form.append('kind', kind);
      const headers = new Headers();
      headers.set('x-wallet-address', address);
      const res = await fetch('/api/upload/banner', {
        method: 'POST',
        headers,
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUrl(data.ipfsUri || '');
      if (kind === 'icon') {
        setUseBankrImage(false);
        setUseDexIcon(false);
      } else {
        setUseDexBanner(false);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function pinImageUrl(kind: 'icon' | 'banner') {
    if (!canManage || !address) return;
    const url = kind === 'icon' ? customIconUrl.trim() : customBannerUrl.trim();
    if (!url) return;
    const setPinning = kind === 'icon' ? setPinningIconUrl : setPinningBannerUrl;
    const setUrl = kind === 'icon' ? setCustomIconUrl : setCustomBannerUrl;
    setPinning(true);
    try {
      const res = await fetch('/api/upload/banner', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address,
        },
        body: JSON.stringify({
          tokenAddress: community.tokenAddress,
          kind,
          url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pin failed');
      setUrl(data.ipfsUri || url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Pin failed');
    } finally {
      setPinning(false);
    }
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
                  if (editing) resetEditForm();
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
                Token socials are separate from the Bankr beneficiary account. Bankr and DexScreener
                sources are on by default until you turn them off or upload custom assets.
              </p>

              <EditSection
                title="Description"
                toggles={
                  <SourceToggle
                    checked={useDexDescription}
                    onChange={setUseDexDescription}
                    title="Use DexScreener description"
                    hint={
                      dexDescriptionAvailable
                        ? `Dex: “${(community.dexDescription || '').length > 80 ? `${community.dexDescription?.slice(0, 80)}…` : community.dexDescription}”`
                        : 'No Dex description yet — your text is used.'
                    }
                  />
                }
              >
                <textarea
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm min-h-[120px]"
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </EditSection>

              <EditSection
                title="Token icon"
                hint={`Square ${ICON_ASPECT_LABEL}, ${ICON_MIN_SIZE}–${ICON_SIZE_LABEL} (Bankr launch standard). PNG/JPG/WebP — upload or Pin URL via Pinata.`}
                toggles={
                  <>
                    <SourceToggle
                      checked={useBankrImage}
                      onChange={setUseBankrImage}
                      disabled={!!customIconUrl.trim()}
                      title="Use Bankr token image"
                      hint={
                        bankrIconAvailable
                          ? 'Launch image from Bankr — mirrored to IPFS when Pinata is configured.'
                          : 'No Bankr launch image found for this token yet.'
                      }
                    />
                    <SourceToggle
                      checked={useDexIcon}
                      onChange={setUseDexIcon}
                      disabled={!!customIconUrl.trim()}
                      title="Use DexScreener icon"
                      hint={
                        dexIconAvailable
                          ? 'Pulls icon from Dex profile / pairs — mirrored to IPFS via Pinata.'
                          : 'No Dex icon found yet.'
                      }
                    />
                  </>
                }
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadingIcon}
                  className="block w-full text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-border file:bg-surface-2 file:text-text"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file, 'icon');
                    event.target.value = '';
                  }}
                />
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-xs"
                    placeholder="https://… or ipfs://…"
                    value={customIconUrl}
                    onChange={(event) => setCustomIconUrl(event.target.value)}
                  />
                  <button
                    type="button"
                    disabled={pinningIconUrl || !customIconUrl.trim()}
                    onClick={() => void pinImageUrl('icon')}
                    className="px-3 py-2 text-xs border border-border rounded-lg hover:border-accent bg-surface-2 disabled:opacity-50"
                  >
                    {pinningIconUrl ? 'Pinning…' : 'Pin URL'}
                  </button>
                </div>
                {previewIconUrl ? (
                  <TokenAvatar symbol={community.symbol} imageUrl={previewIconUrl} size={48} />
                ) : null}
              </EditSection>

              <EditSection
                title="Social links"
                hint="Token socials are separate from the Bankr beneficiary account."
                toggles={
                  <SourceToggle
                    checked={useDexLinks}
                    onChange={setUseDexLinks}
                    title="Use DexScreener links"
                    hint="Merges Dex profile links (website, X, etc.) with yours — yours win on conflict."
                  />
                }
              >
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
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-muted">Additional links</div>
                    <button
                      type="button"
                      onClick={addCustomLink}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent bg-surface-2"
                    >
                      + Add link
                    </button>
                  </div>
                  {(socialLinks.custom || []).length === 0 ? (
                    <p className="text-xs text-muted italic">No extra links yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(socialLinks.custom || []).map((link, index) => (
                        <div
                          key={index}
                          className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] items-end"
                        >
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
              </EditSection>

              <EditSection
                title="Banner"
                hint={`Exactly ${BANNER_SIZE_LABEL} (${BANNER_ASPECT_LABEL}, DexScreener standard). Upload or Pin URL via Pinata.`}
                toggles={
                  <SourceToggle
                    checked={useDexBanner}
                    onChange={setUseDexBanner}
                    disabled={!!customBannerUrl.trim()}
                    title="Use DexScreener banner"
                    hint={
                      dexBannerAvailable
                        ? `Paid Dex profile header (${BANNER_SIZE_LABEL}).`
                        : 'No Dex banner found yet.'
                    }
                  />
                }
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploadingBanner}
                  className="block w-full text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-border file:bg-surface-2 file:text-text"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file, 'banner');
                    event.target.value = '';
                  }}
                />
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-xs"
                    placeholder="https://… or ipfs://…"
                    value={customBannerUrl}
                    onChange={(event) => setCustomBannerUrl(event.target.value)}
                  />
                  <button
                    type="button"
                    disabled={pinningBannerUrl || !customBannerUrl.trim()}
                    onClick={() => void pinImageUrl('banner')}
                    className="px-3 py-2 text-xs border border-border rounded-lg hover:border-accent bg-surface-2 disabled:opacity-50"
                  >
                    {pinningBannerUrl ? 'Pinning…' : 'Pin URL'}
                  </button>
                </div>
                {previewBannerUrl ? (
                  <div className="relative w-full h-24 rounded-lg overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewBannerUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null}
              </EditSection>

              {canEditFundraising ? (
                <EditSection
                  title="Fundraising campaigns"
                  hint="Fee recipient only. One open fundraiser at a time. Once contributors pay in, the goal cannot be closed until it is met."
                >
                  <div className="space-y-3">
                    {fundraisingCampaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="p-3 border border-border rounded-lg bg-bg/40 space-y-2"
                      >
                        <label
                          className={`flex items-start gap-2 text-sm ${
                            isBeneficiaryCampaignLocked(campaign)
                              ? 'cursor-not-allowed opacity-90'
                              : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={campaign.enabled}
                            disabled={isBeneficiaryCampaignLocked(campaign)}
                            onChange={(e) =>
                              updateCampaign(campaign.id, { enabled: e.target.checked })
                            }
                          />
                          <span>
                            <span className="font-medium">{campaign.label}</span>
                            <span className="block text-xs text-muted mt-0.5">
                              ${campaign.raisedUsd.toLocaleString()} raised · goal $
                              {campaign.goalUsd.toLocaleString()}
                            </span>
                            {isBeneficiaryCampaignLocked(campaign) ? (
                              <span className="block text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                                Locked — contributors have paid in; cannot close until goal is met.
                              </span>
                            ) : null}
                          </span>
                        </label>
                        {campaign.id === 'custom' ? (
                          <div className="grid gap-2 sm:grid-cols-2 pl-6">
                            <input
                              className="px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                              placeholder="Goal label"
                              value={campaign.label}
                              onChange={(e) =>
                                updateCampaign(campaign.id, { label: e.target.value })
                              }
                            />
                            <input
                              type="number"
                              min={1}
                              className="px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                              placeholder="Goal USD"
                              value={campaign.goalUsd}
                              onChange={(e) =>
                                updateCampaign(campaign.id, {
                                  goalUsd: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                          </div>
                        ) : campaign.id === 'dex-boost' ? (
                          <div className="pl-6">
                            <label className="block text-xs text-muted mb-1">Goal USD</label>
                            <input
                              type="number"
                              min={1}
                              className="w-full max-w-[140px] px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                              value={campaign.goalUsd}
                              onChange={(e) =>
                                updateCampaign(campaign.id, {
                                  goalUsd: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </EditSection>
              ) : null}

              {canManageTeamAccess ? (
                <EditSection
                  title="Team access"
                  hint="Profile, post, and pin only — no fundraisers or USDC. Applies after verify."
                >
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={allowDeployerEdit}
                      onChange={(e) => setAllowDeployerEdit(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium">Allow deployer to moderate this space</span>
                      <span className="block text-xs text-muted mt-0.5">
                        Launcher wallet can edit profile, post, and pin — not fundraisers or money.
                      </span>
                    </span>
                  </label>
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-medium text-muted">
                      Trusted wallets (up to {MAX_TRUSTED_DELEGATES})
                    </div>
                    {trustedDelegates.map((delegate, index) => (
                      <div
                        key={`${delegate.wallet}-${index}`}
                        className="space-y-2 p-3 border border-border rounded-lg bg-bg/40"
                      >
                        <div className="flex gap-2">
                          <input
                            className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-xs"
                            value={delegate.wallet}
                            onChange={(e) => {
                              const next = [...trustedDelegates];
                              next[index] = {
                                wallet: e.target.value.trim().toLowerCase(),
                                agent: null,
                              };
                              setTrustedDelegates(next);
                            }}
                            placeholder="0x…"
                          />
                          <button
                            type="button"
                            disabled={resolvingAgentIndex === index}
                            onClick={() => void identifyDelegateAgent(index)}
                            className="px-3 py-2 text-xs border border-border rounded-lg hover:border-accent bg-surface-2 disabled:opacity-50"
                          >
                            {resolvingAgentIndex === index ? '…' : 'Identify'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setTrustedDelegates(trustedDelegates.filter((_, i) => i !== index))
                            }
                            className="px-3 py-2 text-xs border border-border rounded-lg hover:border-red-400"
                          >
                            Remove
                          </button>
                        </div>
                        <AgentWalletBadge agent={delegate.agent} />
                      </div>
                    ))}
                    {trustedDelegates.length < MAX_TRUSTED_DELEGATES ? (
                      <button
                        type="button"
                        onClick={() =>
                          setTrustedDelegates([...trustedDelegates, { wallet: '', agent: null }])
                        }
                        className="text-xs text-accent-hover hover:underline"
                      >
                        + Add trusted wallet
                      </button>
                    ) : null}
                    <p className="text-xs text-muted">
                      Grant edit, post, and pin to someone you trust. Use Identify to tag agent
                      wallets (bankrbot, hermes, etc.) via Bankr. They cannot touch fundraisers.
                    </p>
                  </div>
                </EditSection>
              ) : null}

              {canManage ? (
                <EditSection
                  title="Content moderation"
                  hint="Blocked phrases apply to holder posts. Team wallets and the platform agent are exempt."
                >
                  <label className="block text-xs text-muted mb-2">
                    Blocked keywords / phrases (one per line, max{' '}
                    {BLOCKED_KEYWORD_LIMITS.maxKeywords})
                  </label>
                  <textarea
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono min-h-[100px]"
                    placeholder={'scam\nfree mint\nt.me/spam'}
                    value={blockedKeywordsText}
                    onChange={(e) => setBlockedKeywordsText(e.target.value)}
                  />
                  <p className="text-xs text-muted mt-2">{SPACE_MODERATION_NOTE}</p>
                  {(community.blockedKeywords?.length ?? 0) > 0 && !blockedKeywordsText.trim() ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Saving will clear the current blocklist.
                    </p>
                  ) : null}
                </EditSection>
              ) : null}

              {canManagePlatformAgent && isPlatformAgentUiEnabled() ? (
                <EditSection
                  title="Community agent"
                  hint="Optional Bankr Space Agent — one platform worker serves all opted-in spaces."
                >
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={usePlatformAgent}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setUsePlatformAgent(on);
                        if (!on) setPlatformAgentSkills(false);
                      }}
                    />
                    <span>
                      <span className="font-medium">Use Bankr Space Agent</span>
                      <span className="block text-xs text-muted mt-0.5">
                        Runs on GitHub every ~15 min when enabled and verified. Posts as the
                        platform wallet — not your personal wallet.
                      </span>
                    </span>
                  </label>
                  {usePlatformAgent && canEnablePlatformAgentSkills ? (
                    <label className="flex items-start gap-2 text-sm cursor-pointer pl-6 mt-3">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={platformAgentSkills}
                        onChange={(e) => setPlatformAgentSkills(e.target.checked)}
                      />
                      <span>
                        <span className="font-medium">Authorize agent skill execution</span>
                        <span className="block text-xs text-muted mt-0.5">
                          After a goal is matched (community pool or beneficiary fundraiser), agent
                          may run QRCoin / 0xWork on-chain.
                        </span>
                      </span>
                    </label>
                  ) : null}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="p-3 rounded-lg border border-border bg-bg/40">
                      <div className="font-semibold text-green-600 dark:text-green-400 mb-2">
                        Agent can
                      </div>
                      <ul className="space-y-1.5 text-muted list-disc pl-4">
                        {PLATFORM_AGENT_DOES.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-bg/40">
                      <div className="font-semibold text-amber-600 dark:text-amber-400 mb-2">
                        Agent cannot
                      </div>
                      <ul className="space-y-1.5 text-muted list-disc pl-4">
                        {PLATFORM_AGENT_DOES_NOT.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {usePlatformAgent ? (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <div>
                        <div className="text-sm font-medium">Community agent pool (Lane B)</div>
                        <p className="text-xs text-muted mt-1">{AGENT_POOL_NOTE}</p>
                        <p className="text-xs text-muted mt-1">
                          Holders can also propose goals in the Fundraisers sidebar — you can
                          bootstrap defaults here.
                        </p>
                      </div>
                      {agentPoolCampaigns.map((campaign) => (
                        <div
                          key={campaign.skillId}
                          className="p-3 border border-border rounded-lg bg-bg/40 space-y-2"
                        >
                          <label
                            className={`flex items-start gap-2 text-sm ${
                              isAgentPoolCampaignLocked(campaign)
                                ? 'cursor-not-allowed opacity-90'
                                : 'cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={campaign.enabled}
                              disabled={isAgentPoolCampaignLocked(campaign)}
                              onChange={(e) =>
                                updateAgentPoolCampaign(campaign.skillId, {
                                  enabled: e.target.checked,
                                })
                              }
                            />
                            <span>
                              <span className="font-medium">{campaign.label}</span>
                              <span className="block text-xs text-muted mt-0.5">
                                {AGENT_POOL_SKILL_META[campaign.skillId].description}
                              </span>
                              {isAgentPoolCampaignLocked(campaign) ? (
                                <span className="block text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                                  Locked — contributors have paid in; cannot close until goal is met.
                                </span>
                              ) : null}
                            </span>
                          </label>
                          {campaign.enabled ? (
                            <div className="pl-6 space-y-3">
                              <div>
                                <label className="block text-xs text-muted mb-1">Goal USD</label>
                                <input
                                  type="number"
                                  min={1}
                                  className="w-full max-w-[140px] px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                                  value={campaign.goalUsd}
                                onChange={(e) =>
                                  updateAgentPoolCampaign(campaign.skillId, {
                                    goalUsd: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                />
                              </div>
                              {campaign.skillId === '0xwork' ? (
                                <div>
                                  <label className="block text-xs text-muted mb-1">
                                    Work brief (custom tasks)
                                  </label>
                                  <p className="text-[11px] text-muted mb-1.5">{WORK_BRIEF_NOTE}</p>
                                  <textarea
                                    rows={5}
                                    maxLength={WORK_BRIEF_MAX_LENGTH}
                                    placeholder={WORK_BRIEF_PLACEHOLDER}
                                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono leading-relaxed resize-y min-h-[120px]"
                                    value={campaign.workBrief || ''}
                                    onChange={(e) =>
                                      updateAgentPoolCampaign(campaign.skillId, {
                                        workBrief: e.target.value.slice(0, WORK_BRIEF_MAX_LENGTH),
                                      })
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </EditSection>
              ) : null}

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

      {canManagePlatformAgent && isPlatformAgentUiEnabled() && !editing ? (
        <div className="mt-6 p-4 border border-border rounded-xl bg-surface space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Community agent</h3>
              <p className="text-xs text-muted mt-1">
                {community.usePlatformAgent
                  ? community.verified
                    ? 'Bankr Space Agent is on for this space.'
                    : 'Enabled — active after the fee recipient verifies.'
                  : 'Off — turn on in Edit profile to enable autopilot posts.'}
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-accent-hover hover:underline shrink-0"
              >
                Edit settings
              </button>
            ) : null}
          </div>
          {community.usePlatformAgent ? (
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div>
                <div className="font-medium text-green-600 dark:text-green-400 mb-1">Can do</div>
                <ul className="text-muted space-y-1 list-disc pl-4">
                  {PLATFORM_AGENT_DOES.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-muted mb-1">Cannot do</div>
                <ul className="text-muted space-y-1 list-disc pl-4">
                  {PLATFORM_AGENT_DOES_NOT.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          {(community.blockedKeywords?.length ?? 0) > 0 ? (
            <p className="text-xs text-muted">
              {community.blockedKeywords!.length} blocked phrase
              {community.blockedKeywords!.length === 1 ? '' : 's'} on this space (holder posts
              only).
            </p>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
