import { getLaunches } from './db';
import { fetchLaunchByAddress, getLaunchOwnerWallets } from './bankr-api';
import {
  beneficiaryXUrl,
  walletExplorerUrl,
} from './social-links';
import type { BeneficiaryInfo } from './types';
import { normalizeAddr } from './utils';

export async function getBeneficiaryInfo(
  tokenAddress: string,
  chain = 'base'
): Promise<BeneficiaryInfo | null> {
  const token = normalizeAddr(tokenAddress);

  let launch = (await getLaunches()).find((l) => l.tokenAddress?.toLowerCase() === token);
  if (!launch) {
    launch = (await fetchLaunchByAddress(token)) || undefined;
  }
  if (!launch) return null;

  const { feeRecipient } = getLaunchOwnerWallets(launch);
  if (!feeRecipient) return null;

  const xUsername = launch.feeRecipient?.xUsername || null;

  return {
    wallet: feeRecipient,
    xUsername,
    xUrl: beneficiaryXUrl(xUsername),
    walletUrl: walletExplorerUrl(feeRecipient, chain),
  };
}
