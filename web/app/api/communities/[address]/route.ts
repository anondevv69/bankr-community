import { NextResponse } from 'next/server';
import {
  getCommunity,
  getCommunities,
  getAllPosts,
  getLaunches,
  setCommunities,
  setPostsForToken,
  getPosts,
  deleteCommunity,
  deletePostsForToken,
} from '@/lib/db';
import { fetchLaunchByAddress, getLaunchOwnerWallets } from '@/lib/bankr-api';
import {
  canEditCommunityFundraising,
  getTokenBeneficiaryWallet,
  isTokenBeneficiary,
  isTokenDeployer,
  resolveSpacePermissions,
} from '@/lib/community-owner';
import { resolveAgentWallet } from '@/lib/bankr-agent-wallet';
import { normalizeTrustedDelegates } from '@/lib/space-delegates';
import { getBeneficiaryInfo } from '@/lib/beneficiary';
import { mergeCommunityDefaults, sortPostsWithPinned } from '@/lib/community-posts';
import {
  syncCommunityProfile,
  withResolvedProfile,
  shouldSyncProfile,
} from '@/lib/community-profile-sync';
import { normalizeSocialLinks } from '@/lib/social-links';
import { normalizeFundraising } from '@/lib/fundraising';
import { normalizeBannerUrl } from '@/lib/banner-url';
import { normalizeBlockedKeywords } from '@/lib/content-moderation';
import { normalizeAgentPool } from '@/lib/agent-pool';
import { fetchTokenMarketStats } from '@/lib/dexscreener';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';
import { communityUrl } from '@/lib/site-url';
import { isNativeSpaceCommunity } from '@/lib/featured-community';
import { isSiteAdminWallet } from '@/lib/site-admin';
import type { SocialLinks } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

