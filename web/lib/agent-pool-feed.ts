import { getPosts, setPostsForToken, updateCommunityCounts } from '@/lib/db';
import { resolveAuthorProfile } from '@/lib/profiles';
import { PLATFORM_AGENT_ID, getPlatformAgentWallet } from '@/lib/platform-agent';
import { normalizeAddr } from '@/lib/utils';
import type { Post, PostSource } from '@/lib/types';

const AGENT_SOURCE: PostSource = {
  client: 'agent',
  viaAgent: true,
  agentId: PLATFORM_AGENT_ID,
  trigger: 'autopilot',
};

export async function createPlatformAgentPost(
  tokenAddress: string,
  content: string
): Promise<string | null> {
  const wallet = getPlatformAgentWallet();
  if (!wallet) return null;

  const normalized = normalizeAddr(tokenAddress);
  const trimmed = content.trim().slice(0, 2000);
  if (!trimmed) return null;

  const posts = await getPosts(normalized);
  const author = await resolveAuthorProfile(wallet);
  const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  posts.push({
    id: postId,
    wallet,
    author,
    content: trimmed,
    reactions: { '👍': [], '❤️': [], '🔥': [] },
    timestamp: Date.now(),
    balance: 0,
    source: AGENT_SOURCE,
  });

  await setPostsForToken(normalized, posts);
  await updateCommunityCounts(normalized, posts);
  return postId;
}
