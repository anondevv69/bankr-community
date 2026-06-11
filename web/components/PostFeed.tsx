'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { useAppWallet } from '@/hooks/useAppWallet';
import { usePaymentWalletClient } from '@/hooks/usePaymentWalletClient';
import type { PinnedPost, Post } from '@/lib/types';
import { isPostPinned } from '@/lib/community-posts';
import { tipCommunityToken } from '@/lib/community-tip';
import {
  filterPosts,
  sortFilteredPosts,
  type PostFilter,
  type PostSort,
  isBeneficiaryWallet,
} from '@/lib/post-filters';
import { getRepliesForPost } from '@/lib/post-threads';
import { formatTime } from '@/lib/utils';
import { AuthorBlock } from './AuthorBlock';
import { PostContent } from './PostContent';
import { PostSourceBadge } from './PostSourceBadge';
import { OxWorkJobsPanel } from '@/components/OxWorkJobsPanel';
import { apiFetch } from '@/lib/wagmi';

const REACTIONS = ['👍', '❤️', '🔥'] as const;

type FeedTab = PostFilter | 'oxjobs';

const POST_FILTERS: Array<{ id: PostFilter; label: string; icon: string }> = [
  { id: 'all', label: 'All Posts', icon: '' },
  { id: 'beneficiary', label: 'Beneficiary', icon: '●' },
  { id: 'pinned', label: 'Pinned', icon: '📌' },
  { id: 'community', label: 'Community', icon: '👥' },
];

const OXJOBS_TAB = { id: 'oxjobs' as const, label: '0xJobs', icon: '💼' };

