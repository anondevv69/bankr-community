const tokenAddress = String(args.tokenAddress || '').toLowerCase();
if (!tokenAddress) {
  return { holds: false, balance: 0, canPost: false, error: 'tokenAddress required' };
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

return {
  holds: balance > 0,
  balance,
  canPost: balance > 0,
};
