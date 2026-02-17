import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import { advanceState } from '@/lib/server/stateStore';
import { scheduleStateTickTask } from '@/lib/server/tasks';
import { TickReason } from '@/lib/server/stateTypes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TickPayload {
  reason?: TickReason;
}

function isValidReason(value: unknown): value is TickReason {
  return value === 'cloud-task' || value === 'scheduler' || value === 'manual';
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const cronSecret = request.headers.get('x-cron-secret');

  if (!env.cronSecret || cronSecret !== env.cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: TickPayload = {};
  try {
    payload = (await request.json()) as TickPayload;
  } catch {
    // Allow empty body for scheduler/task callers.
  }

  const reason: TickReason = isValidReason(payload.reason)
    ? payload.reason
    : 'manual';
  const result = await advanceState(reason);

  let tickScheduled = false;
  if (result.activatedItem?.expiresAt) {
    tickScheduled = await scheduleStateTickTask({
      executeAtMs: result.activatedItem.expiresAt,
      origin: request.nextUrl.origin,
      reason: 'cloud-task',
    });
  }

  return NextResponse.json({
    success: true,
    result,
    tickScheduled,
  });
}
