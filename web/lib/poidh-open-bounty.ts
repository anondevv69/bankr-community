/** POIDH open bounty model — https://words.poidh.xyz/poidh-open-bounties-guide */

export const POIDH_OPEN_BOUNTY_GUIDE_URL =
  'https://words.poidh.xyz/poidh-open-bounties-guide';

export const POIDH_OPEN_BOUNTY_STEPS = [
  {
    title: 'Create a bounty in the Bounties tab',
    body: 'Any token holder describes the task (Dex profile, shoutout, listing, etc.). It opens on-chain automatically as an open bounty.',
  },
  {
    title: 'Add funds in ETH',
    body: 'Use Add funds right on the bounty card to grow the reward pool. Your share of the pool = your voting power when a winner is proposed.',
  },
  {
    title: 'Do the work & post proof',
    body: 'Complete the task, post proof in the bankr.space community, then submit your community post URL on the same bounty card.',
  },
  {
    title: 'Issuer proposes winner → 48h vote',
    body: 'After you submit a claim, the issuer wallet proposes it for voting. Contributors vote yes/no for 48 hours (weighted by funds). If yes wins, the worker is paid from the pool automatically.',
  },
] as const;

export const POIDH_COMMUNITY_TASK_INTRO =
  'Open bounties are crowdfunded outcome markets: create a task in the Bounties tab, pool ETH on-chain here, verify proof together, pay automatically.';
