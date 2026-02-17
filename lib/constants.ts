import { getClientEnv } from '@/lib/env/client';

const clientEnv = getClientEnv();

// Canonical app id for this deployment scope.
export const APP_ID = 'chartgobrralpha';

// Public wallet and stream settings.
export const TREASURY_WALLET = clientEnv.treasuryWallet;
export const PHANTOM_APP_ID = clientEnv.phantomAppId;
export const DEFAULT_TOKEN_MINT = clientEnv.defaultTokenMint;
export const LIVESTREAM_URL = clientEnv.livestreamUrl;

// Pricing configuration.
export const SOL_STANDARD_PRICE = 0.01;
export const SOL_PRIORITY_PRICE = 0.04;

// Canonical MINSTR mint (hardcoded by product requirement).
export const MINSTR_MINT = '2gWujYmBCd77Sf9gg6yMSexdPrudKpvss1yV8E71pump';
export const MINSTR_STANDARD_PRICE = 10_000;
export const MINSTR_PRIORITY_PRICE = 42_000;
export const MINSTR_SYMBOL = 'MINSTR';

// Backwards-compatible names used by current UI.
export const STANDARD_PRICE = SOL_STANDARD_PRICE;
export const PRIORITY_PRICE = SOL_PRIORITY_PRICE;

// Display duration configuration.
export const DISPLAY_DURATION_STANDARD = 10 * 60 * 1000; // 10 minutes
export const DISPLAY_DURATION_PRIORITY = 10 * 60 * 1000; // 10 minutes

// Duplicate address cooldown (2 hours).
export const DUPLICATE_COOLDOWN_MS = 2 * 60 * 60 * 1000;

// Priority levels (higher = more priority).
export const PRIORITY_LEVELS = {
  STANDARD: 0,
  PRIORITY: 1,
} as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[keyof typeof PRIORITY_LEVELS];

// Network configuration (public/client-safe).
export const PAYMENT_NETWORK = 'mainnet-beta';
export const HELIUS_RPC_URL = clientEnv.heliusRpcUrl;

// Client-side feature gates.
export const AUTOBLOW_PUBLIC_ENABLED = clientEnv.autoblowPublicEnabled;
