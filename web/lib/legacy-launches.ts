import { readClankerDeployer } from './clanker-deployer';
import type { TokenLaunch } from './types';
import { normalizeAddr } from './utils';

const BANKR_API = 'https://api.bankr.bot';

type LegacyLaunchEntry = TokenLaunch & {
  searchAliases?: string[];
};

type BankrTokenSearchHit = {
  address?: string;
  symbol?: string;
  name?: string;
  logoURI?: string;
};

/**
 * Pre–token-launches API Bankr tokens (legacy Clanker / Farcaster deploys).
 * Bankr's GET /token-launches/:addr returns 404 for these; fee claim may still
 * work via POST /token-launches/:addr/fees/claim (auto-detects Clanker vs Doppler).
 * See https://docs.bankr.bot/token-launching/claiming-fees/
 */
const LEGACY_LAUNCHES: LegacyLaunchEntry[] = [
  {
    activityId: 'legacy:bnkr-bankrcoin',
    tokenAddress: '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b',
    tokenName: 'BankrCoin',
    tokenSymbol: 'BNKR',
    chain: 'base',
    timestamp: 1735689600000,
    imageUri:
      'https://coin-images.coingecko.com/coins/images/52626/large/bankr-static.png?1736405365',
    searchAliases: ['bankr', 'bnkr', 'bankrcoin', 'bankr coin'],
    feeRecipient: {
      walletAddress: '0x128c718152c4da86454547484a43a09ac4ee6e7b',
      xUsername: 'bankrbot',
    },
    deployer: {
      walletAddress: '0x128c718152c4da86454547484a43a09ac4ee6e7b',
    },
  },
];

function stripLegacyMeta(entry: LegacyLaunchEntry): TokenLaunch {
  const { searchAliases: _aliases, ...launch } = entry;
  return launch;
}

export function getCuratedLegacyLaunchByAddress(address: string): TokenLaunch | null {
  const token = normalizeAddr(address);
  const hit = LEGACY_LAUNCHES.find(
    (l) => l.tokenAddress.toLowerCase() === token
  );
  return hit ? stripLegacyMeta(hit) : null;
}

/** @deprecated Use resolveLegacyLaunchByAddress for async resolution. */
export function getLegacyLaunchByAddress(address: string): TokenLaunch | null {
  return getCuratedLegacyLaunchByAddress(address);
}

async function fetchBankrTokenSearchHit(
  address: string
): Promise<BankrTokenSearchHit | null> {
  const token = normalizeAddr(address);
  try {
    const res = await fetch(
      `${BANKR_API}/tokens/search?query=${encodeURIComponent(token)}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tokens: BankrTokenSearchHit[] = data.tokens || [];
    return (
      tokens.find((t) => t.address?.toLowerCase() === token) || null
    );
  } catch {
    return null;
  }
}

/** Build a launch record from tokens/search + on-chain deployer (default beneficiary). */
export async function resolveLegacyLaunchByAddress(
  address: string
): Promise<TokenLaunch | null> {
  const curated = getCuratedLegacyLaunchByAddress(address);
  if (curated) return curated;

  const hit = await fetchBankrTokenSearchHit(address);
  if (!hit?.address) return null;

  const deployer = await readClankerDeployer(hit.address);

  return {
    activityId: `legacy:search:${normalizeAddr(hit.address)}`,
    tokenAddress: normalizeAddr(hit.address),
    tokenName: hit.name || 'Unknown token',
    tokenSymbol: hit.symbol || 'TOKEN',
    chain: 'base',
    timestamp: Date.now(),
    imageUri: hit.logoURI || null,
    feeRecipient: deployer ? { walletAddress: deployer } : undefined,
    deployer: deployer ? { walletAddress: deployer } : undefined,
  };
}

export function findLegacyLaunchesByQuery(query: string): TokenLaunch[] {
  const q = query.trim().toLowerCase().replace(/^\$/, '');
  if (!q) return [];

  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query.trim());
  if (isAddress) {
    const one = getLegacyLaunchByAddress(query.trim());
    return one ? [one] : [];
  }

  return LEGACY_LAUNCHES.filter((entry) => {
    const symbol = entry.tokenSymbol.toLowerCase();
    const name = entry.tokenName.toLowerCase();
    const addr = entry.tokenAddress.toLowerCase();
    const aliases = (entry.searchAliases || []).map((a) => a.toLowerCase());
    return (
      symbol === q ||
      name === q ||
      symbol.includes(q) ||
      name.includes(q) ||
      addr.includes(q) ||
      aliases.some((a) => a === q || a.includes(q))
    );
  }).map(stripLegacyMeta);
}

export function mergeLegacyLaunches(launches: TokenLaunch[]): TokenLaunch[] {
  const merged = [...launches];
  const seen = new Set(merged.map((l) => l.tokenAddress.toLowerCase()));

  for (const entry of LEGACY_LAUNCHES) {
    const key = entry.tokenAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(stripLegacyMeta(entry));
  }

  return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
