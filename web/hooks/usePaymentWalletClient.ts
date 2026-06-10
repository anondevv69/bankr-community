'use client';

import { useAccount, useChainId } from 'wagmi';
import { base } from 'wagmi/chains';

export function usePaymentWalletClient() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  return {
    address,
    isConnected,
    chainId,
    onBase: chainId === base.id,
  };
}
