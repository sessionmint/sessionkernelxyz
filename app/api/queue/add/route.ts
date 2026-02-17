import { NextRequest, NextResponse } from 'next/server';
import { enqueueVerifiedToken, QueueStoreError } from '@/lib/server/stateStore';
import { isRateLimited } from '@/lib/server/rateLimit';
import {
  isValidSolanaAddress,
  isValidTransactionSignature,
  parsePositiveNumber,
} from '@/lib/server/validation';
import {
  PaymentVerificationError,
  verifyPaymentOnChain,
} from '@/lib/server/payments/verify';
import { scheduleStateTickTask } from '@/lib/server/tasks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PaymentMethod = 'SOL' | 'MINSTR';
type PaymentTier = 'standard' | 'priority';

interface QueueAddPayload {
  tokenMint?: string;
  walletAddress?: string;
  amount?: number;
  signature?: string;
  paymentMethod?: PaymentMethod;
  paymentTier?: PaymentTier;
}

function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'SOL' || value === 'MINSTR';
}

function isValidPaymentTier(value: unknown): value is PaymentTier {
  return value === 'standard' || value === 'priority';
}

function errorStatus(error: Error): number {
  if (error instanceof QueueStoreError) {
    if (error.code === 'REPLAY') return 409;
    if (error.code === 'COOLDOWN') return 409;
    if (error.code === 'INVALID_TIER') return 400;
    return 500;
  }

  if (error instanceof PaymentVerificationError) {
    switch (error.code) {
      case 'TX_NOT_FOUND':
      case 'TX_FAILED':
      case 'RECIPIENT_MISMATCH':
      case 'AMOUNT_MISMATCH':
      case 'MINT_MISMATCH':
      case 'SIGNER_MISMATCH':
        return 400;
      case 'RPC_UNAVAILABLE':
        return 503;
      default:
        return 400;
    }
  }

  return 500;
}

export async function POST(request: NextRequest) {
  if (await isRateLimited(request, 'queue-add', 20)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let payload: QueueAddPayload;
  try {
    payload = (await request.json()) as QueueAddPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!isValidSolanaAddress(payload.tokenMint)) {
    return NextResponse.json({ error: 'Invalid token mint address' }, { status: 400 });
  }

  if (!isValidSolanaAddress(payload.walletAddress)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  if (!isValidPaymentMethod(payload.paymentMethod)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
  }

  if (!isValidPaymentTier(payload.paymentTier)) {
    return NextResponse.json({ error: 'Invalid payment tier' }, { status: 400 });
  }

  if (!isValidTransactionSignature(payload.signature)) {
    return NextResponse.json(
      { error: 'Invalid transaction signature format' },
      { status: 400 }
    );
  }

  if (payload.amount !== undefined) {
    const parsedAmount = parsePositiveNumber(payload.amount);
    if (!parsedAmount) {
      return NextResponse.json(
        { error: 'Amount must be a positive number when provided' },
        { status: 400 }
      );
    }
  }

  const tokenMint = payload.tokenMint.trim();
  const walletAddress = payload.walletAddress.trim();
  const paymentTier = payload.paymentTier;
  const signature = payload.signature.trim();

  try {
    const verification = await verifyPaymentOnChain({
      signature,
      walletAddress,
      paymentMethod: payload.paymentMethod,
      paymentTier,
    });

    const enqueueResult = await enqueueVerifiedToken({
      tokenMint,
      walletAddress,
      tier: paymentTier,
      signature,
      paymentMethod: payload.paymentMethod,
      paymentTier,
      verifiedAmount: verification.verifiedAmount,
    });

    let tickScheduled = false;
    if (enqueueResult.activatedItem?.expiresAt) {
      tickScheduled = await scheduleStateTickTask({
        executeAtMs: enqueueResult.activatedItem.expiresAt,
        origin: request.nextUrl.origin,
        reason: 'cloud-task',
      });
    }

    return NextResponse.json({
      success: true,
      item: enqueueResult.item,
      verifiedAmount: verification.verifiedAmount,
      activated: Boolean(enqueueResult.activatedItem),
      tickScheduled,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to queue token' },
      { status: errorStatus(error as Error) }
    );
  }
}
