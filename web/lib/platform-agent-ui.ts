/** Copy for Edit space → Community agent panel (keep in sync with AGENT-COMMUNITY-POOL.md). */

export const PLATFORM_AGENT_DOES = [
  'Post fundraiser & community-pool milestone updates (max once per goal per day)',
  'Pin important agent posts',
  'Lane B: run QRCoin / 0xWork after community pool is funded (x402 → agent wallet)',
  'Lane A: run skills after beneficiary fundraiser matched (fee recipient authorizes)',
  'Post skill results on the feed and 0xJobs tab',
] as const;

export const PLATFORM_AGENT_DOES_NOT = [
  'Enable beneficiary fundraisers — fee recipient only',
  'Receive Lane A x402 USDC — that goes to the fee recipient',
  'Change space profile, icon, or banner',
  'Delete posts or enforce blocked keywords (team does that)',
  'Generate images automatically',
] as const;

export const SPACE_MODERATION_NOTE =
  'Blocked keywords apply to holder posts immediately. Fee recipient, deployer (if allowed), trusted delegates, and the platform agent can still post.';

export const AGENT_POOL_NOTE =
  'Lane B — holders fund goals below. USDC settles to the platform agent wallet. When a goal is met, the agent executes the linked Bankr Skill.';

export const WORK_BRIEF_NOTE =
  'One task per line. Use description — $bounty — Category (Social, Creative, or Writing). $SYMBOL and the space URL are filled in automatically. Leave blank for default bagwork tasks.';
