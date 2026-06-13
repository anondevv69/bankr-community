import { NextResponse } from 'next/server';
import {
  getPlatformAgentWallet,
  platformAgentMeta,
  PLATFORM_AGENT_MONEY_RULES,
  PLATFORM_AGENT_ID,
} from '@/lib/platform-agent';

export const dynamic = 'force-dynamic';

/** Public info about the Bankr Space platform agent (works across all opted-in spaces). */
export async function GET() {
  const wallet = getPlatformAgentWallet();
  return NextResponse.json({
    agentId: PLATFORM_AGENT_ID,
    wallet,
    agent: platformAgentMeta(),
    moneyRules: PLATFORM_AGENT_MONEY_RULES,
    capabilities: {
      social: 'post milestones, pin agent posts when usePlatformAgent',
      laneA: 'beneficiary fundraisers — x402 to fee recipient',
      laneB: 'community agent pool — x402 to platform agent wallet (QRCoin, 0xWork)',
      skills: 'execute when platformAgentSkills + goal matched',
      moderation: 'blocked keywords enforced on holder posts only',
    },
    optIn: {
      usePlatformAgent: 'deployer or verified fee recipient',
      platformAgentSkills: 'fee recipient — authorize on-chain skill execution',
      agentPool: 'deployer or fee recipient — enable community-funded goals',
    },
    install: 'install Bankr Space skill at https://github.com/anondevv69/bankr-space/tree/main/skills/bankr-communities',
  });
}
