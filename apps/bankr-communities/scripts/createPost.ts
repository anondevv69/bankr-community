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

const chain = String(community.chain || 'base').toLowerCase();
let balance = 0;

try {
  const portfolio = await bankr.wallet.balances({
    chains: chain,
    showLowValueTokens: true,
  });

  if (Array.isArray(portfolio.tokens)) {
    for (const entry of portfolio.tokens) {
      const addr = (
        entry.address ||
        entry.baseToken?.address ||
        entry.token?.baseToken?.address
      )?.toLowerCase();
      if (addr === tokenAddress) {
        balance = Number(entry.balance ?? entry.token?.balance ?? 0);
        break;
      }
    }
  }

  if (balance <= 0 && portfolio.balances) {
    for (const chainData of Object.values(portfolio.balances)) {
      const tokens = chainData.tokenBalances || [];
      for (const entry of tokens) {
        const addr = entry.token?.baseToken?.address?.toLowerCase();
        if (addr === tokenAddress) {
          balance = Number(entry.token.balance) || 0;
          break;
        }
      }
      if (balance > 0) break;
    }
  }
} catch (err) {
  log('portfolio check failed in createPost', err);
}

if (balance <= 0) {
  try {
    const raw = await bankr.chain.readContract({
      chain,
      address: tokenAddress,
      abi: [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'balanceOf',
      args: [wallet],
    });
    const rawBalance = BigInt(raw || 0);
    if (rawBalance > 0n) {
      balance = Number(rawBalance) / 1e18;
      if (balance < 0.000001) balance = Number(rawBalance);
    }
  } catch (err) {
    log('on-chain check failed in createPost', err);
  }
}

if (balance <= 0) {
  return { success: false, error: 'You must hold at least 1 token to post' };
}

const author = {
  wallet,
  twitter: null,
  farcaster: null,
  profileImage: null,
};

try {
  const profile = await http.fetch('https://api.bankr.bot/wallet/me');
  for (const s of profile?.socialAccounts || []) {
    if (s.platform === 'twitter' && s.username) {
      author.twitter = String(s.username).replace(/^@/, '');
    }
    if (s.platform === 'farcaster' && s.username) {
      author.farcaster = String(s.username).replace(/^@/, '');
    }
  }
} catch (err) {
  log('wallet/me failed at post time', err);
}

const launches = (await appKV.get('token_launches')) || [];
for (const launch of launches) {
  for (const party of [launch.deployer, launch.feeRecipient]) {
    if (party?.walletAddress?.toLowerCase() === wallet) {
      if (party.xUsername && !author.twitter) {
        author.twitter = String(party.xUsername).replace(/^@/, '');
      }
      if (party.xProfileImageUrl && !author.profileImage) {
        author.profileImage = party.xProfileImageUrl;
      }
    }
  }
}

const cached = (await appKV.get('user_profiles')) || {};
cached[wallet] = { ...author, updatedAt: Date.now() };
await appKV.set('user_profiles', cached);

const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const newPost = {
  id: postId,
  wallet,
  author,
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

return { success: true, postId, author };
