import {
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'wagmi/chains';
import { normalizeAddr } from './utils';
import {
  POIDH_V3_BASE,
  poidhPublicClient,
  poidhV3Abi,
} from './poidh-contract';

const DEFAULT_SEED_ETH = '0.001';

function normalizePrivateKey(raw: string): Hex | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return null;
  const hex = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) return null;
  return hex as Hex;
}

export function getPoidhIssuerPrivateKey(): Hex | null {
  const raw = process.env.POIDH_ISSUER_PRIVATE_KEY?.trim();
  if (!raw) return null;
  return normalizePrivateKey(raw);
}

export function getPoidhIssuerWallet(): Address | null {
  const configured = process.env.POIDH_ISSUER_WALLET?.trim();
  if (configured) {
    try {
      return normalizeAddr(configured) as Address;
    } catch {
      return null;
    }
  }
  const key = getPoidhIssuerPrivateKey();
  if (!key) return null;
  return privateKeyToAccount(key).address;
}

export function isPoidhIssuerConfigured(): boolean {
  const key = getPoidhIssuerPrivateKey();
  const wallet = getPoidhIssuerWallet();
  if (!key || !wallet) return false;
  return privateKeyToAccount(key).address.toLowerCase() === wallet.toLowerCase();
}

function issuerWalletClient() {
  const key = getPoidhIssuerPrivateKey();
  if (!key) {
    throw new Error('POIDH_ISSUER_PRIVATE_KEY not configured');
  }
  const account = privateKeyToAccount(key);
  const configured = process.env.POIDH_ISSUER_WALLET?.trim();
  if (configured) {
    const expected = normalizeAddr(configured).toLowerCase();
    if (account.address.toLowerCase() !== expected) {
      throw new Error('POIDH_ISSUER_WALLET does not match POIDH_ISSUER_PRIVATE_KEY');
    }
  }
  return createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  });
}

async function readMinBountyAmount(): Promise<bigint> {
  try {
    return await poidhPublicClient.readContract({
      address: POIDH_V3_BASE,
      abi: poidhV3Abi,
      functionName: 'MIN_BOUNTY_AMOUNT',
    });
  } catch {
    return parseEther(DEFAULT_SEED_ETH);
  }
}

async function readBountyRow(id: number) {
  try {
    return await poidhPublicClient.readContract({
      address: POIDH_V3_BASE,
      abi: poidhV3Abi,
      functionName: 'bounties',
      args: [BigInt(id)],
    });
  } catch {
    return null;
  }
}

async function resolveBountyIdAfterCreate(
  txHash: `0x${string}`,
  issuer: Address
): Promise<number> {
  const receipt = await poidhPublicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  if (receipt.status === 'reverted') {
    throw new Error('POIDH createOpenBounty transaction reverted on-chain');
  }

  const counter = Number(
    await poidhPublicClient.readContract({
      address: POIDH_V3_BASE,
      abi: poidhV3Abi,
      functionName: 'bountyCounter',
    })
  );

  for (let id = counter - 1; id >= Math.max(1, counter - 5); id -= 1) {
    const row = await readBountyRow(id);
    if (!row) continue;
    if (String(row[1]).toLowerCase() === issuer.toLowerCase()) {
      return id;
    }
  }

  throw new Error('Could not resolve POIDH bounty id from transaction');
}

export async function poidhIssuerCreateOpenBounty(options: {
  name: string;
  description: string;
  seedEth?: string;
}): Promise<{ bountyId: number; txHash: `0x${string}`; issuer: Address }> {
  const wallet = issuerWalletClient();
  const issuer = wallet.account!.address;
  const value = parseEther(options.seedEth?.trim() || DEFAULT_SEED_ETH);
  const min = await readMinBountyAmount();
  if (value < min) {
    throw new Error(`Seed amount below POIDH minimum (${min} wei)`);
  }

  const hash = await wallet.writeContract({
    chain: base,
    address: POIDH_V3_BASE,
    abi: poidhV3Abi,
    functionName: 'createOpenBounty',
    args: [options.name.slice(0, 120), options.description.slice(0, 8000)],
    value,
  });

  const bountyId = await resolveBountyIdAfterCreate(hash, issuer);
  return { bountyId, txHash: hash, issuer };
}

export async function poidhIssuerSubmitClaimForVote(options: {
  bountyId: number;
  claimId: number;
}): Promise<{ txHash: `0x${string}` }> {
  const wallet = issuerWalletClient();
  const hash = await wallet.writeContract({
    chain: base,
    address: POIDH_V3_BASE,
    abi: poidhV3Abi,
    functionName: 'submitClaimForVote',
    args: [BigInt(options.bountyId), BigInt(options.claimId)],
  });
  await poidhPublicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  return { txHash: hash };
}

export async function readPoidhIssuerBalanceEth(): Promise<string | null> {
  const wallet = getPoidhIssuerWallet();
  if (!wallet) return null;
  const wei = await poidhPublicClient.getBalance({ address: wallet });
  return `${Number(wei) / 1e18}`;
}
