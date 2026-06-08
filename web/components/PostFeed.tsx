'use client';

import { useMemo, useState } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import type { PinnedPost, Post } from '@/lib/types';
import { isPostPinned } from '@/lib/community-posts';
import {
  filterPosts,
  sortFilteredPosts,
  type PostFilter,
  type PostSort,
  isBeneficiaryWallet,
} from '@/lib/post-filters';
import { formatTime } from '@/lib/utils';
import { AuthorBlock } from './AuthorBlock';
import { PostSourceBadge } from './PostSourceBadge';
import { apiFetch } from '@/lib/wagmi';

const REACTIONS = ['👍', '❤️', '🔥'] as const;

const FILTERS: Array<{ id: PostFilter; label: string; icon: string }> = [
  { id: 'all', label: 'All Posts', icon: '' },
  { id: 'beneficiary', label: 'Beneficiary', icon: '●' },
  { id: 'pinned', label: 'Pinned', icon: '📌' },
  { id: 'community', label: 'Community', icon: '👥' },
];

export function PostFeed({
  tokenAddress,
  posts,
  canInteract,
  canManage,
  pinnedPosts,
  beneficiaryWallet,
  ownerWallet,
  onUpdate,
}: {
  tokenAddress: string;
  posts: Post[];
  canInteract: boolean;
  canManage?: boolean;
  pinnedPosts?: PinnedPost[];
  beneficiaryWallet?: string | null;
  ownerWallet?: string | null;
  onUpdate: () => void;
}) {
  const { address } = useAppWallet();
  const [filter, setFilter] = useState<PostFilter>('all');
  const [sort, setSort] = useState<PostSort>('newest');
  const [pinningId, setPinningId] = useState<string | null>(null);

  const pins = pinnedPosts || [];

  const visiblePosts = useMemo(() => {
    const filtered = filterPosts(posts, filter, pins, beneficiaryWallet, ownerWallet);
    return sortFilteredPosts(filtered, filter, sort, pins);
  }, [posts, filter, sort, pins, beneficiaryWallet, ownerWallet]);

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1 p-1 bg-surface-2 border border-border rounded-xl">
          {FILTERS.map((item) => (
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
      </div>

      {!visiblePosts.length ? (
        <p className="text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface">
          {posts.length === 0
            ? 'No posts yet. Be the first holder to share something!'
            : 'No posts match this filter.'}
        </p>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post) => {
            const isPinned = isPostPinned(pins, post.id);
            const isMostRecentPin = pins[0]?.postId === post.id;
            const isBeneficiary = isBeneficiaryWallet(
              post.wallet,
              beneficiaryWallet,
              ownerWallet
            );

            return (
              <article
                key={post.id}
                className={`bg-surface border rounded-xl p-5 ${
                  isPinned
                    ? 'border-accent/50 ring-1 ring-accent/10'
                    : 'border-border'
                }`}
              >
                {isPinned ? (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-accent mb-3">
                    {isMostRecentPin ? '📌 Pinned by beneficiary' : '📌 Pinned'}
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <AuthorBlock author={post.author} isBeneficiary={isBeneficiary} compact />
                  <span className="text-xs text-muted shrink-0">{formatTime(post.timestamp)}</span>
                </div>

                <p className="text-sm whitespace-pre-wrap leading-relaxed mt-3 pl-[52px]">
                  {post.content}
                </p>

                <PostSourceBadge source={post.source} />

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border pl-[52px]">
                  <div className="flex gap-2">
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
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => togglePin(post.id)}
                      disabled={pinningId === post.id}
                      className="px-2.5 py-1 text-xs rounded-lg border border-border hover:border-accent disabled:opacity-50"
                    >
                      {pinningId === post.id ? 'Saving…' : isPinned ? 'Unpin' : 'Pin'}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
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
