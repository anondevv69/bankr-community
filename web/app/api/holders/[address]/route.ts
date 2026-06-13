import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { resolveSpacePermissions } from '@/lib/community-owner';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json(
      { holds: false, balance: 0, canPost: false, error: 'wallet required' },
      { status: 400 }
    );
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    const chain = community?.chain || 'base';
    const permissions = await resolveSpacePermissions(wallet.toLowerCase(), tokenAddress, chain);

    return NextResponse.json({
      holds: permissions.holds,
      balance: permissions.balance,
      canPost: permissions.canPost,
      canReact: permissions.canReact,
      isOwner: permissions.isPrivilegedPoster,
      isBeneficiary: permissions.isBeneficiary,
      isDeployer: permissions.isDeployer,
      isTrustedDelegate: permissions.isTrustedDelegate,
      isPlatformAgent: permissions.isPlatformAgent,
      isFounder: permissions.isFounder,
      isPetitionFounder: permissions.isPetitionFounder,
      effectiveBeneficiary: permissions.effectiveBeneficiary,
      usePlatformAgent: permissions.usePlatformAgent,
      platformAgentSkills: permissions.platformAgentSkills,
      canEditProfile: permissions.canEditProfile,
      canEditFundraising: permissions.canEditFundraising,
      canManagePlatformAgent: permissions.canManagePlatformAgent,
      canProposeCommunityAgentGoal: permissions.canProposeCommunityAgentGoal,
      canEnablePlatformAgentSkills: permissions.canEnablePlatformAgentSkills,
      canPinPosts: permissions.canPinPosts,
      canModeratePosts: permissions.canModeratePosts,
      canCreateQuestion: permissions.canCreateQuestion,
      canVoteOnQuestion: permissions.canVoteOnQuestion,
      verified: permissions.verified,
      allowDeployerEdit: permissions.allowDeployerEdit,
      trustedDelegates: permissions.trustedDelegates,
      wallet: wallet.toLowerCase(),
      chain,
    });
  } catch (err) {
    console.error('GET holder', err);
    return NextResponse.json(
      { holds: false, balance: 0, canPost: false, error: 'Status check failed' },
      { status: 500 }
    );
  }
}
