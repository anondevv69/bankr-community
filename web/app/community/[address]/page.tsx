'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConnectWallet } from '@/components/WalletButton';
import { useAppWallet } from '@/hooks/useAppWallet';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';
import { Footer, Header } from '@/components/Header';
import { CommunityProfile } from '@/components/CommunityProfile';
import { FundraisersPanel } from '@/components/FundraisersPanel';
import { PetitionBackersPanel } from '@/components/PetitionBackersPanel';
import { PostFeed, PostForm } from '@/components/PostFeed';
import { isNativeSpaceCommunity } from '@/lib/featured-community';
import { isSiteAdminWallet } from '@/lib/site-admin';
import type { BeneficiaryInfo, Community, Post } from '@/lib/types';
import { apiFetch } from '@/lib/wagmi';

export default function CommunityPage({ params }: { params: { address: string } }) {
  const tokenAddress = params.address;
  const router = useRouter();
  const { address, isConnected, isEmbedded } = useAppWallet();
  const { connectWallet } = useConnectWallet();
  const embed = useEmbeddedBankr();
  const [community, setCommunity] = useState<Community | null>(null);
  const [beneficiary, setBeneficiary] = useState<BeneficiaryInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [holder, setHolder] = useState<{
    holds: boolean;
    balance: number;
    canPost: boolean;
    isOwner: boolean;
    isBeneficiary: boolean;
    isDeployer: boolean;
    isTrustedDelegate: boolean;
    isFounder: boolean;
    isPetitionFounder: boolean;
    effectiveBeneficiary: boolean;
    canEditProfile: boolean;
    canEditFundraising: boolean;
    canManagePlatformAgent: boolean;
    canEnablePlatformAgentSkills: boolean;
    canProposeCommunityAgentGoal: boolean;
    canPinPosts: boolean;
    canCreateQuestion: boolean;
    canVoteOnQuestion: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCommunity(data.community);
      setBeneficiary(data.beneficiary || null);
      setPosts(data.posts || []);
    } catch {
      setCommunity(null);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  const checkHolder = useCallback(async () => {
    if (!address) {
      setHolder(null);
      return;
    }
    try {
      const data = await fetch(
        `/api/holders/${tokenAddress}?wallet=${address}`
      ).then((r) => r.json());
      setHolder({
        holds: data.holds,
        balance: data.balance,
        canPost: data.canPost,
        isOwner: data.isOwner,
        isBeneficiary: data.isBeneficiary,
        isDeployer: data.isDeployer,
        isTrustedDelegate: data.isTrustedDelegate,
        isFounder: data.isFounder,
        isPetitionFounder: data.isPetitionFounder,
        effectiveBeneficiary: data.effectiveBeneficiary,
        canEditProfile: data.canEditProfile,
        canEditFundraising: data.canEditFundraising,
        canManagePlatformAgent: data.canManagePlatformAgent,
        canEnablePlatformAgentSkills: data.canEnablePlatformAgentSkills,
        canProposeCommunityAgentGoal: data.canProposeCommunityAgentGoal,
        canPinPosts: data.canPinPosts,
        canCreateQuestion: data.canCreateQuestion,
        canVoteOnQuestion: data.canVoteOnQuestion,
      });
    } catch {
      setHolder({
        holds: false,
        balance: 0,
        canPost: false,
        isOwner: false,
        isBeneficiary: false,
        isDeployer: false,
        isTrustedDelegate: false,
        isFounder: false,
        isPetitionFounder: false,
        effectiveBeneficiary: false,
        canEditProfile: false,
        canEditFundraising: false,
        canManagePlatformAgent: false,
        canEnablePlatformAgentSkills: false,
        canProposeCommunityAgentGoal: false,
        canPinPosts: false,
        canCreateQuestion: false,
        canVoteOnQuestion: false,
      });
    }
  }, [address, tokenAddress]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    checkHolder();
  }, [checkHolder]);

  async function verifyCommunity() {
    if (!address) return connectWallet();
    try {
      await apiFetch(`/api/communities/${tokenAddress}/verify`, {
        method: 'POST',
        wallet: address,
      });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Verify failed');
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 py-12 text-muted">Loading space…</div>
    );
  }

  if (!community) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 py-12">
        <p className="text-red-400">Space not found.</p>
        <Link href="/" className="text-accent-hover text-sm mt-4 inline-block">
          ← Back to spaces
        </Link>
      </div>
    );
  }

  const canPost = isConnected && !!holder?.canPost;
  const canEditProfile = isConnected && !!holder?.canEditProfile;
  const canPinPosts = isConnected && !!holder?.canPinPosts;
  const canVerify = isConnected && !!holder?.isBeneficiary && !community.verified;
  const canManageTeamAccess =
    isConnected && !!holder?.effectiveBeneficiary && !!community.verified;
  const canManagePlatformAgent = isConnected && !!holder?.canManagePlatformAgent;
  const canEnablePlatformAgentSkills =
    isConnected && !!holder?.canEnablePlatformAgentSkills;
  const canEditFundraising = isConnected && !!holder?.canEditFundraising;
  const isSiteAdmin = isConnected && isSiteAdminWallet(address);
  const canDeleteSpace =
    isSiteAdmin && community && !isNativeSpaceCommunity(community.tokenAddress);

  async function deleteSpace() {
    if (!address || !community || !canDeleteSpace) return;
    if (
      !window.confirm(
        `Delete the $${community.symbol} space and all its posts? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await apiFetch(`/api/communities/${tokenAddress}`, {
        method: 'DELETE',
        wallet: address,
      });
      router.push('/');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 pb-16">
      <Header backHref="/" />

      <CommunityProfile
        community={community}
        beneficiary={beneficiary}
        canManage={canEditProfile}
        canEditFundraising={canEditFundraising}
        canManageTeamAccess={canManageTeamAccess}
        canManagePlatformAgent={canManagePlatformAgent}
        canEnablePlatformAgentSkills={canEnablePlatformAgentSkills}
        isDeployer={!!holder?.isDeployer}
        onUpdated={load}
      />

      {!community.verified && canVerify ? (
        <button
          type="button"
          onClick={verifyCommunity}
          className="mb-6 px-4 py-2 text-sm bg-accent text-white rounded-lg"
        >
          Verify Space
        </button>
      ) : null}

      {canDeleteSpace ? (
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => void deleteSpace()}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete space (admin)'}
          </button>
        </div>
      ) : null}

      {!isConnected ? (
        <div className="mb-6 p-3 bg-surface-2 border border-border rounded-lg text-sm text-muted">
          {isEmbedded
            ? 'Sign in with Bankr to check holder status and post.'
            : 'Connect wallet to check holder status and post.'}
          {isEmbedded && embed.ready ? (
            <button
              type="button"
              onClick={() => connectWallet()}
              className="ml-2 text-accent-hover hover:underline"
            >
              Sign in
            </button>
          ) : null}
        </div>
      ) : holder?.canPost ? (
        <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-600 dark:text-green-400">
          {holder.isPetitionFounder
            ? `✓ Petition founder — full space admin (same as fee recipient)`
            : holder.effectiveBeneficiary
              ? `✓ You are the fee recipient — you can post and react without holding`
              : holder.holds
                ? `✓ You hold ${holder.balance.toLocaleString()} ${community.symbol} — you can post and react`
                : holder.isDeployer
                  ? community.verified
                    ? `✓ Deployer access enabled — you can post and moderate (not fundraisers)`
                    : `✓ Token deployer — edit profile and post until the fee recipient verifies`
                  : holder.isTrustedDelegate
                    ? `✓ Trusted delegate — you can post and moderate (not fundraisers)`
                    : `✓ You can post and react without holding`}
        </div>
      ) : holder?.isDeployer && community.verified ? (
        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          Deployer access is off for this verified space. The fee recipient can enable it in Edit
          profile.
        </div>
      ) : holder?.isFounder && !community.fromPetition ? (
        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          You created this space. Hold {community.symbol} to post and react — only the fee
          recipient can verify it.
        </div>
      ) : (
        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          You do not hold this token yet. Viewing only.
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(260px,300px)_1fr] gap-6 items-start">
        <div className="space-y-4">
          {community.fromPetition ? (
            <PetitionBackersPanel tokenAddress={tokenAddress} />
          ) : null}
          <FundraisersPanel
            community={community}
            refreshKey={`${JSON.stringify(community.fundraising?.campaigns)}-${JSON.stringify(community.agentPool?.campaigns)}`}
            canProposeCommunityGoal={!!holder?.canProposeCommunityAgentGoal}
            onRefresh={load}
          />
        </div>

        <div className="min-w-0">
          {canPost ? (
            <PostForm tokenAddress={tokenAddress} onPosted={load} />
          ) : isConnected ? null : (
            <div className="mb-6 p-4 text-center text-muted text-sm border border-dashed border-border rounded-xl bg-surface">
              👀 View-only mode —{' '}
              {isEmbedded
                ? 'sign in with Bankr and hold this token to post and react.'
                : 'connect wallet and hold this token to post and react.'}
            </div>
          )}

          <PostFeed
            tokenAddress={tokenAddress}
            tokenSymbol={community.symbol}
            posts={posts}
            canInteract={!!canPost}
            canManage={canPinPosts}
            pinnedPosts={community.pinnedPosts}
            beneficiaryWallet={beneficiary?.wallet}
            ownerWallet={community.ownerWallet}
            onUpdate={load}
            canCreateQuestion={!!holder?.canCreateQuestion}
            canVoteOnQuestion={!!holder?.canVoteOnQuestion}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
