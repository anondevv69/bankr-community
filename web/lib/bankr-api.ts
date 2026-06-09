import { resolveLegacyLaunchByAddress } from './legacy-launches';
import type { TokenLaunch } from './types';

const BANKR_API = 'https://api.bankr.bot';

export async function fetchTokenLaunches(): Promise<TokenLaunch[]> {
  const res = await fetch(`${BANKR_API}/token-launches`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error('Failed to fetch token launches');
  const data = await res.json();
  return data.launches || [];
}

export async function fetchLaunchByAddress(address: string): Promise<TokenLaunch | null> {
  try {
    const res = await fetch(`${BANKR_API}/token-launches/${address}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.launch) return data.launch;
    }
  } catch {
    // fall through to legacy registry
  }

  return resolveLegacyLaunchByAddress(address);
}

export async function searchBankrTokens(query: string): Promise<{ address: string }[]> {
  try {
    const res = await fetch(
      `${BANKR_API}/tokens/search?query=${encodeURIComponent(query)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.tokens || [];
  } catch {
    return [];
  }
}

export function getLaunchOwnerWallets(launch: TokenLaunch): {
  feeRecipient: string;
  deployer: string;
} {
  const feeRecipient = launch.feeRecipient?.walletAddress?.toLowerCase() || '';
  const deployer = launch.deployer?.walletAddress?.toLowerCase() || '';
  return { feeRecipient, deployer };
}

export function isLaunchOwner(launch: TokenLaunch, wallet: string): boolean {
  const w = wallet.toLowerCase();
  const { feeRecipient, deployer } = getLaunchOwnerWallets(launch);
  return w === feeRecipient || w === deployer;
}
