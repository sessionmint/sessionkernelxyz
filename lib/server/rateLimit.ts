import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { APP_ID } from '@/lib/constants';
import { getServerEnv } from '@/lib/env/server';
import { getFirestoreDb } from '@/lib/server/firebaseAdmin';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const GLOBAL_RATE_LIMIT_KEY = '__sessionmint_rate_limit_map__';
let warnedAboutRateLimitFallback = false;

function getRateLimitMap(): Map<string, RateLimitEntry> {
  const globalScope = globalThis as unknown as Record<
    string,
    Map<string, RateLimitEntry> | undefined
  >;
  if (!globalScope[GLOBAL_RATE_LIMIT_KEY]) {
    globalScope[GLOBAL_RATE_LIMIT_KEY] = new Map<string, RateLimitEntry>();
  }
  return globalScope[GLOBAL_RATE_LIMIT_KEY] as Map<string, RateLimitEntry>;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimitedInMemory(
  key: string,
  resolvedMaxRequests: number,
  resolvedWindowMs: number,
  nowMs: number
): boolean {
  const map = getRateLimitMap();
  const current = map.get(key);

  if (!current) {
    map.set(key, { count: 1, windowStart: nowMs });
    return false;
  }

  if (nowMs - current.windowStart > resolvedWindowMs) {
    map.set(key, { count: 1, windowStart: nowMs });
    return false;
  }

  current.count += 1;
  map.set(key, current);
  return current.count > resolvedMaxRequests;
}

function createRateLimitDocId(
  key: string,
  resolvedMaxRequests: number,
  resolvedWindowMs: number
): string {
  return createHash('sha256')
    .update(`${APP_ID}:${key}:${resolvedMaxRequests}:${resolvedWindowMs}`)
    .digest('hex');
}

async function isRateLimitedInFirestore(
  key: string,
  resolvedMaxRequests: number,
  resolvedWindowMs: number,
  nowMs: number
): Promise<boolean> {
  const db = getFirestoreDb();
  const docId = createRateLimitDocId(key, resolvedMaxRequests, resolvedWindowMs);
  const docRef = db
    .collection('sessions')
    .doc(APP_ID)
    .collection('rateLimits')
    .doc(docId);

  return db.runTransaction<boolean>(async (tx) => {
    const snap = await tx.get(docRef);
    let count = 1;
    let windowStart = nowMs;

    if (snap.exists) {
      const data = snap.data() as RateLimitEntry | undefined;
      if (
        data &&
        typeof data.windowStart === 'number' &&
        nowMs - data.windowStart <= resolvedWindowMs
      ) {
        count = (typeof data.count === 'number' ? data.count : 0) + 1;
        windowStart = data.windowStart;
      }
    }

    tx.set(
      docRef,
      {
        key,
        count,
        windowStart,
        updatedAt: nowMs,
      },
      { merge: true }
    );

    return count > resolvedMaxRequests;
  });
}

export async function isRateLimited(
  request: NextRequest,
  scope: string,
  maxRequests?: number,
  windowMs?: number
): Promise<boolean> {
  const env = getServerEnv();
  const resolvedMaxRequests = maxRequests ?? env.rateLimitMaxRequests;
  const resolvedWindowMs = windowMs ?? env.rateLimitWindowMs;
  const ip = getClientIp(request);
  const key = `${scope}:${ip}`;
  const nowMs = Date.now();

  try {
    return await isRateLimitedInFirestore(
      key,
      resolvedMaxRequests,
      resolvedWindowMs,
      nowMs
    );
  } catch (error) {
    if (!warnedAboutRateLimitFallback) {
      warnedAboutRateLimitFallback = true;
      console.warn(
        `[rate-limit] Firestore limiter unavailable, falling back to in-memory limiter: ${
          (error as Error).message
        }`
      );
    }

    return isRateLimitedInMemory(
      key,
      resolvedMaxRequests,
      resolvedWindowMs,
      nowMs
    );
  }
}
