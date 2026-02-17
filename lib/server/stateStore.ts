import { randomUUID } from 'crypto';
import { DocumentReference, Timestamp, Transaction } from 'firebase-admin/firestore';
import {
  APP_ID,
  DEFAULT_TOKEN_MINT,
  DISPLAY_DURATION_PRIORITY,
  DISPLAY_DURATION_STANDARD,
  DUPLICATE_COOLDOWN_MS,
  PRIORITY_LEVELS,
} from '@/lib/constants';
import { AppStateSnapshot, DeviceStateSnapshot } from '@/lib/state';
import { getFirestoreDb } from '@/lib/server/firebaseAdmin';
import { CooldownDoc, QueueItemDoc, ReceiptDoc, TickReason, TickResult } from '@/lib/server/stateTypes';

type Tier = 'standard' | 'priority';
type PaymentMethod = 'SOL' | 'MINSTR';
type PaymentTier = 'standard' | 'priority';

interface CooldownStatus {
  inCooldown: boolean;
  message?: string;
  cooldownEndsAt?: number;
}

interface QueueInsertInput {
  tokenMint: string;
  walletAddress: string;
  tier: Tier;
  signature: string;
  paymentMethod: PaymentMethod;
  paymentTier: PaymentTier;
  verifiedAmount: string;
}

export interface AppStateSnapshotWithRevision {
  snapshot: AppStateSnapshot;
  revision: number;
  updatedAt: number;
}

export interface EnqueueResult {
  item: QueueItemDoc;
  activatedItem: QueueItemDoc | null;
}

export class QueueStoreError extends Error {
  readonly code:
    | 'COOLDOWN'
    | 'REPLAY'
    | 'INVALID_TIER'
    | 'STATE_WRITE_FAILED'
    | 'UNKNOWN';

  constructor(
    code:
      | 'COOLDOWN'
      | 'REPLAY'
      | 'INVALID_TIER'
      | 'STATE_WRITE_FAILED'
      | 'UNKNOWN',
    message: string
  ) {
    super(message);
    this.name = 'QueueStoreError';
    this.code = code;
  }
}

function nowMs(): number {
  return Date.now();
}

function createWaitingDeviceState(): DeviceStateSnapshot {
  return {
    state: 'waiting',
    session: {
      mode: 'idle',
      speed: 0,
    },
  };
}

function createActiveDeviceState(item: QueueItemDoc): DeviceStateSnapshot {
  return {
    state: 'active',
    session: {
      mode: item.isPriority ? 'priority' : 'standard',
      speed: item.isPriority ? 85 : 60,
    },
  };
}

function createDefaultSessionDoc(timestamp: number) {
  return {
    appId: APP_ID,
    currentToken: DEFAULT_TOKEN_MINT,
    currentItem: null,
    device: createWaitingDeviceState(),
    revision: 0,
    updatedAt: timestamp,
  };
}

function toMillis(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return fallback;
}

function asDeviceState(value: unknown): DeviceStateSnapshot {
  if (!value || typeof value !== 'object') {
    return createWaitingDeviceState();
  }

  const state = (value as DeviceStateSnapshot).state;
  if (state !== 'active' && state !== 'waiting' && state !== 'cooldown' && state !== 'error') {
    return createWaitingDeviceState();
  }

  return value as DeviceStateSnapshot;
}

function sortQueuedItems(items: QueueItemDoc[]): QueueItemDoc[] {
  return items.sort((a, b) => {
    if (a.priorityLevel !== b.priorityLevel) {
      return b.priorityLevel - a.priorityLevel;
    }
    return a.createdAt - b.createdAt;
  });
}

function createQueueItem(input: {
  tokenMint: string;
  walletAddress: string;
  tier: Tier;
  createdAt: number;
}): QueueItemDoc {
  const displayDuration =
    input.tier === 'priority'
      ? DISPLAY_DURATION_PRIORITY
      : DISPLAY_DURATION_STANDARD;
  const priorityLevel =
    input.tier === 'priority'
      ? PRIORITY_LEVELS.PRIORITY
      : PRIORITY_LEVELS.STANDARD;

  return {
    id: randomUUID(),
    tokenMint: input.tokenMint,
    walletAddress: input.walletAddress,
    priorityLevel,
    displayDuration,
    expiresAt: input.createdAt + displayDuration,
    isPriority: input.tier === 'priority',
    createdAt: input.createdAt,
    status: 'queued',
    startsAt: null,
  };
}

