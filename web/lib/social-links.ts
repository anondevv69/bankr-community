import type { CustomSocialLink, SocialLinks, StandardSocialLinkKey } from './types';

export type NormalizedSocialLinks = {
  x: string | null;
  website: string | null;
  github: string | null;
  telegram: string | null;
  discord: string | null;
  custom: CustomSocialLink[];
};

export type SocialLinkPill = { label: string; href: string };

const STANDARD_LABELS: Record<StandardSocialLinkKey, string> = {
  website: 'Website',
  x: 'X',
  github: 'GitHub',
  telegram: 'Telegram',
  discord: 'Discord',
};

const MAX_CUSTOM_LINKS = 12;
const MAX_CUSTOM_TITLE = 40;

function trim(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeX(value: string): string | null {
  const raw = trim(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '');
  return `https://x.com/${handle}`;
}

export function walletExplorerUrl(address: string, chain = 'base'): string {
  if (chain === 'base') return `https://basescan.org/address/${address}`;
  return `https://etherscan.io/address/${address}`;
}

export function normalizeWebsite(value: string): string | null {
  const raw = trim(value);
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function normalizeGithub(value: string): string | null {
  const raw = trim(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.replace(/^@/, '').replace(/^\//, '');
  return `https://github.com/${path}`;
}

export function normalizeTelegram(value: string): string | null {
  const raw = trim(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '').replace(/^t\.me\//i, '');
  return `https://t.me/${handle}`;
}

export function normalizeDiscord(value: string): string | null {
  const raw = trim(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const invite = raw.replace(/^discord\.gg\//i, '').replace(/^\/+/, '');
  return `https://discord.gg/${invite}`;
}

export function normalizeCustomSocialLinks(input: unknown): CustomSocialLink[] {
  if (!Array.isArray(input)) return [];

  const out: CustomSocialLink[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const title = trim((item as CustomSocialLink).title).slice(0, MAX_CUSTOM_TITLE);
    const url = normalizeWebsite(trim((item as CustomSocialLink).url));
    if (!title || !url) continue;
    out.push({ title, url });
    if (out.length >= MAX_CUSTOM_LINKS) break;
  }
  return out;
}

/** Editable social links only — beneficiary wallet comes from Bankr launch data */
export function normalizeSocialLinks(input: Partial<SocialLinks>): SocialLinks {
  const result: SocialLinks = {
    x: normalizeX(input.x || '') || undefined,
    website: normalizeWebsite(input.website || '') || undefined,
    github: normalizeGithub(input.github || '') || undefined,
    telegram: normalizeTelegram(input.telegram || '') || undefined,
    discord: normalizeDiscord(input.discord || '') || undefined,
  };

  const custom = normalizeCustomSocialLinks(input.custom);
  if (custom.length) result.custom = custom;

  return result;
}

export function socialLinksForDisplay(links?: SocialLinks | null): NormalizedSocialLinks {
  const source = links || {};
  return {
    x: source.x ? normalizeX(source.x) : null,
    website: source.website ? normalizeWebsite(source.website) : null,
    github: source.github ? normalizeGithub(source.github) : null,
    telegram: source.telegram ? normalizeTelegram(source.telegram) : null,
    discord: source.discord ? normalizeDiscord(source.discord) : null,
    custom: normalizeCustomSocialLinks(source.custom),
  };
}

export function getSocialLinkPills(
  links?: SocialLinks | null,
  dexUrl?: string | null
): SocialLinkPill[] {
  const display = socialLinksForDisplay(links);
  const pills: SocialLinkPill[] = [];

  for (const key of Object.keys(STANDARD_LABELS) as StandardSocialLinkKey[]) {
    const href = display[key];
    if (href) pills.push({ label: STANDARD_LABELS[key], href });
  }

  for (const item of display.custom) {
    pills.push({ label: item.title, href: item.url });
  }

  if (dexUrl) pills.push({ label: 'DexScreener', href: dexUrl });

  return pills;
}

export function hasSocialLinks(links?: SocialLinks | null): boolean {
  return getSocialLinkPills(links).length > 0;
}

export function shortWallet(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function beneficiaryXUrl(username: string | null | undefined): string | null {
  if (!username) return null;
  const handle = username.replace(/^@/, '');
  return handle ? `https://x.com/${handle}` : null;
}
