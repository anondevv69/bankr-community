import { getCommunity, getLaunches } from './db';
import { fetchLaunchByAddress, isLaunchOwner } from './bankr-api';
import { holdsToken } from './holder';
import { normalizeAddr } from './utils';

export type ParticipationStatus = {
  holds: boolean;
  balance: number;
  isOwner: boolean;
  canPost: boolean;
  canReact: boolean;
};

export async function checkParticipation(
  wallet: string,
  tokenAddress: string,
  chain = 'base'
): Promise<ParticipationStatus> {
  const w = wallet.toLowerCase();
  const token = normalizeAddr(tokenAddress);
  const { holds, balance } = await holdsToken(w, token, chain);

  let isOwner = false;

  if (!holds) {
    let launch = (await getLaunches()).find((l) => l.tokenAddress?.toLowerCase() === token);
    if (!launch) {
      launch = (await fetchLaunchByAddress(token)) || undefined;
    }
    if (launch) {
      isOwner = isLaunchOwner(launch, w);
    }

    if (!isOwner) {
      const community = await getCommunity(token);
      if (community) {
        isOwner =
          w === community.ownerWallet?.toLowerCase() ||
          w === community.founderWallet?.toLowerCase();
      }
    }
  }

  const canParticipate = holds || isOwner;
  return {
    holds,
    balance,
    isOwner,
    canPost: canParticipate,
    canReact: canParticipate,
  };
}
