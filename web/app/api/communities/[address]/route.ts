import { NextResponse } from 'next/server';
import {
  getCommunity,
  deleteCommunity,
  deletePostsForToken,
  getCommunities,
  setCommunities,
  getPosts,
} from '@/lib/db';
import { deleteQuestionsForToken } from '@/lib/community-questions';
import { createCommunityFromLaunch } from '@/lib/create-community-from-launch';
import { fetchLaunchByAddress } from '@/lib/bankr-api';
import {
  canEditCommunityFundraising,
  canActAsFeeRecipient,
  getTokenBeneficiaryWallet,
  resolveSpacePermissions,
} from '@/lib/community-owner';
import { resolveAgentWallet } from '@/lib/bankr-agent-wallet';
import { normalizeTrustedDelegates } from '@/lib/space-delegates';
import { getBeneficiaryInfo } from '@/lib/beneficiary';
import { mergeCommunityDefaults, sortPostsWithPinned } from '@/lib/community-posts';
import { getPetitionSpaceByToken } from '@/lib/petition-spaces';
import {
  syncCommunityProfile,
  withResolvedProfile,
  shouldSyncProfile,
} from '@/lib/community-profile-sync';
import { normalizeSocialLinks } from '@/lib/social-links';
import { normalizeFundraising } from '@/lib/fundraising';
import {
  applyAgentPoolAdminSave,
  applyBeneficiaryFundraisingSave,
  isAgentPoolCampaignLocked,
} from '@/lib/fundraiser-locks';
import { normalizeBannerUrl } from '@/lib/banner-url';
import { normalizeBlockedKeywords } from '@/lib/content-moderation';
import { normalizeAgentPool, readStoredAgentPool } from '@/lib/agent-pool';
import { migrateLegacyPoidhAgentPool } from '@/lib/agent-pool-legacy-poidh';
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
    const petitionSpace = await getPetitionSpaceByToken(tokenAddress);
    if (petitionSpace && !normalized.fromPetition) {
      normalized = {
        ...normalized,
        fromPetition: true,
        tmpPetitionId: petitionSpace.tmpPetitionId,
        tmkClaimOptIn: petitionSpace.tmkClaimOptIn ?? normalized.tmkClaimOptIn,
        verified: true,
        verifiedAt: normalized.verifiedAt ?? Date.now(),
        verifiedBy: normalized.verifiedBy ?? petitionSpace.founderWallet,
        founderWallet: normalized.founderWallet || petitionSpace.founderWallet,
      };
      await saveCommunity(normalized);
    }
    const migrated = migrateLegacyPoidhAgentPool(normalized);
    normalized = migrated.community;
    if (migrated.changed) {
      await saveCommunity(normalized);
    }
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
      if (!(await canActAsFeeRecipient(wallet, tokenAddress))) {
        return NextResponse.json(
          { error: 'Only the fee recipient can change deployer access' },
          { status: 403 }
        );
      }
      nextAllowDeployerEdit = Boolean(body.allowDeployerEdit);
    }

    let nextTrustedDelegates = normalizeTrustedDelegates(current.trustedDelegates);
    if (body.trustedDelegates !== undefined) {
      if (!(await canActAsFeeRecipient(wallet, tokenAddress))) {
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
        const pool = readStoredAgentPool(current.agentPool);
        if (pool.campaigns.some((c) => isAgentPoolCampaignLocked(c))) {
          return NextResponse.json(
            {
              error:
                'Cannot disable the Bankr Space Agent while a community goal has active USDC contributions. Wait until the goal is met.',
            },
            { status: 400 }
          );
        }
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
      const draftPool = normalizeAgentPool(body.agentPool, { fromSave: true });
      const poolSave = applyAgentPoolAdminSave(current.agentPool, draftPool.campaigns);
      if (!poolSave.ok) {
        return NextResponse.json({ error: poolSave.error }, { status: poolSave.status });
      }
      nextAgentPool = normalizeAgentPool({
        optedIn: poolSave.campaigns.some((c) => c.enabled),
        campaigns: poolSave.campaigns,
      });
    }
    if (!nextUsePlatformAgent) {
      nextAgentPool = normalizeAgentPool({ optedIn: false, campaigns: [] });
    }
    if (body.platformAgentSkills !== undefined) {
      nextPlatformAgentSkills =
        nextUsePlatformAgent && Boolean(body.platformAgentSkills);
    }

    let nextFundraising = current.fundraising;
    if (body.fundraising !== undefined) {
      const draft = normalizeFundraising(body.fundraising, { fromSave: true });
      const save = applyBeneficiaryFundraisingSave(current.fundraising, draft.campaigns);
      if (!save.ok) {
        return NextResponse.json({ error: save.error }, { status: save.status });
      }
      nextFundraising = normalizeFundraising({
        optedIn: save.campaigns.some((c) => c.enabled),
        campaigns: save.campaigns,
      });
    }

    let nextFeeRecipientAgent = current.feeRecipientAgent ?? null;
    if (
      (body.trustedDelegates !== undefined ||
        body.allowDeployerEdit !== undefined ||
        body.usePlatformAgent !== undefined ||
        body.refreshAgentTags === true) &&
      (await canActAsFeeRecipient(wallet, tokenAddress))
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
      fundraising: nextFundraising,
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
    const communities = await getCommunities();
    if (communities.some((c) => c.tokenAddress.toLowerCase() === tokenAddress)) {
      return NextResponse.json(
        { error: 'A space already exists for this token' },
        { status: 409 }
      );
    }

    const result = await createCommunityFromLaunch({
      tokenAddress,
      founderWallet: wallet,
      description,
    });

    return NextResponse.json({
      success: true,
      community: result.community,
      autoVerified: result.community.verified,
      links: result.links,
      created: result.created,
    });
  } catch (err) {
    console.error('POST community', err);
    const message = err instanceof Error ? err.message : 'Server error';
    const status = message.includes('already exists') ? 409 : message.includes('not found') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
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
    await deleteQuestionsForToken(tokenAddress);

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
