import { PublicKey } from '@solana/web3.js';

const BASE58_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,128}$/;

export function isValidSolanaAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    // PublicKey constructor throws on invalid base58.
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function isValidTransactionSignature(value: unknown): value is string {
  return typeof value === 'string' && BASE58_SIGNATURE_PATTERN.test(value.trim());
}

export function parsePositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

