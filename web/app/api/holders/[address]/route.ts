import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { checkParticipation } from '@/lib/participation';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json(
      { holds: false, balance: 0, canPost: false, error: 'wallet required' },
      { status: 400 }
    );
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    const chain = community?.chain || 'base';
    const result = await checkParticipation(wallet.toLowerCase(), tokenAddress, chain);
    return NextResponse.json({
      ...result,
      wallet: wallet.toLowerCase(),
      chain,
    });
  } catch (err) {
    console.error('GET holder', err);
    return NextResponse.json(
      { holds: false, balance: 0, canPost: false, error: 'Status check failed' },
      { status: 500 }
    );
  }
}
