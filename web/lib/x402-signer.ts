import type { Signer } from 'x402/types';
import {
  createWalletClient,
  custom,
  type Address,
  type Hex,
  type WalletClient,
} from 'viem';
import { base } from 'viem/chains';

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getBrowserProvider(): Eip1193Provider {
  if (typeof window === 'undefined') {
    throw new Error('Wallet signing is only available in the browser.');
  }
  const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!provider?.request) {
    throw new Error('No browser wallet found. Install MetaMask or Rabby.');
  }
  return provider;
}

export function createBrowserPaymentWalletClient(address: Address): WalletClient {
  return createWalletClient({
    account: address,
    chain: base,
    transport: custom(getBrowserProvider()),
  });
}

type AuthorizationTypedData = {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
};

async function signUsdcAuthorization(
  address: Address,
  data: AuthorizationTypedData
): Promise<Hex> {
  const client = createBrowserPaymentWalletClient(address);

  if (typeof client.signTypedData === 'function') {
    return client.signTypedData({
      account: address,
      domain: data.domain,
      types: data.types,
      primaryType: data.primaryType as 'TransferWithAuthorization',
      message: data.message,
    } as Parameters<WalletClient['signTypedData']>[0]);
  }

  const signature = await getBrowserProvider().request({
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(data)],
  });
  return signature as Hex;
}

/**
 * x402's isSignerWallet path expects signTypedData on a viem WalletClient prototype.
 * Wagmi clients often fail that check in production bundles, so use an account-shaped
 * signer (no chain/transport) that x402 routes through signTypedData directly.
 */
export function toX402Signer(address: Address): Signer {
  const unsupported = async () => {
    throw new Error('Unsupported signing method');
  };

  return {
    address,
    type: 'local',
    sign: unsupported,
    signMessage: unsupported,
    signTransaction: unsupported,
    signTypedData: (data: AuthorizationTypedData) => signUsdcAuthorization(address, data),
  } as unknown as Signer;
}