function ReplyForm({
  tokenAddress,
  parentPostId,
  canInteract,
  onPosted,
  onCancel,
}: {
  tokenAddress: string;
  parentPostId: string;
  canInteract: boolean;
  onPosted: () => void;
  onCancel: () => void;
}) {
  const { address, isEmbedded } = useAppWallet();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  async function submit() {
    if (!address || !content.trim()) return;
    setPosting(true);
    try {
      await apiFetch(`/api/communities/${tokenAddress}/posts`, {
        method: 'POST',
        wallet: address,
        client: isEmbedded ? 'bankr-app' : 'web',
        body: JSON.stringify({
          content,
          parentPostId,
          source: { trigger: 'manual' },
        }),
      });
      setContent('');
      onPosted();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reply failed');
    } finally {
      setPosting(false);
    }
  }

  if (!canInteract) return null;

  return (
    <div className="mt-3 space-y-2">
      <textarea
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm min-h-[72px]"
        placeholder="Write a reply…"
        maxLength={2000}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={posting || !content.trim()}
          className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-50"
        >
          {posting ? 'Replying…' : 'Reply'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TipForm({
  tokenAddress,
  tokenSymbol,
  recipient,
  onCancel,
}: {
  tokenAddress: string;
  tokenSymbol: string;
  recipient: string;
  onCancel: () => void;
}) {
  const { address, isConnected, onBase } = usePaymentWalletClient();
  const { switchChain } = useSwitchChain();
  const [amount, setAmount] = useState('1');
  const [tipping, setTipping] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  async function submit() {
    if (!address || !isConnected) {
      setHint('Connect wallet to tip.');
      return;
    }
    if (!onBase) {
      setHint('Switch to Base, then tip again.');
      switchChain({ chainId: base.id });
      return;
    }

    setTipping(true);
    setHint(`Confirm ${amount} ${tokenSymbol} tip in your wallet…`);
    setTxHash(null);
    try {
      const result = await tipCommunityToken({
        from: address,
        to: recipient as `0x${string}`,
        tokenAddress: tokenAddress as `0x${string}`,
        amount,
      });
      setHint(`Tip sent: ${result.amount} ${result.symbol}`);
      setTxHash(result.txHash);
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Tip failed');
    } finally {
      setTipping(false);
    }
  }

  return (
    <div className="mt-3 p-3 border border-border rounded-lg bg-surface-2/50 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="number"
          min={0}
          step="any"
          value={amount}
          disabled={tipping}
          onChange={(event) => setAmount(event.target.value)}
          className="w-24 px-3 py-1.5 bg-bg border border-border rounded-lg text-sm disabled:opacity-50"
          aria-label={`Tip amount in ${tokenSymbol}`}
        />
        <span className="text-xs text-muted">{tokenSymbol}</span>
        <button
          type="button"
          onClick={submit}
          disabled={tipping || !amount.trim()}
          className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-50"
        >
          {tipping ? 'Sending…' : 'Send tip'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={tipping}
          className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent disabled:opacity-50"
        >
          Close
        </button>
      </div>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {txHash ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent-hover hover:underline"
          >
            View tip on BaseScan
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(txHash)}
            className="text-muted hover:text-text"
          >
            Copy tx
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PostCard({
  post,
  posts,
  tokenAddress,
  tokenSymbol,
  canInteract,
  canManage,
  pins,
  beneficiaryWallet,
  ownerWallet,
  isReply,
  replyingTo,
  tippingPostId,
  onReplyTo,
  onTipPost,
  onCancelReply,
  onCancelTip,
  onUpdate,
  pinningId,
  onTogglePin,
  deletingId,
  onDeletePost,
}: {
  post: Post;
  posts: Post[];
  tokenAddress: string;
  tokenSymbol: string;
  canInteract: boolean;
  canManage?: boolean;
  pins: PinnedPost[];
  beneficiaryWallet?: string | null;
  ownerWallet?: string | null;
  isReply?: boolean;
  replyingTo: string | null;
  tippingPostId: string | null;
  onReplyTo: (postId: string) => void;
  onTipPost: (postId: string) => void;
  onCancelReply: () => void;
  onCancelTip: () => void;
  onUpdate: () => void;
  pinningId: string | null;
  onTogglePin: (postId: string) => void;
  deletingId: string | null;
  onDeletePost: (postId: string) => void;
}) {
  const { address } = useAppWallet();
  const isPinned = isPostPinned(pins, post.id);
  const isMostRecentPin = pins[0]?.postId === post.id;
  const isBeneficiary = isBeneficiaryWallet(post.wallet, beneficiaryWallet, ownerWallet);
  const replies = isReply ? [] : getRepliesForPost(posts, post.id);
  const canTip = canInteract && !!address && address.toLowerCase() !== post.wallet.toLowerCase();

  async function react(postId: string, reaction: string) {
    if (!address || !canInteract) return;
    try {
      await apiFetch(`/api/posts/${postId}/react`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({ tokenAddress, reaction }),
      });
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reaction failed');
    }
  }

  return (
    <div className={isReply ? 'mt-3' : ''}>
      <article
        className={`bg-surface border rounded-xl p-5 ${
          isPinned && !isReply
            ? 'border-accent/50 ring-1 ring-accent/10'
            : isReply
              ? 'border-border/80 bg-surface-2/40'
              : 'border-border'
        }`}
      >
        {isPinned && !isReply ? (
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent mb-3">
            {isMostRecentPin ? '📌 Pinned by beneficiary' : '📌 Pinned'}
          </div>
        ) : isReply ? (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
            ↳ Reply
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <AuthorBlock author={post.author} isBeneficiary={isBeneficiary} compact />
          <span className="text-xs text-muted shrink-0">{formatTime(post.timestamp)}</span>
        </div>

        <PostContent content={post.content} className="mt-3 pl-[52px] space-y-1" />
        <PostSourceBadge source={post.source} />

        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-border pl-[52px]">
          <div className="flex flex-wrap gap-2">
            {REACTIONS.map((emoji) => {
              const count = post.reactions?.[emoji]?.length || 0;
              const active =
                address && post.reactions?.[emoji]?.includes(address.toLowerCase());
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(post.id, emoji)}
                  disabled={!canInteract}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    active
                      ? 'border-accent bg-accent/10 text-accent-hover'
                      : 'border-border bg-surface-2 hover:border-accent/50'
                  } disabled:opacity-40`}
                >
                  {emoji}
                  {count > 0 ? <span className="text-xs font-medium">{count}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            {!isReply && canInteract ? (
              <button
                type="button"
                onClick={() => onReplyTo(post.id)}
                className="px-2.5 py-1 text-xs rounded-lg border border-border hover:border-accent"
              >
                Reply
              </button>
            ) : null}
            {canTip ? (
              <button
                type="button"
                onClick={() => onTipPost(post.id)}
                className="px-2.5 py-1 text-xs rounded-lg border border-border hover:border-accent"
              >
                Tip
              </button>
            ) : null}
            {!isReply && canManage ? (
              <button
                type="button"
                onClick={() => onTogglePin(post.id)}
                disabled={pinningId === post.id}
                className="px-2.5 py-1 text-xs rounded-lg border border-border hover:border-accent disabled:opacity-50"
              >
                {pinningId === post.id ? 'Saving…' : isPinned ? 'Unpin' : 'Pin'}
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => onDeletePost(post.id)}
                disabled={deletingId === post.id}
                className="px-2.5 py-1 text-xs rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deletingId === post.id ? 'Removing…' : 'Remove'}
              </button>
            ) : null}
          </div>
        </div>

        {replyingTo === post.id ? (
          <div className="pl-[52px]">
            <ReplyForm
              tokenAddress={tokenAddress}
              parentPostId={post.id}
              canInteract={canInteract}
              onPosted={() => {
                onCancelReply();
                onUpdate();
              }}
              onCancel={onCancelReply}
            />
          </div>
        ) : null}

        {tippingPostId === post.id ? (
          <div className="pl-[52px]">
            <TipForm
              tokenAddress={tokenAddress}
              tokenSymbol={tokenSymbol}
              recipient={post.wallet}
              onCancel={onCancelTip}
            />
          </div>
        ) : null}
      </article>

      {replies.length > 0 ? (
        <div className="mt-2 ml-6 sm:ml-10 pl-4 border-l-2 border-border/80 space-y-2">
          {replies.map((reply) => (
            <PostCard
              key={reply.id}
              post={reply}
              posts={posts}
              tokenAddress={tokenAddress}
              tokenSymbol={tokenSymbol}
              canInteract={canInteract}
              canManage={canManage}
              pins={pins}
              beneficiaryWallet={beneficiaryWallet}
              ownerWallet={ownerWallet}
              isReply
              replyingTo={replyingTo}
              tippingPostId={tippingPostId}
              onReplyTo={onReplyTo}
              onTipPost={onTipPost}
              onCancelReply={onCancelReply}
              onCancelTip={onCancelTip}
              onUpdate={onUpdate}
              pinningId={pinningId}
              onTogglePin={onTogglePin}
              deletingId={deletingId}
              onDeletePost={onDeletePost}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PostFeed({
  tokenAddress,
  tokenSymbol,
  posts,
  canInteract,
  canManage,
  pinnedPosts,
  beneficiaryWallet,
  ownerWallet,
  onUpdate,
}: {
  tokenAddress: string;
  tokenSymbol: string;
  posts: Post[];
  canInteract: boolean;
  canManage?: boolean;
  pinnedPosts?: PinnedPost[];
  beneficiaryWallet?: string | null;
  ownerWallet?: string | null;
  onUpdate: () => void;
}) {
  const { address } = useAppWallet();
  const [filter, setFilter] = useState<FeedTab>('all');
  const [hasOxJobs, setHasOxJobs] = useState(false);
  const isOxJobs = filter === 'oxjobs';
  const [sort, setSort] = useState<PostSort>('newest');
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [tippingPostId, setTippingPostId] = useState<string | null>(null);

  const pins = pinnedPosts || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/communities/${tokenAddress}/oxwork`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setHasOxJobs((data.tasks?.length ?? 0) > 0);
        }
      } catch {
        if (!cancelled) setHasOxJobs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  useEffect(() => {
    if (!hasOxJobs && filter === 'oxjobs') setFilter('all');
  }, [hasOxJobs, filter]);

  const visibleFilters = useMemo(
    () => (hasOxJobs ? [...POST_FILTERS, OXJOBS_TAB] : POST_FILTERS),
    [hasOxJobs]
  );

  const visiblePosts = useMemo(() => {
    if (isOxJobs) return [];
    const postFilter = filter as PostFilter;
    const filtered = filterPosts(posts, postFilter, pins, beneficiaryWallet, ownerWallet);
    return sortFilteredPosts(filtered, postFilter, sort, pins);
  }, [posts, filter, sort, pins, beneficiaryWallet, ownerWallet, isOxJobs]);

  async function togglePin(postId: string) {
    if (!address || !canManage) return;
    setPinningId(postId);
    const pinned = isPostPinned(pins, postId);
    try {
      await apiFetch(`/api/communities/${tokenAddress}/pin-post`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({
          postId,
          action: pinned ? 'unpin' : 'pin',
        }),
      });
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Pin failed');
    } finally {
      setPinningId(null);
    }
  }

  async function deletePost(postId: string) {
    if (!address || !canManage) return;
    if (!confirm('Remove this post? Replies to a top-level post are removed too.')) return;
    setDeletingId(postId);
    try {
      await apiFetch(`/api/communities/${tokenAddress}/posts/${postId}`, {
        method: 'DELETE',
        wallet: address,
      });
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1 p-1 bg-surface-2 border border-border rounded-xl">
          {visibleFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === item.id
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-muted hover:text-text'
              }`}
            >
              {item.icon ? <span className="text-xs">{item.icon}</span> : null}
              {item.label}
            </button>
          ))}
        </div>
        {!isOxJobs ? (
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <span className="hidden sm:inline">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as PostSort)}
              className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
        ) : null}
      </div>

      {isOxJobs ? (
        <OxWorkJobsPanel tokenAddress={tokenAddress} symbol={tokenSymbol} />
      ) : !visiblePosts.length ? (
        <p className="text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface">
          {posts.length === 0
            ? 'No posts yet. Be the first holder to share something!'
            : 'No posts match this filter.'}
        </p>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              posts={posts}
              tokenAddress={tokenAddress}
              tokenSymbol={tokenSymbol}
              canInteract={canInteract}
              canManage={canManage}
              pins={pins}
              beneficiaryWallet={beneficiaryWallet}
              ownerWallet={ownerWallet}
              replyingTo={replyingTo}
              tippingPostId={tippingPostId}
              onReplyTo={(postId) => {
                setReplyingTo(postId);
                setTippingPostId(null);
              }}
              onTipPost={(postId) => {
                setTippingPostId(postId);
                setReplyingTo(null);
              }}
              onCancelReply={() => setReplyingTo(null)}
              onCancelTip={() => setTippingPostId(null)}
              onUpdate={onUpdate}
              pinningId={pinningId}
              onTogglePin={togglePin}
              deletingId={deletingId}
              onDeletePost={deletePost}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PostForm({
  tokenAddress,
  onPosted,
}: {
  tokenAddress: string;
  onPosted: () => void;
}) {
  const { address, isEmbedded } = useAppWallet();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  async function submit() {
    if (!address || !content.trim()) return;
    setPosting(true);
    try {
      await apiFetch(`/api/communities/${tokenAddress}/posts`, {
        method: 'POST',
        wallet: address,
        client: isEmbedded ? 'bankr-app' : 'web',
        body: JSON.stringify({
          content,
          source: { trigger: 'manual' },
        }),
      });
      setContent('');
      onPosted();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Post failed');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <textarea
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm min-h-[100px] mb-3"
        placeholder="Share your thoughts with fellow holders…"
        maxLength={2000}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        type="button"
        onClick={submit}
        disabled={posting || !content.trim()}
        className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
      >
        {posting ? 'Posting…' : 'Post'}
      </button>
    </div>
  );
}
