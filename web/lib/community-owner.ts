import { getCommunity, getLaunches } from './db';
import { fetchLaunchByAddress, getLaunchOwnerWallets } from './bankr-api';
import { holdsToken } from './holder';
import {
  isTrustedDelegateWallet,
  normalizeTrustedDelegates,
  trustedDelegateWallets,
} from './space-delegates';
import { isPlatformAgentWallet } from './platform-agent';
import type { TrustedDelegateEntry } from './types';
import { normalizeAddr } from './utils';

export type SpaceRoles = {
  feeRecipient: string;
  deployer: string;
};

export async function getLaunchRoles(tokenAddress: string): Promise<SpaceRoles> {
  const token = normalizeAddr(tokenAddress);
  let launch = (await getLaunches()).find((l) => l.tokenAddress?.toLowerCase() === token);
  if (!launch) {
    launch = (await fetchLaunchByAddress(token)) || undefined;
  }
  if (launch) {
    return getLaunchOwnerWallets(launch);
  }
  const community = await getCommunity(token);
  return {
    feeRecipient: community?.ownerWallet?.toLowerCase() || '',
    deployer: '',
  };
}

export async function getTokenBeneficiaryWallet(
  tokenAddress: string
): Promise<string | null> {
  const { feeRecipient } = await getLaunchRoles(tokenAddress);
  return feeRecipient || null;
}

export async function isTokenBeneficiary(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const beneficiary = await getTokenBeneficiaryWallet(tokenAddress);
  if (!beneficiary) return false;
  return wallet.toLowerCase() === beneficiary;
}

export async function isTokenDeployer(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const { deployer } = await getLaunchRoles(tokenAddress);
  if (!deployer) return false;
  return wallet.toLowerCase() === deployer;
}

export type SpacePermissions = {
  isBeneficiary: boolean;
  isDeployer: boolean;
  isTrustedDelegate: boolean;
  isPlatformAgent: boolean;
  isFounder: boolean;
  verified: boolean;
  usePlatformAgent: boolean;
  platformAgentSkills: boolean;
  allowDeployerEdit: boolean;
  trustedDelegates: TrustedDelegateEntry[];
  trustedDelegateWallets: string[];
  canEditProfile: boolean;
  canEditFundraising: boolean;
  /** Fee recipient (verified) or deployer — enable Bankr Space Agent (no USDC to deployer) */
  canManagePlatformAgent: boolean;
  /** Fee recipient only — skill-linked execution after x402 match */
  canEnablePlatformAgentSkills: boolean;
  canPinPosts: boolean;
  /** Same as canPinPosts — delete posts, enforce moderation */
  canModeratePosts: boolean;
  holds: boolean;
  balance: number;
  canPost: boolean;
  canReact: boolean;
  /** Social/moderation access without holding tokens */
  isPrivilegedPoster: boolean;
};

export async function resolveSpacePermissions(
  wallet: string,
  tokenAddress: string,
  chain = 'base'
): Promise<SpacePermissions> {
  const w = wallet.toLowerCase();
  const token = normalizeAddr(tokenAddress);
  const community = await getCommunity(token);
  const verified = !!community?.verified;
  const allowDeployerEdit = !!community?.allowDeployerEdit;
  const usePlatformAgent = !!community?.usePlatformAgent;
  const platformAgentSkills = !!community?.platformAgentSkills;
  const trustedDelegates = normalizeTrustedDelegates(community?.trustedDelegates);
  const isFounder = community?.founderWallet?.toLowerCase() === w;
  const resolvedChain = community?.chain || chain;

  const [isBeneficiary, isDeployer, holdResult] = await Promise.all([
    isTokenBeneficiary(w, token),
    isTokenDeployer(w, token),
    holdsToken(w, token, resolvedChain),
  ]);

  const isTrustedDelegate =
    verified && isTrustedDelegateWallet(w, trustedDelegates);

  const isPlatformAgent =
    verified && usePlatformAgent && isPlatformAgentWallet(w);

  const deployerHasSocialAccess =
    isDeployer && (!verified || allowDeployerEdit);
  const hasSocialAccess =
    isBeneficiary || deployerHasSocialAccess || isTrustedDelegate || isPlatformAgent;

  const canEditProfile = hasSocialAccess;
  const canEditFundraising = isBeneficiary;
  const canManagePlatformAgent =
    (verified && isBeneficiary) || isDeployer;
  const canEnablePlatformAgentSkills = verified && isBeneficiary;
  const canPinPosts = verified && hasSocialAccess;
  const canPost = holdResult.holds || hasSocialAccess;
  const canReact = canPost;

  return {
    isBeneficiary,
    isDeployer,
    isTrustedDelegate,
    isPlatformAgent,
    isFounder,
    verified,
    usePlatformAgent,
    platformAgentSkills,
    allowDeployerEdit,
    trustedDelegates,
    trustedDelegateWallets: trustedDelegateWallets(trustedDelegates),
    canEditProfile,
    canEditFundraising,
    canManagePlatformAgent,
    canEnablePlatformAgentSkills,
    canPinPosts,
    canModeratePosts: canPinPosts,
    holds: holdResult.holds,
    balance: holdResult.balance,
    canPost,
    canReact,
    isPrivilegedPoster: hasSocialAccess,
  };
}

export async function canEditCommunityProfile(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const permissions = await resolveSpacePermissions(wallet, tokenAddress);
  return permissions.canEditProfile;
}

export async function canEditCommunityFundraising(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const permissions = await resolveSpacePermissions(wallet, tokenAddress);
  return permissions.canEditFundraising;
}

export async function canPinCommunityPosts(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const permissions = await resolveSpacePermissions(wallet, tokenAddress);
  return permissions.canPinPosts;
}
