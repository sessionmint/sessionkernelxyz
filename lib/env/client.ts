const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

const DEFAULT_MAINNET_RPC_URL = 'https://api.mainnet-beta.solana.com';

function buildRpcUrl(): string {
  const configuredRpcUrl =
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
    process.env.NEXT_PUBLIC_HELIUS_URL ||
    '';
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
  const heliusRpcWithKey = heliusApiKey
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
    : '';

  const configuredRpcNeedsKey =
    configuredRpcUrl.includes('helius-rpc.com') &&
    !configuredRpcUrl.includes('api-key=');

  if (!configuredRpcUrl) {
    return heliusRpcWithKey || DEFAULT_MAINNET_RPC_URL;
  }

  if (!configuredRpcNeedsKey) {
    return configuredRpcUrl;
  }

  if (!heliusApiKey) {
    return DEFAULT_MAINNET_RPC_URL;
  }

  return `${configuredRpcUrl}${
    configuredRpcUrl.includes('?') ? '&' : '?'
  }api-key=${heliusApiKey}`;
}

export interface ClientEnv {
  treasuryWallet: string;
  defaultTokenMint: string;
  livestreamUrl: string;
  phantomAppId: string;
  heliusRpcUrl: string;
  autoblowPublicEnabled: boolean;
}

let cachedEnv: ClientEnv | null = null;

export function getClientEnv(): ClientEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    treasuryWallet:
      process.env.NEXT_PUBLIC_TREASURY_WALLET ||
      '4st6sXyHiTPpgp42egiz1r6WEEBLMcKYL5cpncwnEReg',
    defaultTokenMint:
      process.env.NEXT_PUBLIC_DEFAULT_TOKEN_MINT ||
      process.env.NEXT_PUBLIC_DEFAULT_TOKEN ||
      'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    livestreamUrl:
      process.env.NEXT_PUBLIC_LIVESTREAM_URL ||
      'https://player.kick.com/sessionmint',
    phantomAppId: process.env.NEXT_PUBLIC_PHANTOM_APP_ID || '',
    heliusRpcUrl: buildRpcUrl(),
    autoblowPublicEnabled: parseBoolean(
      process.env.NEXT_PUBLIC_AUTOBLOW_ENABLED,
      false
    ),
  };

  return cachedEnv;
}
