const tokenAddress = String(args.tokenAddress || '').toLowerCase();
const chain = String(args.chain || 'base').toLowerCase();

if (!tokenAddress) {
  return { holds: false, balance: 0, canPost: false, error: 'tokenAddress required' };
}

try {
  const me = await bankr.wallet.me();
  const wallet = me.evmAddress;
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
    log('portfolio balance check failed', err);
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
      log('on-chain balance check failed', err);
    }
  }

  return {
    holds: balance > 0,
    balance,
    canPost: balance > 0,
    wallet: wallet.toLowerCase(),
    chain,
  };
} catch (error) {
  log('verifyHolder error', error);
  return {
    holds: false,
    balance: 0,
    canPost: false,
    error: error?.message || 'Status check failed',
  };
}
