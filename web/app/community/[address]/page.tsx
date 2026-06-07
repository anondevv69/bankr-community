'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useConnectWallet } from '@/components/WalletButton';
import { Header, Footer } from '@/components/Header';
import { PostFeed, PostForm } from '@/components/PostFeed';
import type { Community, Post } from '@/lib/types';
import { apiFetch } from '@/lib/wagmi';

export default function CommunityPage({ params }: { params: { address: string } }) {
  const tokenAddress = params.address;
  const { address, isConnected } = useAccount();
  const { connectWallet } = useConnectWallet();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [holder, setHolder] = useState<{
    holds: boolean;
    balance: number;
    canPost: boolean;
    isOwner: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCommunity(data.community);
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
      });
    } catch {
      setHolder({ holds: false, balance: 0, canPost: false, isOwner: false });
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

  function copyContract() {
    if (community?.tokenAddress) {
      navigator.clipboard.writeText(community.tokenAddress);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 py-12 text-muted">Loading community…</div>
    );
  }

  if (!community) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 py-12">
        <p className="text-red-400">Community not found.</p>
        <Link href="/" className="text-accent-hover text-sm mt-4 inline-block">
          ← Back to communities
        </Link>
      </div>
    );
  }

  const canPost = isConnected && !!holder?.canPost;
  const isOwner =
    address &&
    (address.toLowerCase() === community.ownerWallet?.toLowerCase() ||
      address.toLowerCase() === community.founderWallet?.toLowerCase());

  return (
    <div className="max-w-[1100px] mx-auto px-5 pb-16">
      <Link href="/" className="text-sm text-muted hover:text-text mb-4 inline-block">
        ← Back to communities
      </Link>

      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="text-3xl font-bold text-accent-hover">{community.symbol}</div>
        <div className="text-xl font-semibold mt-1">{community.name}</div>
        <div className="flex flex-wrap items-center gap-2 mt-4 text-sm">
          <span className="text-muted">Contract</span>
          <code className="font-mono text-accent-hover">{community.tokenAddress}</code>
          <button
            onClick={copyContract}
            className="px-3 py-1 text-xs border border-border rounded-lg hover:border-accent"
          >
            Copy
          </button>
        </div>
        <p className="text-muted text-sm mt-4">{community.description}</p>
        {community.verified ? (
          <span className="inline-block mt-4 text-[11px] font-semibold px-2 py-1 rounded-full bg-green-500/10 text-green-500">
            ✓ Verified by token owner
          </span>
        ) : (
          <>
            <span className="inline-block mt-4 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-500/15 text-amber-500">
              Unverified — awaiting token owner
            </span>
            {isOwner && isConnected ? (
              <button
                onClick={verifyCommunity}
                className="block mt-3 px-4 py-2 text-sm bg-accent text-white rounded-lg"
              >
                Verify Community
              </button>
            ) : null}
          </>
        )}

        {!isConnected ? (
          <div className="mt-4 p-3 bg-surface-2 border border-border rounded-lg text-sm text-muted">
            Connect wallet to check holder status and post.
          </div>
        ) : holder?.canPost ? (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
            {holder.holds
              ? `✓ You hold ${holder.balance.toLocaleString()} ${community.symbol} — you can post and react`
              : `✓ You are the token owner — you can post and react without holding`}
          </div>
        ) : (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-400">
            You do not hold this token yet. Viewing only.
          </div>
        )}
      </div>

      {canPost ? (
        <PostForm tokenAddress={tokenAddress} onPosted={load} />
      ) : isConnected ? null : (
        <div className="mb-6 p-4 text-center text-muted text-sm border border-dashed border-border rounded-xl">
          👀 View-only mode — connect wallet and hold this token to post and react.
        </div>
      )}

      <PostFeed
        tokenAddress={tokenAddress}
        posts={posts}
        canInteract={!!canPost}
        onUpdate={load}
      />
      <Footer />
    </div>
  );
}
