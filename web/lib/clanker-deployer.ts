import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { normalizeAddr } from './utils';

const clankerTokenAbi = [
  {
    inputs: [],
    name: 'deployer',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

/** Old Clanker/Farcaster tokens expose deployer() — default fee beneficiary per Bankr docs. */
export async function readClankerDeployer(tokenAddress: string): Promise<string | null> {
  try {
    const addr = normalizeAddr(tokenAddress) as `0x${string}`;
    const deployer = await baseClient.readContract({
      address: addr,
      abi: clankerTokenAbi,
      functionName: 'deployer',
    });
    return deployer ? normalizeAddr(deployer) : null;
  } catch {
    return null;
  }
}
