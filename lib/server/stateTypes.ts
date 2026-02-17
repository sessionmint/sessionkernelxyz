import { DeviceStateSnapshot, QueueItem } from '@/lib/state';

export type QueueItemStatus = 'queued' | 'active' | 'expired' | 'canceled';

export interface QueueItemDoc extends QueueItem {
  status: QueueItemStatus;
  startsAt?: number | null;
}

export interface SessionStateDoc {
  appId: string;
  currentToken: string;
  currentItem: QueueItemDoc | null;
  device: DeviceStateSnapshot;
  revision: number;
  updatedAt: number;
}

export interface ReceiptDoc {
  txSig: string;
  tokenMint: string;
  walletAddress: string;
  paymentMethod: 'SOL' | 'MINSTR';
  paymentTier: 'standard' | 'priority';
  amount: string;
  verifiedAt: number;
}

export interface CooldownDoc {
  tokenMint: string;
  endsAt: number;
  updatedAt: number;
}

export type TickReason = 'cloud-task' | 'scheduler' | 'manual';

export interface TickResult {
  changed: boolean;
  previousToken: string;
  currentToken: string;
  activatedItem: QueueItemDoc | null;
}
