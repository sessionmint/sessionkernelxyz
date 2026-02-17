import { NextResponse } from 'next/server';
import { getAppStateSnapshot } from '@/lib/server/stateStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const snapshot = await getAppStateSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
