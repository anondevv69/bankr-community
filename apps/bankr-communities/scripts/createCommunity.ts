const tokenAddress = String(args.tokenAddress || '').toLowerCase();
const description = String(args.description || '').trim();

if (!tokenAddress) {
  return { success: false, error: 'tokenAddress required' };
}

const me = await bankr.wallet.me();
const wallet = me.evmAddress.toLowerCase();

const launches = (await appKV.get('token_launches')) || [];
const launch = launches.find((l) => l.tokenAddress?.toLowerCase() === tokenAddress);

if (!launch) {
  return { success: false, error: 'Token not found in Bankr launches. Run syncTokens first.' };
}

const feeRecipient = launch.feeRecipient?.walletAddress?.toLowerCase();
const deployer = launch.deployer?.walletAddress?.toLowerCase();

if (wallet !== feeRecipient && wallet !== deployer) {
  return {
    success: false,
    error: 'Only the fee recipient or deployer can create a community for this token',
  };
}

const communities = (await appKV.get('communities')) || [];
const existing = communities.find((c) => c.tokenAddress.toLowerCase() === tokenAddress);
if (existing) {
  return { success: false, error: 'Community already exists for this token' };
}

const community = {
  tokenAddress: launch.tokenAddress,
  name: launch.tokenName,
  symbol: launch.tokenSymbol,
  chain: launch.chain,
  creatorWallet: feeRecipient || deployer,
  description: description || `${launch.tokenName} holder community`,
  postCount: 0,
  memberCount: 0,
  createdAt: Date.now(),
  launchTimestamp: launch.timestamp,
};

communities.unshift(community);
await appKV.set('communities', communities);

const allPosts = (await appKV.get('community_posts')) || {};
if (!allPosts[tokenAddress]) {
  allPosts[tokenAddress] = [];
  await appKV.set('community_posts', allPosts);
}

return { success: true, community };
