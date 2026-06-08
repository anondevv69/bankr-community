import type { SocialLinks } from './types';

export type NormalizedSocialLinks = {
  x: string | null;
  github: string | null;
  telegram: string | null;
  discord: string | null;
};

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

/** Editable social links only — beneficiary wallet comes from Bankr launch data */
export function normalizeSocialLinks(input: Partial<SocialLinks>): SocialLinks {
  return {
    x: normalizeX(input.x || '') || undefined,
    github: normalizeGithub(input.github || '') || undefined,
    telegram: normalizeTelegram(input.telegram || '') || undefined,
    discord: normalizeDiscord(input.discord || '') || undefined,
  };
}

export function socialLinksForDisplay(links?: SocialLinks | null): NormalizedSocialLinks {
  const source = links || {};
  return {
    x: source.x ? normalizeX(source.x) : null,
    github: source.github ? normalizeGithub(source.github) : null,
    telegram: source.telegram ? normalizeTelegram(source.telegram) : null,
    discord: source.discord ? normalizeDiscord(source.discord) : null,
  };
}

export function hasSocialLinks(links?: SocialLinks | null): boolean {
  const display = socialLinksForDisplay(links);
  return !!(display.x || display.github || display.telegram || display.discord);
}

export function shortWallet(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function beneficiaryXUrl(username: string | null | undefined): string | null {
  if (!username) return null;
  const handle = username.replace(/^@/, '');
  return handle ? `https://x.com/${handle}` : null;
}
