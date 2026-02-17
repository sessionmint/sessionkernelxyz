const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ServerEnv {
  firebaseProjectId: string;
  firestoreDatabaseId: string;
  googleCloudRegion: string;
  stateTickQueueId: string;
  cronSecret: string;
  adminApiKey: string;
  heliusApiKey: string;
  autoblowEnabled: boolean;
  autoblowApiUrl: string;
  autoblowDeviceToken: string;
  autoblowTimeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

let cachedEnv: ServerEnv | null = null;

export class MissingServerEnvError extends Error {
  readonly keys: Array<keyof ServerEnv>;

  constructor(keys: Array<keyof ServerEnv>) {
    super(`Missing required server env: ${keys.join(', ')}`);
    this.name = 'MissingServerEnvError';
    this.keys = keys;
  }
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    googleCloudRegion: process.env.GOOGLE_CLOUD_REGION || '',
    stateTickQueueId: process.env.STATE_TICK_QUEUE_ID || '',
    cronSecret: process.env.CRON_SECRET || '',
    adminApiKey: process.env.ADMIN_API_KEY || '',
    heliusApiKey: process.env.HELIUS_API_KEY || '',
    autoblowEnabled: parseBoolean(process.env.AUTOBLOW_ENABLED, false),
    autoblowApiUrl:
      process.env.AUTOBLOW_API_URL || 'https://latency.autoblowapi.com',
    autoblowDeviceToken: process.env.AUTOBLOW_DEVICE_TOKEN || '',
    autoblowTimeoutMs: parseInteger(process.env.AUTOBLOW_TIMEOUT_MS, 10_000),
    rateLimitWindowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMaxRequests: parseInteger(
      process.env.RATE_LIMIT_MAX_REQUESTS,
      100
    ),
  };

  return cachedEnv;
}

export function assertServerEnv(keys: Array<keyof ServerEnv>): void {
  const env = getServerEnv();
  const missing = keys.filter((key) => {
    const value = env[key];
    if (typeof value === 'string') {
      return !value.trim();
    }
    return false;
  });

  if (missing.length > 0) {
    throw new MissingServerEnvError(missing);
  }
}
