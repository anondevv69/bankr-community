import { NextResponse } from 'next/server';
import { settleExpiredQuestions } from '@/lib/community-questions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await settleExpiredQuestions();
    return NextResponse.json({
      ok: true,
      ...result,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron settle-questions', err);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