function normalizeQueueDoc(id: string, data: Record<string, unknown>): QueueItemDoc {
  return {
    id,
    tokenMint: String(data.tokenMint || ''),
    walletAddress: String(data.walletAddress || ''),
    priorityLevel:
      typeof data.priorityLevel === 'number'
        ? data.priorityLevel
        : PRIORITY_LEVELS.STANDARD,
    displayDuration:
      typeof data.displayDuration === 'number'
        ? data.displayDuration
        : DISPLAY_DURATION_STANDARD,
    expiresAt: toMillis(data.expiresAt),
    isPriority: Boolean(data.isPriority),
    createdAt: toMillis(data.createdAt),
    status: (data.status as QueueItemDoc['status']) || 'queued',
    startsAt: data.startsAt === null ? null : toMillis(data.startsAt),
  };
}

function normalizeCurrentItem(value: unknown): QueueItemDoc | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const data = value as Record<string, unknown>;
  return normalizeQueueDoc(String(data.id || randomUUID()), data);
}

async function getSessionSnapshotData(): Promise<{
  session: {
    currentToken: string;
    currentItem: QueueItemDoc | null;
    device: DeviceStateSnapshot;
    revision: number;
    updatedAt: number;
  };
  queue: QueueItemDoc[];
}> {
  const db = getFirestoreDb();
  const sessionRef = db.collection('sessions').doc(APP_ID);
  const queueRef = sessionRef.collection('queue');

  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists) {
    const initial = createDefaultSessionDoc(nowMs());
    await sessionRef.set(initial, { merge: true });
  }

  const refreshedSessionDoc = await sessionRef.get();
  const timestamp = nowMs();
  const sessionData =
    (refreshedSessionDoc.data() as Record<string, unknown> | undefined) ||
    createDefaultSessionDoc(timestamp);

  const queuedSnapshot = await queueRef.where('status', '==', 'queued').get();
  const queuedItems = sortQueuedItems(
    queuedSnapshot.docs.map((doc) =>
      normalizeQueueDoc(doc.id, doc.data() as Record<string, unknown>)
    )
  );
  const currentItem = normalizeCurrentItem(sessionData.currentItem);

  return {
    session: {
      currentToken: String(sessionData.currentToken || DEFAULT_TOKEN_MINT),
      currentItem,
      device: asDeviceState(sessionData.device),
      revision:
        typeof sessionData.revision === 'number' ? sessionData.revision : 0,
      updatedAt: toMillis(sessionData.updatedAt, timestamp),
    },
    queue: queuedItems,
  };
}

function buildReceipt(input: QueueInsertInput, verifiedAt: number): ReceiptDoc {
  return {
    txSig: input.signature,
    tokenMint: input.tokenMint,
    walletAddress: input.walletAddress,
    paymentMethod: input.paymentMethod,
    paymentTier: input.paymentTier,
    amount: input.verifiedAmount,
    verifiedAt,
  };
}

function toSnapshot(
  session: {
    currentToken: string;
    currentItem: QueueItemDoc | null;
    device: DeviceStateSnapshot;
  },
  queue: QueueItemDoc[]
): AppStateSnapshot {
  return {
    currentToken: session.currentToken,
    currentItem: session.currentItem ? { ...session.currentItem } : null,
    queue: queue.map((item) => ({ ...item })),
    device: session.device ? { ...session.device } : null,
  };
}

function activeItemInCooldown(
  activeItem: QueueItemDoc | null,
  tokenMint: string,
  timestamp: number
): boolean {
  if (!activeItem) return false;
  if (activeItem.tokenMint !== tokenMint) return false;
  return activeItem.expiresAt > timestamp;
}

function tokenAlreadyQueued(queue: QueueItemDoc[], tokenMint: string): boolean {
  return queue.some((item) => item.tokenMint === tokenMint);
}

async function expireActiveItemIfNeeded(
  tx: Transaction,
  sessionRef: DocumentReference,
  activeItem: QueueItemDoc | null,
  timestamp: number
): Promise<{
  nextCurrentItem: QueueItemDoc | null;
  changed: boolean;
}> {
  if (!activeItem || activeItem.expiresAt > timestamp) {
    return { nextCurrentItem: activeItem, changed: false };
  }

  const queueRef = sessionRef.collection('queue').doc(activeItem.id);
  const cooldownRef = sessionRef.collection('cooldowns').doc(activeItem.tokenMint);
  const cooldownDoc: CooldownDoc = {
    tokenMint: activeItem.tokenMint,
    endsAt: timestamp + DUPLICATE_COOLDOWN_MS,
    updatedAt: timestamp,
  };

  tx.set(
    queueRef,
    {
      status: 'expired',
      updatedAt: timestamp,
      expiresAt: activeItem.expiresAt,
    },
    { merge: true }
  );
  tx.set(cooldownRef, cooldownDoc, { merge: true });

  return { nextCurrentItem: null, changed: true };
}

function activateQueueItem(item: QueueItemDoc, timestamp: number): QueueItemDoc {
  return {
    ...item,
    status: 'active',
    startsAt: timestamp,
    expiresAt: timestamp + item.displayDuration,
  };
}

