import { NextResponse } from 'next/server';
import { executeReadyAgentPoolGoals } from '@/lib/agent-pool-execute';
import { verifyAllAgentPools } from '@/lib/agent-pool-verify';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Deterministic Lane B executor — funded agent pool goals → Bankr Agent API → 0xWork/QRCoin.
 * Does not rely on Aeon LLM. Vercel cron every 10 min.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const execute = await executeReadyAgentPoolGoals();
    const verify = await verifyAllAgentPools();

    return NextResponse.json({
      ok: true,
      execute,
      verify,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron agent-pool-worker', err);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
