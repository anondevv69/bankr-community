import { NextResponse } from 'next/server';
import { getCommunity, getCommunities, getLaunches, setCommunities } from '@/lib/db';
import { fetchLaunchByAddress } from '@/lib/bankr-api';
import { isTokenBeneficiary } from '@/lib/community-owner';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';
import { communityUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    let launch = (await getLaunches()).find(
      (l) => l.tokenAddress?.toLowerCase() === tokenAddress
    );
    if (!launch) {
      launch = (await fetchLaunchByAddress(tokenAddress)) || undefined;
    }
    if (!launch) {
      return NextResponse.json({ error: 'Token not found in Bankr launches' }, { status: 400 });
    }

    if (!(await isTokenBeneficiary(wallet, tokenAddress))) {
      return NextResponse.json(
        { error: 'Only the token fee beneficiary can verify this community' },
        { status: 403 }
      );
    }

    const communities = await getCommunities();
    const community = communities.find(
      (c) => c.tokenAddress.toLowerCase() === tokenAddress
    );
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }
    if (community.verified) {
      return NextResponse.json({ error: 'Community is already verified' }, { status: 400 });
    }

    community.verified = true;
    community.verifiedAt = Date.now();
    community.verifiedBy = wallet;
    await setCommunities(communities);

    return NextResponse.json({
      success: true,
      community,
      links: { communityPage: communityUrl(tokenAddress) },
    });
  } catch (err) {
    console.error('POST verify', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
