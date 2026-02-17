import { NextRequest, NextResponse } from 'next/server';
import { getTokenCooldownStatus } from '@/lib/server/stateStore';
import { isRateLimited } from '@/lib/server/rateLimit';
import { isValidSolanaAddress } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CheckCooldownPayload {
  tokenMint?: string;
}

export async function POST(request: NextRequest) {
  if (await isRateLimited(request, 'queue-check-cooldown', 120)) {
    return NextResponse.json(
      { ok: false, tokenValid: true, inCooldown: true, message: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  let payload: CheckCooldownPayload;
  try {
    payload = (await request.json()) as CheckCooldownPayload;
  } catch {
    return NextResponse.json(
      { ok: false, tokenValid: false, inCooldown: false, message: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!isValidSolanaAddress(payload.tokenMint)) {
    return NextResponse.json(
      {
        ok: false,
        tokenValid: false,
        inCooldown: false,
        message: 'Invalid token mint address',
      },
      { status: 400 }
    );
  }

  const status = await getTokenCooldownStatus(payload.tokenMint.trim());
  return NextResponse.json(
    {
      ok: true,
      tokenValid: true,
      ...status,
    },
    {
    headers: {
      'Cache-Control': 'no-store',
    },
    }
  );
}