async function saveCommunity(updated: ReturnType<typeof mergeCommunityDefaults>) {
  const communities = await getCommunities();
  const index = communities.findIndex(
    (item) => item.tokenAddress.toLowerCase() === updated.tokenAddress.toLowerCase()
  );
  if (index === -1) return;
  communities[index] = updated;
  await setCommunities(communities);
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  try {
    const [community, posts] = await Promise.all([
      getCommunity(tokenAddress),
      getPosts(tokenAddress),
    ]);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    let normalized = mergeCommunityDefaults(community);
    const needsSync = shouldSyncProfile(normalized);
    normalized = await syncCommunityProfile(normalized, { force: needsSync });
    if (needsSync) {
      await saveCommunity(normalized);
    }

    const [beneficiary, market] = await Promise.all([
      getBeneficiaryInfo(tokenAddress, normalized.chain),
      fetchTokenMarketStats(tokenAddress, normalized.chain),
    ]);

    const withDisplay = withResolvedProfile(normalized);

    return NextResponse.json({
      community: withDisplay,
      market,
      posts: sortPostsWithPinned(posts, normalized.pinnedPosts || []),
      beneficiary,
    });
  } catch (err) {
    console.error('GET community', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function boolField(body: Record<string, unknown>, key: string, current: boolean): boolean {
  return body[key] !== undefined ? Boolean(body[key]) : current;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));

  try {
    const communities = await getCommunities();
    const index = communities.findIndex(
      (item) => item.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const permissions = await resolveSpacePermissions(wallet, tokenAddress);

    const touchesProfile =
      body.description !== undefined ||
      body.socialLinks !== undefined ||
      body.customIconUrl !== undefined ||
      body.customBannerUrl !== undefined ||
      body.useBankrImage !== undefined ||
      body.useDexIcon !== undefined ||
      body.useDexBanner !== undefined ||
      body.useDexDescription !== undefined ||
      body.useDexLinks !== undefined;

    const touchesAgent =
      body.usePlatformAgent !== undefined || body.platformAgentSkills !== undefined;

    const touchesModeration = body.blockedKeywords !== undefined;

    const touchesAgentPool = body.agentPool !== undefined;

    if ((touchesProfile || touchesModeration) && !permissions.canEditProfile) {
      return NextResponse.json(
        {
          error:
            'Only the fee recipient, deployer (before verify), or a trusted delegate can update this space profile',
        },
        { status: 403 }
      );
    }

    if (body.usePlatformAgent !== undefined && !permissions.canManagePlatformAgent) {
      return NextResponse.json(
        {
          error:
            'Only the fee recipient or deployer can enable the Bankr Space Agent on this space',
        },
        { status: 403 }
      );
    }

    if (body.platformAgentSkills !== undefined && !permissions.canEnablePlatformAgentSkills) {
      return NextResponse.json(
        {
          error:
            'Only the verified fee recipient can authorize agent skill execution after goals are matched',
        },
        { status: 403 }
      );
    }

    if (touchesAgentPool && !permissions.canManagePlatformAgent) {
      return NextResponse.json(
        {
          error:
            'Only the fee recipient or deployer can configure the community agent pool',
        },
        { status: 403 }
      );
    }

    if (
      !touchesProfile &&
      !touchesAgent &&
      !touchesModeration &&
      !touchesAgentPool &&
      body.fundraising === undefined &&
      body.allowDeployerEdit === undefined &&
      body.trustedDelegates === undefined
    ) {
      return NextResponse.json({ error: 'No changes to save' }, { status: 400 });
    }

    if (
      body.fundraising !== undefined &&
      !(await canEditCommunityFundraising(wallet, tokenAddress))
    ) {
      return NextResponse.json(
        { error: 'Only the fee recipient can manage fundraisers and USDC goals' },
        { status: 403 }
      );
    }

    const current = mergeCommunityDefaults(communities[index]);
    const nextDescription =
      body.description !== undefined
        ? String(body.description || '').trim().slice(0, 2000)
        : current.description;

    if (body.description !== undefined && !nextDescription) {
      return NextResponse.json({ error: 'Description cannot be empty' }, { status: 400 });
    }

    let nextSocialLinks: SocialLinks = current.socialLinks || {};
    if (body.socialLinks !== undefined) {
      nextSocialLinks = normalizeSocialLinks(body.socialLinks || {});
    }

    let nextAllowDeployerEdit = current.allowDeployerEdit ?? false;
    if (body.allowDeployerEdit !== undefined) {
      if (!(await isTokenBeneficiary(wallet, tokenAddress))) {
        return NextResponse.json(
          { error: 'Only the fee recipient can change deployer access' },
          { status: 403 }
        );
      }
      nextAllowDeployerEdit = Boolean(body.allowDeployerEdit);
    }

    let nextTrustedDelegates = normalizeTrustedDelegates(current.trustedDelegates);
    if (body.trustedDelegates !== undefined) {
      if (!(await isTokenBeneficiary(wallet, tokenAddress))) {
        return NextResponse.json(
          { error: 'Only the fee recipient can change trusted delegate wallets' },
          { status: 403 }
        );
      }
      const normalized = normalizeTrustedDelegates(body.trustedDelegates);
      nextTrustedDelegates = await Promise.all(
        normalized.map(async (entry) => ({
          wallet: entry.wallet,
          agent:
            entry.agent ??
            (await resolveAgentWallet(entry.wallet, { tokenAddress })),
        }))
      );
    }

    let nextUsePlatformAgent = current.usePlatformAgent ?? false;
    let nextPlatformAgentSkills = current.platformAgentSkills ?? false;
    if (body.usePlatformAgent !== undefined) {
      nextUsePlatformAgent = Boolean(body.usePlatformAgent);
      if (!nextUsePlatformAgent) {
        nextPlatformAgentSkills = false;
      }
    }

    let nextAgentPool = normalizeAgentPool(current.agentPool);
    if (body.agentPool !== undefined) {
      if (!nextUsePlatformAgent) {
        return NextResponse.json(
          { error: 'Enable Use Bankr Space Agent before configuring the community agent pool' },
          { status: 400 }
        );
      }
      nextAgentPool = normalizeAgentPool(body.agentPool, { fromSave: true });
    }
    if (!nextUsePlatformAgent) {
      nextAgentPool = normalizeAgentPool({ optedIn: false, campaigns: [] });
    }
    if (body.platformAgentSkills !== undefined) {
      nextPlatformAgentSkills =
        nextUsePlatformAgent && Boolean(body.platformAgentSkills);
    }

    let nextFeeRecipientAgent = current.feeRecipientAgent ?? null;
    if (
      (body.trustedDelegates !== undefined ||
        body.allowDeployerEdit !== undefined ||
        body.usePlatformAgent !== undefined ||
        body.refreshAgentTags === true) &&
      (await isTokenBeneficiary(wallet, tokenAddress))
    ) {
      const beneficiaryWallet =
        (await getTokenBeneficiaryWallet(tokenAddress)) || wallet;
      nextFeeRecipientAgent = await resolveAgentWallet(beneficiaryWallet, {
        tokenAddress,
      });
    }

    const updated = mergeCommunityDefaults({
      ...current,
      description: nextDescription,
      socialLinks: nextSocialLinks,
      allowDeployerEdit: nextAllowDeployerEdit,
      trustedDelegates: nextTrustedDelegates,
      feeRecipientAgent: nextFeeRecipientAgent,
      usePlatformAgent: nextUsePlatformAgent,
      platformAgentSkills: nextPlatformAgentSkills,
      blockedKeywords:
        body.blockedKeywords !== undefined
          ? normalizeBlockedKeywords(body.blockedKeywords)
          : current.blockedKeywords ?? [],
      customIconUrl:
        body.customIconUrl !== undefined
          ? normalizeBannerUrl(body.customIconUrl)
          : current.customIconUrl ?? null,
      customBannerUrl:
        body.customBannerUrl !== undefined
          ? normalizeBannerUrl(body.customBannerUrl)
          : current.customBannerUrl ?? null,
      useBankrImage: boolField(body, 'useBankrImage', current.useBankrImage ?? true),
      useDexIcon: boolField(body, 'useDexIcon', current.useDexIcon ?? true),
      useDexBanner: boolField(body, 'useDexBanner', current.useDexBanner ?? true),
      useDexDescription: boolField(body, 'useDexDescription', current.useDexDescription ?? true),
      useDexLinks: boolField(body, 'useDexLinks', current.useDexLinks ?? true),
      fundraising:
        body.fundraising !== undefined
          ? normalizeFundraising(body.fundraising, { fromSave: true })
          : current.fundraising,
      agentPool: nextAgentPool,
    });

    const synced = await syncCommunityProfile(updated, { force: true });
    communities[index] = synced;
    await setCommunities(communities);

    const market = await fetchTokenMarketStats(tokenAddress, synced.chain);
    const community = withResolvedProfile(synced);

    return NextResponse.json({
      success: true,
      community,
      market,
      links: {
        communityPage: communityUrl(tokenAddress),
      },
    });
  } catch (err) {
    console.error('PATCH community', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));
  const description = String(body.description || '').trim();

  try {
    let launch = (await getLaunches()).find(
      (l) => l.tokenAddress?.toLowerCase() === tokenAddress
    );
    if (!launch) {
      launch = (await fetchLaunchByAddress(tokenAddress)) || undefined;
    }
    if (!launch) {
      return NextResponse.json(
        {
          error:
            'Token not found in Bankr launches. It must be a Bankr-launched token (including legacy tokens like BNKR).',
        },
        { status: 400 }
      );
    }

    const communities = await getCommunities();
    if (communities.some((c) => c.tokenAddress.toLowerCase() === tokenAddress)) {
      return NextResponse.json(
        { error: 'A space already exists for this token' },
        { status: 409 }
      );
    }

    const { feeRecipient, deployer } = getLaunchOwnerWallets(launch);
    const isBeneficiary = await isTokenBeneficiary(wallet, tokenAddress);

    const community = mergeCommunityDefaults({
      tokenAddress: launch.tokenAddress,
      name: launch.tokenName,
      symbol: launch.tokenSymbol,
      chain: launch.chain || 'base',
      founderWallet: wallet,
      ownerWallet: feeRecipient || deployer,
      allowDeployerEdit: false,
      trustedDelegates: [],
      usePlatformAgent: false,
      platformAgentSkills: false,
      verified: isBeneficiary,
      verifiedAt: isBeneficiary ? Date.now() : null,
      verifiedBy: isBeneficiary ? wallet : null,
      description: description || `${launch.tokenName} holder space`,
      imageUri: launch.imageUri ?? null,
      socialLinks: {},
      pinnedPosts: [],
      pinnedPostId: null,
      postCount: 0,
      memberCount: 0,
      createdAt: Date.now(),
      launchTimestamp: launch.timestamp,
    });

    const synced = await syncCommunityProfile(community, { force: true });
    communities.unshift(synced);
    await setCommunities(communities);

    const allPosts = await getAllPosts();
    if (!allPosts[tokenAddress]) {
      await setPostsForToken(tokenAddress, []);
    }

    return NextResponse.json({
      success: true,
      community: withResolvedProfile(synced),
      autoVerified: isBeneficiary,
      links: {
        communityPage: communityUrl(launch.tokenAddress),
      },
    });
  } catch (err) {
    console.error('POST community', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }
  if (!isSiteAdminWallet(wallet)) {
    return NextResponse.json({ error: 'Not authorized to delete spaces' }, { status: 403 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  if (isNativeSpaceCommunity(tokenAddress)) {
    return NextResponse.json({ error: 'Cannot delete the native Bankr Space token' }, { status: 403 });
  }

  try {
    const removed = await deleteCommunity(tokenAddress);
    if (!removed) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    await deletePostsForToken(tokenAddress);

    return NextResponse.json({
      success: true,
      deleted: {
        tokenAddress: removed.tokenAddress,
        symbol: removed.symbol,
      },
    });
  } catch (err) {
    console.error('DELETE community', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
