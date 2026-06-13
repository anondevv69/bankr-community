import { NextResponse } from 'next/server';
import {
  getCommunity,
  getCommunities,
  getPosts,
  getLaunches,
  getSyncUpdatedAt,
} from '@/lib/db';
import { fetchLaunchByAddress } from '@/lib/bankr-api';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  campaignProgress,
  completedCampaigns,
  openCampaigns,
} from '@/lib/fundraising';
import { communityUrl, getSiteUrl, communityUrlTemplate } from '@/lib/site-url';
import { buildBriefingReplyText } from '@/lib/agent-reply';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
import { buildFundraisingX402BaseUrl } from '@/lib/x402-fund-url';
import {
  matchedAgentPoolCampaigns,
  openAgentPoolCampaigns,
  readStoredAgentPool,
} from '@/lib/agent-pool';
import { bountyDescriptionForDisplay } from '@/lib/poidh-community-bounties';
import { poidhBountyUrl } from '@/lib/poidh-api';
import {
  getQuestions,
  questionVoteCounts,
  settleExpiredQuestions,
} from '@/lib/community-questions';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token')?.toLowerCase();
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const query = searchParams.get('q')?.trim();

  try {
    const [communities, syncAt, launches] = await Promise.all([
      getCommunities(),
      getSyncUpdatedAt(),
      getLaunches(),
    ]);

    let community = token
      ? communities.find((c) => c.tokenAddress.toLowerCase() === token)
      : symbol
        ? communities.find((c) => c.symbol.toUpperCase() === symbol)
        : query
          ? communities.find(
              (c) =>
                c.symbol.toLowerCase().includes(query.toLowerCase()) ||
                c.name.toLowerCase().includes(query.toLowerCase()) ||
                c.tokenAddress.toLowerCase().includes(query.toLowerCase())
            )
          : null;

    let launch = token
      ? launches.find((l) => l.tokenAddress?.toLowerCase() === token)
      : null;

    if (!launch && community) {
      launch =
        launches.find(
          (l) => l.tokenAddress?.toLowerCase() === community!.tokenAddress.toLowerCase()
        ) || null;
    }

    if (!community && token) {
      launch = launch || (await fetchLaunchByAddress(token));
    }

    const posts = community ? await getPosts(community.tokenAddress) : [];
    const recentPosts = posts.slice(-5).reverse();

    await settleExpiredQuestions();
    const spaceQuestions = community ? await getQuestions(community.tokenAddress) : [];
    const activeVote = spaceQuestions.find(
      (q) => q.status === 'active' && q.endsAt > Date.now()
    );
    const recentVotes = spaceQuestions
      .filter((q) => q.status === 'settled')
      .slice(0, 3)
      .map((q) => {
        const tallies = questionVoteCounts(q);
        const winner = q.options.find((o) => o.id === q.winningOptionId);
        return {
          id: q.id,
          prompt: q.prompt.slice(0, 200),
          voteType: q.voteType || (q.options.length === 2 ? 'yes_no' : 'choice'),
          settledAt: q.settledAt,
          winningOption: winner?.label || null,
          totalVotes: tallies.totalVotes,
          tallies: tallies.counts,
        };
      });

    const normalizedCommunity = community ? mergeCommunityDefaults(community) : null;
    const openFundraisers = normalizedCommunity
      ? openCampaigns(normalizedCommunity.fundraising)
      : [];
    const completedFundraisers = normalizedCommunity
      ? completedCampaigns(normalizedCommunity.fundraising)
      : [];
    const beneficiaryWallet = community
      ? await getTokenBeneficiaryWallet(community.tokenAddress)
      : null;
    const x402FundUrl = buildFundraisingX402BaseUrl(beneficiaryWallet);
    const agentPool = normalizedCommunity
      ? readStoredAgentPool(normalizedCommunity.agentPool)
      : null;
    const agentPoolOpen = agentPool ? openAgentPoolCampaigns(agentPool) : [];
    const agentPoolReady = agentPool ? matchedAgentPoolCampaigns(agentPool) : [];

    const opportunities: Array<{ type: string; message: string }> = [];

    if (!community && launch) {
      opportunities.push({
        type: 'create_community',
        message: `No space for ${launch.tokenSymbol} yet — anyone can start one at the site.`,
      });
    }

    if (community && !community.verified) {
      opportunities.push({
        type: 'verify_pending',
        message: `Space for $${community.symbol} is unverified — fee recipient can verify; deployer can edit until then.`,
      });
    }

    if (community && community.postCount === 0) {
      opportunities.push({
        type: 'first_post',
        message: `No posts yet in $${community.symbol} space — holders can be first.`,
      });
    }

    for (const campaign of openFundraisers) {
      const remaining = Math.max(
        0,
        Math.round((campaign.goalUsd - campaign.raisedUsd) * 100) / 100
      );
      opportunities.push({
        type: 'fundraising_open',
        message: `$${community!.symbol} space — ${campaign.label}: $${campaign.raisedUsd}/$${campaign.goalUsd} raised ($${remaining} remaining). Contribute USDC on bankr.space.`,
      });
    }

    const poidhState = normalizedCommunity?.poidhBounties;
    const poidhBountyList =
      poidhState?.enabled && poidhState.bounties.length
        ? poidhState.bounties.map((b) => ({
            id: b.id,
            title: b.title,
            description: bountyDescriptionForDisplay(b.description).slice(0, 280),
            status: b.poidhBountyId != null ? 'live' : 'pending',
            poidhBountyId: b.poidhBountyId,
            url: b.poidhBountyId != null ? poidhBountyUrl(b.poidhBountyId) : null,
          }))
        : [];

    for (const b of poidhBountyList.filter((row) => row.status === 'live')) {
      opportunities.push({
        type: 'poidh_bounty_live',
        message: `$${community!.symbol} open bounty: ${b.title} — ${b.url ?? 'see Bounties tab'}. Fund and claim on POIDH.`,
      });
    }

    if (activeVote && community) {
      const tallies = questionVoteCounts(activeVote);
      opportunities.push({
        type: 'holder_vote_active',
        message: `$${community.symbol} — active holder vote: "${activeVote.prompt.slice(0, 100)}" — ${tallies.totalVotes} votes so far. Holders vote on Votes tab; settles in 24h.`,
      });
    }

    const siteUrl = getSiteUrl();
    const pageLink = community ? communityUrl(community.tokenAddress) : null;
    const replyText = community ? buildBriefingReplyText(community, recentPosts) : null;

    if (searchParams.get('format') === 'text') {
      if (!replyText) {
        return new NextResponse('Space not found', { status: 404 });
      }
      return new NextResponse(replyText, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      ok: true,
      siteUrl,
      communityLink: pageLink,
      linkReply: pageLink,
      replyText,
      tweetReply: replyText,
      linkOnlyReply: pageLink,
      communityUrlTemplate: communityUrlTemplate(),
      forbiddenLinks: ['https://bankr.bot', 'bankr.bot'],
      instruction:
        'Paste replyText verbatim as the tweet. Final line MUST be communityLink (https URL on its own line). Do not summarize without the URL.',
      syncedAt: syncAt,
      totalCommunities: communities.length,
      community: community || null,
      launch: launch || null,
      stats: community
        ? {
            postCount: community.postCount,
            memberCount: community.memberCount,
            verified: community.verified,
            chain: community.chain,
          }
        : null,
      recentPosts: recentPosts.map((p) => ({
        id: p.id,
        content: p.content.slice(0, 280),
        wallet: p.wallet,
        author: p.author,
        timestamp: p.timestamp,
        reactions: p.reactions,
      })),
      opportunities,
      fundraising: community
        ? {
            open: openFundraisers.map((c) => ({
              id: c.id,
              label: c.label,
              goalUsd: c.goalUsd,
              raisedUsd: c.raisedUsd,
              remainingUsd: Math.max(
                0,
                Math.round((c.goalUsd - c.raisedUsd) * 100) / 100
              ),
              progressPct: campaignProgress(c),
            })),
            completed: completedFundraisers.map((c) => ({
              id: c.id,
              label: c.label,
              goalUsd: c.goalUsd,
              raisedUsd: c.raisedUsd,
            })),
            x402FundUrl,
            contributeNote:
              'Open campaigns accept $1 USDC per x402 click on the space page (bankr.space). Agents cannot pay via HTTP alone — wallet signature required.',
          }
        : null,
      agentPool: normalizedCommunity?.usePlatformAgent
        ? {
            open: agentPoolOpen.map((c) => ({
              skillId: c.skillId,
              label: c.label,
              goalUsd: c.goalUsd,
              raisedUsd: c.raisedUsd,
              ...(c.skillId === '0xwork' || c.skillId === 'poidh'
                ? c.workBrief
                  ? { workBrief: c.workBrief }
                  : {}
                : {}),
            })),
            readyForExecution: agentPoolReady.map((c) => ({
              skillId: c.skillId,
              label: c.label,
              goalUsd: c.goalUsd,
              raisedUsd: c.raisedUsd,
              ...(c.skillId === '0xwork' || c.skillId === 'poidh'
                ? { workBrief: c.workBrief || null }
                : {}),
            })),
            workBriefFormat:
              'One line per task: description — $bounty — Category (Social|Creative|Writing). Replace $SYMBOL with token symbol; include https://bankr.space/community/{token} in descriptions when relevant.',
          }
        : null,
      poidhBounties:
        poidhState?.enabled && poidhBountyList.length
          ? {
              bounties: poidhBountyList,
              createBounty:
                'POST /api/communities/{token}/poidh/request header x-wallet-address — token holder; seeds 0.001 ETH on Base',
              humanUi:
                'Bounties tab — status + create. Fund, claim, vote on poidh.xyz (each bounty has url).',
              agentNote:
                'Agents create via POST …/poidh/request and list via GET …/poidh. For fund/claim/vote reply with bounty url. See POIDH-BOUNTIES.md',
            }
          : null,
      holderVotes: community
        ? {
            active: activeVote
              ? {
                  id: activeVote.id,
                  prompt: activeVote.prompt,
                  voteType: activeVote.voteType || 'yes_no',
                  endsAt: activeVote.endsAt,
                  options: activeVote.options.map((o) => ({ id: o.id, label: o.label })),
                  tallies: questionVoteCounts(activeVote),
                }
              : null,
            recent: recentVotes,
            listVotes: `GET /api/communities/${community.tokenAddress}/questions`,
            startVote:
              'POST /api/agent/start-vote header x-wallet-address — body: { prompt, symbol?, token?, voteType?, durationHours? } — preferred for agents',
            startVoteDirect:
              'POST /api/communities/{token}/questions header x-wallet-address — body: { prompt, voteType: yes_no|choice, options?, durationHours? (1–24, default 24) }',
            spaceTokenAddress: '0xef703b860a6d422fa00cc67bbbb2662297cb6ba3',
            castVote:
              'POST /api/questions/{questionId}/vote header x-wallet-address — body: { tokenAddress, optionId }',
            closeVote:
              'POST /api/questions/{questionId}/vote header x-wallet-address — body: { tokenAddress, action: "close" } — admin only',
            humanUi: 'Votes tab on space page',
            agentNote:
              'Verified space admin starts/closes votes (canCreateQuestion). Holders vote (canVoteOnQuestion); petition spaces = fee-right unit holders only, weighted by units. Use POST /api/agent/start-vote with symbol Space for native token. See HOLDER-VOTES.md',
          }
        : null,
      links: {
        communityPage: pageLink,
        allCommunities: siteUrl,
        agentGuide: `${siteUrl}/agent.md`,
      },
      agentActions: {
        briefing: 'GET /api/agent/briefing?token=0x… or ?symbol=TMP',
        searchTokens: 'GET /api/tokens/search?q=',
        listCommunities: 'GET /api/communities',
        createCommunity: 'POST /api/communities/{token} header x-wallet-address',
        post: 'POST /api/communities/{token}/posts header x-wallet-address',
        verify: 'POST /api/communities/{token}/verify header x-wallet-address',
        checkHolder: 'GET /api/holders/{token}?wallet=0x…',
        react: 'POST /api/posts/{postId}/react header x-wallet-address',
        fundraising: 'GET /api/communities/{token}/fundraising',
        poidhList: 'GET /api/communities/{token}/poidh',
        poidhCreate:
          'POST /api/communities/{token}/poidh/request header x-wallet-address — holder creates open bounty (ETH on Base)',
        listVotes: 'GET /api/communities/{token}/questions',
        startVote:
          'POST /api/agent/start-vote header x-wallet-address — body: { prompt, symbol?, token?, voteType?, durationHours? }',
        startVoteDirect:
          'POST /api/communities/{token}/questions header x-wallet-address — verified admin',
        castVote:
          'POST /api/questions/{questionId}/vote header x-wallet-address — holders only',
        closeVote:
          'POST /api/questions/{questionId}/vote header x-wallet-address — action close; admin only',
      },
    });
  } catch (err) {
    console.error('GET /api/agent/briefing', err);
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 503 });
  }
}