export async function getAppStateSnapshot(): Promise<AppStateSnapshot> {
  const { session, queue } = await getSessionSnapshotData();
  return toSnapshot(session, queue);
}

export async function getAppStateSnapshotWithRevision(): Promise<AppStateSnapshotWithRevision> {
  const { session, queue } = await getSessionSnapshotData();
  return {
    snapshot: toSnapshot(session, queue),
    revision: session.revision,
    updatedAt: session.updatedAt,
  };
}

export async function getTokenCooldownStatus(tokenMint: string): Promise<CooldownStatus> {
  const db = getFirestoreDb();
  const sessionRef = db.collection('sessions').doc(APP_ID);
  const queueRef = sessionRef.collection('queue');
  const cooldownRef = sessionRef.collection('cooldowns').doc(tokenMint);
  const timestamp = nowMs();

  const [sessionSnapshot, queuedSnapshot, cooldownSnapshot] = await Promise.all([
    sessionRef.get(),
    queueRef.where('status', '==', 'queued').get(),
    cooldownRef.get(),
  ]);

  const sessionData = sessionSnapshot.data() as Record<string, unknown> | undefined;
  const currentItem = normalizeCurrentItem(sessionData?.currentItem);
  const queuedItems = queuedSnapshot.docs.map((doc) =>
    normalizeQueueDoc(doc.id, doc.data() as Record<string, unknown>)
  );

  if (activeItemInCooldown(currentItem, tokenMint, timestamp)) {
    return {
      inCooldown: true,
      message: 'Token is currently active',
      cooldownEndsAt: currentItem?.expiresAt,
    };
  }

  if (tokenAlreadyQueued(queuedItems, tokenMint)) {
    return {
      inCooldown: true,
      message: 'Token is already in queue',
    };
  }

  const cooldownData = cooldownSnapshot.data() as CooldownDoc | undefined;
  if (cooldownData?.endsAt && cooldownData.endsAt > timestamp) {
    return {
      inCooldown: true,
      message: `Token is in cooldown for ${Math.ceil(
        (cooldownData.endsAt - timestamp) / 1000
      )}s`,
      cooldownEndsAt: cooldownData.endsAt,
    };
  }

  return { inCooldown: false };
}

export async function enqueueVerifiedToken(
  input: QueueInsertInput
): Promise<EnqueueResult> {
  if (input.paymentTier !== input.tier) {
    throw new QueueStoreError(
      'INVALID_TIER',
      'Payment tier and queue tier must match'
    );
  }

  const db = getFirestoreDb();
  const sessionRef = db.collection('sessions').doc(APP_ID);

  try {
    return await db.runTransaction<EnqueueResult>(async (tx) => {
      const timestamp = nowMs();
      const queueCollection = sessionRef.collection('queue');
      const receiptRef = sessionRef.collection('receipts').doc(input.signature);
      const tokenCooldownRef = sessionRef.collection('cooldowns').doc(input.tokenMint);

      const sessionSnapshot = await tx.get(sessionRef);
      const queueSnapshot = await tx.get(
        queueCollection.where('status', '==', 'queued')
      );
      const cooldownSnapshot = await tx.get(tokenCooldownRef);
      const receiptSnapshot = await tx.get(receiptRef);

      if (receiptSnapshot.exists) {
        throw new QueueStoreError(
          'REPLAY',
          'This transaction signature has already been used'
        );
      }

      const sessionData =
        (sessionSnapshot.data() as Record<string, unknown> | undefined) ||
        createDefaultSessionDoc(timestamp);
      let currentItem = normalizeCurrentItem(sessionData.currentItem);
      const queuedItems = queueSnapshot.docs.map((doc) =>
        normalizeQueueDoc(doc.id, doc.data() as Record<string, unknown>)
      );

      const expiry = await expireActiveItemIfNeeded(
        tx,
        sessionRef,
        currentItem,
        timestamp
      );
      currentItem = expiry.nextCurrentItem;

      if (input.tier === 'standard') {
        if (activeItemInCooldown(currentItem, input.tokenMint, timestamp)) {
          throw new QueueStoreError('COOLDOWN', 'Token is currently active');
        }

        if (tokenAlreadyQueued(queuedItems, input.tokenMint)) {
          throw new QueueStoreError('COOLDOWN', 'Token is already in queue');
        }

        const cooldownData = cooldownSnapshot.data() as CooldownDoc | undefined;
        if (cooldownData?.endsAt && cooldownData.endsAt > timestamp) {
          throw new QueueStoreError(
            'COOLDOWN',
            `Token is in cooldown for ${Math.ceil(
              (cooldownData.endsAt - timestamp) / 1000
            )}s`
          );
        }
      }

      const newQueueItem = createQueueItem({
        tokenMint: input.tokenMint,
        walletAddress: input.walletAddress,
        tier: input.tier,
        createdAt: timestamp,
      });

      const pendingItems = [...queuedItems, newQueueItem];
      let activatedItem: QueueItemDoc | null = null;
      let persistedNewItem = newQueueItem;

      if (!currentItem) {
        const [nextItem] = sortQueuedItems(pendingItems);
        if (nextItem) {
          activatedItem = activateQueueItem(nextItem, timestamp);
          currentItem = activatedItem;
          tx.set(
            queueCollection.doc(activatedItem.id),
            {
              ...activatedItem,
              updatedAt: timestamp,
            },
            { merge: true }
          );
          if (activatedItem.id === newQueueItem.id) {
            persistedNewItem = activatedItem;
          }
        }
      }

      if (!activatedItem) {
        tx.set(
          queueCollection.doc(newQueueItem.id),
          {
            ...newQueueItem,
            updatedAt: timestamp,
          },
          { merge: true }
        );
      }

      const receipt = buildReceipt(input, timestamp);
      tx.set(receiptRef, receipt, { merge: true });

      const nextCurrentItem = currentItem;
      const nextToken = nextCurrentItem?.tokenMint || DEFAULT_TOKEN_MINT;
      const nextDevice = nextCurrentItem
        ? createActiveDeviceState(nextCurrentItem)
        : createWaitingDeviceState();

      tx.set(
        sessionRef,
        {
          appId: APP_ID,
          currentToken: nextToken,
          currentItem: nextCurrentItem,
          device: nextDevice,
          revision:
            (typeof sessionData.revision === 'number' ? sessionData.revision : 0) +
            1,
          updatedAt: timestamp,
        },
        { merge: true }
      );

      return {
        item: persistedNewItem,
        activatedItem,
      };
    });
  } catch (error) {
    if (error instanceof QueueStoreError) {
      throw error;
    }
    throw new QueueStoreError(
      'STATE_WRITE_FAILED',
      (error as Error)?.message || 'Failed to write queue state'
    );
  }
}

