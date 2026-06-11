import { NextResponse } from 'next/server';
import { getCommunities, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { resolveSpacePermissions } from '@/lib/community-owner';
import { createCommunityPoidhBounty } from '@/lib/poidh-community-bounties';
import { spinUpPoidhBountiesForCommunity } from '@/lib/poidh-bounty-spinup';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteParams = { params: Promise<{ address: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const wallet = req.headers.get('x-wallet-address')?.trim().toLowerCase();

  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'x-wallet-address header required' }, { status: 401 });
  }

  let body: { title?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  if (!title || title.length < 4) {
    return NextResponse.json({ error: 'title required (min 4 chars)' }, { status: 400 });
  }
  if (!description || description.length < 10) {
    return NextResponse.json({ error: 'description required (min 10 chars)' }, { status: 400 });
  }

  try {
    const permissions = await resolveSpacePermissions(wallet, tokenAddress);
    if (!permissions.canPost) {
      return NextResponse.json(
        { error: 'Hold this token to create bounties for this space.' },
        { status: 403 }
      );
    }

    const communities = await getCommunities();
    const index = communities.findIndex(
      (c) => c.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const current = mergeCommunityDefaults(communities[index]);
    const state = current.poidhBounties!;
    const bounty = createCommunityPoidhBounty({
      title,
      description,
      symbol: current.symbol,
      tokenAddress: current.tokenAddress,
      requestedBy: wallet,
    });

    const saved = mergeCommunityDefaults({
      ...current,
      poidhBounties: {
        ...state,
        bounties: [...state.bounties, bounty],
        spinUpAt: Date.now(),
      },
    });
    communities[index] = saved;
    await setCommunities(communities);

    const spin = await spinUpPoidhBountiesForCommunity(saved, { maxBounties: 1 }).catch(
      (err) => ({
        status: 'failed',
        message: err instanceof Error ? err.message : String(err),
        linked: 0,
      })
    );

    return NextResponse.json({
      success: true,
      message:
        spin.status === 'live'
          ? 'Bounty is live on POIDH — add funds and share the task.'
          : spin.status === 'pending_job'
            ? 'Bounty queued — Bankr agent is opening it on POIDH now.'
            : 'Bounty saved — Bankr agent will open it on POIDH shortly.',
      bounty: {
        id: bounty.id,
        title: bounty.title,
        status: spin.status === 'live' ? 'live' : 'pending',
      },
      spinUp: spin,
    });
  } catch (err) {
    console.error('POST poidh/request', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
