import { getCommunity, getLaunches } from './db';
import { fetchLaunchByAddress, getLaunchOwnerWallets } from './bankr-api';
import { normalizeAddr } from './utils';

export async function getTokenBeneficiaryWallet(
  tokenAddress: string
): Promise<string | null> {
  const token = normalizeAddr(tokenAddress);

  let launch = (await getLaunches()).find((l) => l.tokenAddress?.toLowerCase() === token);
  if (!launch) {
    launch = (await fetchLaunchByAddress(token)) || undefined;
  }

  if (launch) {
    const { feeRecipient } = getLaunchOwnerWallets(launch);
    if (feeRecipient) return feeRecipient;
  }

  const community = await getCommunity(token);
  return community?.ownerWallet?.toLowerCase() || null;
}

export async function isTokenBeneficiary(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const beneficiary = await getTokenBeneficiaryWallet(tokenAddress);
  if (!beneficiary) return false;
  return wallet.toLowerCase() === beneficiary;
}

export async function canEditCommunityProfile(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  return isTokenBeneficiary(wallet, tokenAddress);
}

export async function canPinCommunityPosts(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const community = await getCommunity(normalizeAddr(tokenAddress));
  if (!community?.verified) return false;
  return isTokenBeneficiary(wallet, tokenAddress);
}
