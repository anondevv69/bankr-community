const tokenAddress = String(args.tokenAddress || '').toLowerCase();
const postId = String(args.postId || '');
const reaction = String(args.reaction || '');

const allowed = ['👍', '❤️', '🔥'];
if (!tokenAddress || !postId || !allowed.includes(reaction)) {
  return { success: false, error: 'Invalid arguments' };
}

const me = await bankr.wallet.me();
const wallet = me.evmAddress.toLowerCase();

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
  return { success: false, error: 'You must hold the token to react' };
}

const allPosts = (await appKV.get('community_posts')) || {};
const posts = allPosts[tokenAddress] || [];
const post = posts.find((p) => p.id === postId);

if (!post) {
  return { success: false, error: 'Post not found' };
}

if (!post.reactions) post.reactions = {};
for (const emoji of allowed) {
  if (!post.reactions[emoji]) post.reactions[emoji] = [];
}

for (const emoji of allowed) {
  post.reactions[emoji] = post.reactions[emoji].filter((w) => w !== wallet);
}

if (!post.reactions[reaction].includes(wallet)) {
  post.reactions[reaction].push(wallet);
}

allPosts[tokenAddress] = posts;
await appKV.set('community_posts', allPosts);

return { success: true, reactions: post.reactions };