export async function advanceState(
  _reason: TickReason = 'manual'
): Promise<TickResult> {
  const db = getFirestoreDb();
  const sessionRef = db.collection('sessions').doc(APP_ID);

  return db.runTransaction<TickResult>(async (tx) => {
    const timestamp = nowMs();
    const queueCollection = sessionRef.collection('queue');
    const sessionSnapshot = await tx.get(sessionRef);
    const queueSnapshot = await tx.get(
      queueCollection.where('status', '==', 'queued')
    );

    const sessionData =
      (sessionSnapshot.data() as Record<string, unknown> | undefined) ||
      createDefaultSessionDoc(timestamp);
    const previousRevision =
      typeof sessionData.revision === 'number' ? sessionData.revision : 0;
    const previousToken = String(sessionData.currentToken || DEFAULT_TOKEN_MINT);
    const previousDevice = asDeviceState(sessionData.device);
    const previousCurrentItem = normalizeCurrentItem(sessionData.currentItem);

    let currentItem = previousCurrentItem;
    const queuedItems = queueSnapshot.docs.map((doc) =>
      normalizeQueueDoc(doc.id, doc.data() as Record<string, unknown>)
    );

    let changed = false;
    let activatedItem: QueueItemDoc | null = null;

    const expiry = await expireActiveItemIfNeeded(
      tx,
      sessionRef,
      currentItem,
      timestamp
    );
    if (expiry.changed) {
      changed = true;
    }
    currentItem = expiry.nextCurrentItem;

    if (!currentItem) {
      const [nextItem] = sortQueuedItems(queuedItems);
      if (nextItem) {
        activatedItem = activateQueueItem(nextItem, timestamp);
        currentItem = activatedItem;
        tx.set(
          queueCollection.doc(activatedItem.id),
          {
            ...activatedItem,
            updatedAt: timestamp,
          },
          { merge: true }
        );
        changed = true;
      }
    }

    const nextToken = currentItem?.tokenMint || DEFAULT_TOKEN_MINT;
    const nextDevice = currentItem
      ? createActiveDeviceState(currentItem)
      : createWaitingDeviceState();
    const currentItemChanged =
      JSON.stringify(previousCurrentItem) !== JSON.stringify(currentItem);
    const deviceChanged =
      JSON.stringify(previousDevice) !== JSON.stringify(nextDevice);
    const shouldPersist =
      changed ||
      previousToken !== nextToken ||
      currentItemChanged ||
      deviceChanged;

    if (shouldPersist) {
      tx.set(
        sessionRef,
        {
          appId: APP_ID,
          currentToken: nextToken,
          currentItem,
          device: nextDevice,
          revision: previousRevision + 1,
          updatedAt: timestamp,
        },
        { merge: true }
      );
    }

    return {
      changed,
      previousToken,
      currentToken: nextToken,
      activatedItem,
    };
  });
}
