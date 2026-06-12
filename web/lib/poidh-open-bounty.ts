/** POIDH open bounty model — https://words.poidh.xyz/poidh-open-bounties-guide */

export const POIDH_OPEN_BOUNTY_GUIDE_URL =
  'https://words.poidh.xyz/poidh-open-bounties-guide';

export const POIDH_BASE_URL = 'https://poidh.xyz/base';

export const POIDH_OPEN_BOUNTY_STEPS = [
  {
    title: 'Create a bounty on bankr.space',
    body: 'Any token holder describes the task here or asks @bankrbot. We open it on POIDH with a small ETH seed.',
  },
  {
    title: 'Work on poidh.xyz',
    body: 'Open the bounty link to add funds, submit proof, and manage claims. POIDH runs the on-chain pool on Base.',
  },
  {
    title: 'POIDH handles payout rules',
    body: 'If only the creator funded the pool, a valid claim can be paid out directly. If others added ETH, contributors vote yes/no for 48 hours (weighted by their share) before payout.',
  },
  {
    title: 'Track status here',
    body: 'This Bounties tab shows what is open or paid out. All actions — fund, claim, vote — happen on poidh.xyz.',
  },
] as const;

export const POIDH_COMMUNITY_TASK_INTRO =
  'Open bounties are crowdfunded outcome markets on POIDH. Create here; fund, claim, and vote on poidh.xyz.';

/** Any public http(s) link — tweet, image, community page, etc. Stored on-chain as claim URI. */
export function isValidProofUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
