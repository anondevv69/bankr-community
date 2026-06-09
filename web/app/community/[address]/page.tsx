'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useConnectWallet } from '@/components/WalletButton';
import { useAppWallet } from '@/hooks/useAppWallet';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';
import { Footer, Header } from '@/components/Header';
import { CommunityProfile } from '@/components/CommunityProfile';
import { PostFeed, PostForm } from '@/components/PostFeed';
import type { BeneficiaryInfo, Community, Post } from '@/lib/types';
import { apiFetch } from '@/lib/wagmi';

export default function CommunityPage({ params }: { params: { address: string } }) {
  const tokenAddress = params.address;
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
    isFounder: boolean;
    canEditProfile: boolean;
    canPinPosts: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

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
        isFounder: data.isFounder,
        canEditProfile: data.canEditProfile,
        canPinPosts: data.canPinPosts,
      });
    } catch {
      setHolder({
        holds: false,
        balance: 0,
        canPost: false,
        isOwner: false,
        isBeneficiary: false,
        isFounder: false,
        canEditProfile: false,
        canPinPosts: false,
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
  const canVerify = isConnected && !!holder?.isBeneficiary;

  return (
    <div className="max-w-[1100px] mx-auto px-5 pb-16">
      <Header backHref="/" />

      <CommunityProfile
        community={community}
        beneficiary={beneficiary}
        canManage={canEditProfile}
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
          {holder.holds
            ? `✓ You hold ${holder.balance.toLocaleString()} ${community.symbol} — you can post and react`
            : `✓ You are the token beneficiary — you can post and react without holding`}
        </div>
      ) : holder?.isFounder ? (
        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          You created this space. Hold {community.symbol} to post and react — only the token beneficiary can verify it.
        </div>
      ) : (
        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          You do not hold this token yet. Viewing only.
        </div>
      )}

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
        posts={posts}
        canInteract={!!canPost}
        canManage={canPinPosts}
        pinnedPosts={community.pinnedPosts}
        beneficiaryWallet={beneficiary?.wallet}
        ownerWallet={community.ownerWallet}
        onUpdate={load}
      />
      <Footer />
    </div>
  );
}
