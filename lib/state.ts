export interface AppStateSnapshot {
  currentToken: string;
  currentItem: QueueItem | null;
  queue: QueueItem[];
  device: DeviceStateSnapshot | null;
}

export interface QueueItem {
  id: string;
  tokenMint: string;
  walletAddress: string;
  priorityLevel: number;
  displayDuration: number;
  expiresAt: number;
  isPriority: boolean;
  createdAt: number;
}

export interface DeviceStateSnapshot {
  state: 'active' | 'waiting' | 'cooldown' | 'error';
  session?: {
    mode: string;
    speed: number;
  };
  cooldown?: {
    active: boolean;
    endsAt: number;
  };
}

export interface DeviceSession {
  mode: string;
  speed: number;
}