import type { WalletAgentMeta } from './types';
import { normalizeAddr } from './utils';

export const PLATFORM_AGENT_ID = 'bankr-space-agent';
export const PLATFORM_AGENT_TYPE = 'bankr-space-agent';
export const PLATFORM_AGENT_LABEL = 'Bankr Space Agent';

/**
 * Set via PLATFORM_AGENT_WALLET (Vercel + Aeon). Use a dedicated Base Account —
 * not @bankrbot. Create via Base MCP (mcp.base.org) → get_wallets.
 */
export function getPlatformAgentWallet(): string | null {
  const raw =
    process.env.PLATFORM_AGENT_WALLET?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_WALLET?.trim();
  if (!raw) return null;
  try {
    return normalizeAddr(raw);
  } catch {
    return null;
  }
}

export function isPlatformAgentWallet(wallet: string): boolean {
  const platform = getPlatformAgentWallet();
  if (!platform) return false;
  return wallet.toLowerCase() === platform.toLowerCase();
}

/** Space-page opt-in UI. Off until platform worker (e.g. Aeon) is live. */
export function isPlatformAgentUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PLATFORM_AGENT_UI === 'true';
}

export function platformAgentMeta(): WalletAgentMeta {
  return {
    wallet: getPlatformAgentWallet() || undefined,
    isAgentWallet: true,
    agentId: PLATFORM_AGENT_ID,
    agentType: PLATFORM_AGENT_TYPE,
    agentLabel: PLATFORM_AGENT_LABEL,
    platform: 'bankr.space',
    source: 'known-registry',
    resolvedAt: Date.now(),
  };
}

/**
 * Money & authorization:
 * - Lane A (beneficiary fundraisers): x402 → fee recipient; skill spend from fee recipient Bankr API.
 * - Lane B (community agent pool): x402 → platform agent wallet; skill spend from agent wallet.
 * - `usePlatformAgent` → worker polls space, posts milestones, optional skill execution.
 * - `platformAgentSkills` → fee recipient authorizes on-chain skill runs after goals match.
 */
export const PLATFORM_AGENT_MONEY_RULES = {
  laneA: 'beneficiary-fundraiser-x402-to-fee-recipient' as const,
  laneB: 'community-agent-pool-x402-to-platform-wallet' as const,
  fundraisingEnable: 'fee-recipient-only' as const,
  agentPoolEnable: 'deployer-or-fee-recipient' as const,
  fundraiserRequest: 'fee-recipient-or-trusted-delegate' as const,
  skillExecutionGate: 'platformAgentSkills-and-campaign-matched' as const,
};
