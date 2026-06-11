import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
import { fetchOxWorkTasksForSpace } from '@/lib/oxwork-api';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const feeRecipientWallet =
      (await getTokenBeneficiaryWallet(tokenAddress)) || community.ownerWallet;
    const platformWallet = getPlatformAgentWallet();
    const posterWallets = [feeRecipientWallet, platformWallet].filter(Boolean) as string[];

    if (posterWallets.length === 0) {
      return NextResponse.json({ tasks: [], total: 0, symbol: community.symbol });
    }

    const data = await fetchOxWorkTasksForSpace({
      posterWallets,
      symbol: community.symbol,
      tokenAddress,
    });

    return NextResponse.json({
      ...data,
      platformAgentSkills: !!community.platformAgentSkills,
      usePlatformAgent: !!community.usePlatformAgent,
      links: {
        oxwork: 'https://0xwork.org',
        manifest: 'https://api.0xwork.org/manifest.json',
      },
    });
  } catch (err) {
    console.error('GET oxwork', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
