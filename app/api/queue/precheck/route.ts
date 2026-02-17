import { NextRequest, NextResponse } from 'next/server';
import { getTokenCooldownStatus } from '@/lib/server/stateStore';
import { isRateLimited } from '@/lib/server/rateLimit';
import { isValidSolanaAddress } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PaymentTier = 'standard' | 'priority';

interface PrecheckPayload {
  tokenMint?: string;
  paymentTier?: PaymentTier;
}

function isValidPaymentTier(value: unknown): value is PaymentTier {
  return value === 'standard' || value === 'priority';
}

export async function POST(request: NextRequest) {
  if (await isRateLimited(request, 'queue-precheck', 120)) {
    return NextResponse.json(
      {
        ok: false,
        tokenValid: true,
        inCooldown: true,
        allowStandard: false,
        allowPriority: true,
        reason: 'Rate limit exceeded',
      },
      { status: 429 }
    );
  }

  let payload: PrecheckPayload;
  try {
    payload = (await request.json()) as PrecheckPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        tokenValid: false,
        inCooldown: false,
        allowStandard: false,
        allowPriority: false,
        reason: 'Invalid request body',
      },
      { status: 400 }
    );
  }

  if (!isValidSolanaAddress(payload.tokenMint)) {
    return NextResponse.json(
      {
        ok: false,
        tokenValid: false,
        inCooldown: false,
        allowStandard: false,
        allowPriority: false,
        reason: 'Invalid token mint address',
      },
      { status: 400 }
    );
  }

  if (payload.paymentTier !== undefined && !isValidPaymentTier(payload.paymentTier)) {
    return NextResponse.json(
      {
        ok: false,
        tokenValid: true,
        inCooldown: false,
        allowStandard: false,
        allowPriority: false,
        reason: 'Invalid payment tier',
      },
      { status: 400 }
    );
  }

  const cooldown = await getTokenCooldownStatus(payload.tokenMint.trim());
  const allowStandard = !cooldown.inCooldown;
  const allowPriority = true;
  const requestedTier = payload.paymentTier;
  const tierAllowed =
    requestedTier === 'standard'
      ? allowStandard
      : requestedTier === 'priority'
        ? allowPriority
        : allowStandard || allowPriority;

  return NextResponse.json({
    ok: tierAllowed,
    tokenValid: true,
    inCooldown: cooldown.inCooldown,
    allowStandard,
    allowPriority,
    reason: tierAllowed ? undefined : cooldown.message || 'Token is in cooldown',
  });
}
