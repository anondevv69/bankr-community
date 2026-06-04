const tokenAddress = String(args.tokenAddress || '').toLowerCase();
const content = String(args.content || '').trim();

if (!tokenAddress) {
  return { success: false, error: 'tokenAddress required' };
}
if (!content) {
  return { success: false, error: 'Post cannot be empty' };
}
if (content.length > 2000) {
  return { success: false, error: 'Post too long (max 2000 characters)' };
}

const me = await bankr.wallet.me();
const wallet = me.evmAddress.toLowerCase();

const communities = (await appKV.get('communities')) || [];
const community = communities.find((c) => c.tokenAddress.toLowerCase() === tokenAddress);
if (!community) {
  return { success: false, error: 'Community not found' };
}

const portfolio = await bankr.wallet.balances({ showLowValueTokens: true });
let balance = 0;

for (const chainData of Object.values(portfolio.balances || {})) {
  const tokens = chainData.tokenBalances || [];
  for (const entry of tokens) {
    const addr = entry.token?.baseToken?.address;
    if (addr && addr.toLowerCase() === tokenAddress) {
      balance = Number(entry.token.balance) || 0;
      break;
    }
  }
  if (balance > 0) break;
}

if (balance <= 0) {
  return { success: false, error: 'You must hold at least 1 token to post' };
}

const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const newPost = {
  id: postId,
  wallet,
  content,
  reactions: { '👍': [], '❤️': [], '🔥': [] },
  timestamp: Date.now(),
  balance,
};

const allPosts = (await appKV.get('community_posts')) || {};
const posts = allPosts[tokenAddress] || [];
posts.push(newPost);
allPosts[tokenAddress] = posts;
await appKV.set('community_posts', allPosts);

community.postCount = posts.length;
const uniqueWallets = new Set(posts.map((p) => p.wallet));
community.memberCount = uniqueWallets.size;
await appKV.set('communities', communities);

return { success: true, postId };
