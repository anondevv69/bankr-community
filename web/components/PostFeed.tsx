'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import type { PinnedPost, Post } from '@/lib/types';
import { isPostPinned } from '@/lib/community-posts';
import { formatTime } from '@/lib/utils';
import { AuthorBlock } from './AuthorBlock';
import { apiFetch } from '@/lib/wagmi';

const REACTIONS = ['👍', '❤️', '🔥'] as const;

export function PostFeed({
  tokenAddress,
  posts,
  canInteract,
  canManage,
  pinnedPosts,
  onUpdate,
}: {
  tokenAddress: string;
  posts: Post[];
  canInteract: boolean;
  canManage?: boolean;
  pinnedPosts?: PinnedPost[];
  onUpdate: () => void;
}) {
  const { address } = useAccount();
  const [pinningId, setPinningId] = useState<string | null>(null);

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
    const pinned = isPostPinned(pinnedPosts || [], postId);
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

  if (!posts.length) {
    return (
      <p className="text-center text-muted py-8 border border-dashed border-border rounded-xl">
        No posts yet. Be the first holder to share something!
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const isPinned = isPostPinned(pinnedPosts || [], post.id);
        const isMostRecentPin = pinnedPosts?.[0]?.postId === post.id;
        return (
        <article
          key={post.id}
          className={`bg-surface border rounded-xl p-5 ${
            isPinned ? 'border-accent/60 ring-1 ring-accent/20' : 'border-border'
          }`}
        >
          {isPinned ? (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-hover mb-3">
              {isMostRecentPin ? '📌 Pinned · most recent' : '📌 Pinned'}
            </div>
          ) : null}
          <AuthorBlock author={post.author} />
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <div className="flex gap-2">
              {REACTIONS.map((emoji) => {
                const count = post.reactions?.[emoji]?.length || 0;
                const active = address && post.reactions?.[emoji]?.includes(address.toLowerCase());
                return (
                  <button
                    key={emoji}
                    onClick={() => react(post.id, emoji)}
                    disabled={!canInteract}
                    className={`px-2.5 py-1 text-sm rounded-lg border ${
                      active
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface-2'
                    } disabled:opacity-40`}
                  >
                    {emoji} {count > 0 ? count : ''}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              {canManage ? (
                <button
                  onClick={() => togglePin(post.id)}
                  disabled={pinningId === post.id}
                  className="px-2.5 py-1 text-xs rounded-lg border border-border hover:border-accent disabled:opacity-50"
                >
                  {pinningId === post.id
                    ? 'Saving…'
                    : isPinned
                      ? 'Unpin'
                      : 'Pin'}
                </button>
              ) : null}
              <span className="text-xs text-muted">{formatTime(post.timestamp)}</span>
            </div>
          </div>
        </article>
      );
      })}
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
  const { address } = useAccount();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  async function submit() {
    if (!address || !content.trim()) return;
    setPosting(true);
    try {
      await apiFetch(`/api/communities/${tokenAddress}/posts`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({ content }),
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
        onClick={submit}
        disabled={posting || !content.trim()}
        className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
      >
        {posting ? 'Posting…' : 'Post'}
      </button>
    </div>
  );
}
