import {
  Connection,
  LAMPORTS_PER_SOL,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PublicKey,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getMint,
} from '@solana/spl-token';
import {
  HELIUS_RPC_URL,
  MINSTR_MINT,
  MINSTR_PRIORITY_PRICE,
  MINSTR_STANDARD_PRICE,
  PRIORITY_PRICE,
  STANDARD_PRICE,
  TREASURY_WALLET,
} from '@/lib/constants';
import { getServerEnv } from '@/lib/env/server';

type PaymentMethod = 'SOL' | 'MINSTR';
type PaymentTier = 'standard' | 'priority';

export interface VerifyPaymentInput {
  signature: string;
  walletAddress: string;
  paymentMethod: PaymentMethod;
  paymentTier: PaymentTier;
}

export interface VerifiedPaymentResult {
  signature: string;
  walletAddress: string;
  paymentMethod: PaymentMethod;
  paymentTier: PaymentTier;
  verifiedAmount: string;
  slot: number;
  blockTime: number | null;
}

export class PaymentVerificationError extends Error {
  readonly code:
    | 'TX_NOT_FOUND'
    | 'TX_FAILED'
    | 'SIGNER_MISMATCH'
    | 'RECIPIENT_MISMATCH'
    | 'AMOUNT_MISMATCH'
    | 'MINT_MISMATCH'
    | 'INVALID_PAYMENT_METHOD'
    | 'RPC_UNAVAILABLE';

  constructor(
    code:
      | 'TX_NOT_FOUND'
      | 'TX_FAILED'
      | 'SIGNER_MISMATCH'
      | 'RECIPIENT_MISMATCH'
      | 'AMOUNT_MISMATCH'
      | 'MINT_MISMATCH'
      | 'INVALID_PAYMENT_METHOD'
      | 'RPC_UNAVAILABLE',
    message: string
  ) {
    super(message);
    this.name = 'PaymentVerificationError';
    this.code = code;
  }
}

const FALLBACK_MAINNET_RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
];
const FINALIZED_TX_MAX_ATTEMPTS = 12;
const FINALIZED_TX_RETRY_MS = 800;

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildRpcCandidates(): string[] {
  const env = getServerEnv();
  const serverHeliusUrl = env.heliusApiKey
    ? `https://mainnet.helius-rpc.com/?api-key=${env.heliusApiKey}`
    : '';

  return uniqueValues([serverHeliusUrl, HELIUS_RPC_URL, ...FALLBACK_MAINNET_RPC_URLS]);
}

async function getWorkingConnection(): Promise<Connection> {
  const rpcCandidates = buildRpcCandidates();
  let lastError: Error | null = null;

  for (const rpcUrl of rpcCandidates) {
    const connection = new Connection(rpcUrl, 'confirmed');
    try {
      await connection.getLatestBlockhash('confirmed');
      return connection;
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw new PaymentVerificationError(
    'RPC_UNAVAILABLE',
    lastError?.message || 'No available Solana RPC endpoint'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getFinalizedTransactionWithRetries(
  connection: Connection,
  signature: string
): Promise<ParsedTransactionWithMeta | null> {
  for (let attempt = 0; attempt < FINALIZED_TX_MAX_ATTEMPTS; attempt += 1) {
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'finalized',
    });
    if (transaction) {
      return transaction;
    }

    if (attempt < FINALIZED_TX_MAX_ATTEMPTS - 1) {
      await sleep(FINALIZED_TX_RETRY_MS);
    }
  }

  return null;
}

function expectedSolLamports(tier: PaymentTier): number {
  const amount = tier === 'priority' ? PRIORITY_PRICE : STANDARD_PRICE;
  return Math.round(amount * LAMPORTS_PER_SOL);
}

function expectedMinstrAmount(tier: PaymentTier): number {
  return tier === 'priority' ? MINSTR_PRIORITY_PRICE : MINSTR_STANDARD_PRICE;
}

function getSignerMatches(tx: ParsedTransactionWithMeta, walletAddress: string): boolean {
  return tx.transaction.message.accountKeys.some(
    (key) => key.signer && key.pubkey.toBase58() === walletAddress
  );
}

function getParsedInstruction(
  instruction: unknown
): ParsedInstruction | null {
  if (!instruction || typeof instruction !== 'object') {
    return null;
  }

  if ('parsed' in instruction && 'program' in instruction) {
    return instruction as ParsedInstruction;
  }

  return null;
}

function getParsedTokenTransferInstructions(
  tx: ParsedTransactionWithMeta
): ParsedInstruction[] {
  const parsedInstructions: ParsedInstruction[] = [];

  for (const instruction of tx.transaction.message.instructions) {
    const parsedInstruction = getParsedInstruction(instruction);
    if (parsedInstruction) {
      parsedInstructions.push(parsedInstruction);
    }
  }

  const innerInstructionGroups = tx.meta?.innerInstructions || [];
  for (const group of innerInstructionGroups) {
    for (const instruction of group.instructions) {
      const parsedInstruction = getParsedInstruction(instruction);
      if (parsedInstruction) {
        parsedInstructions.push(parsedInstruction);
      }
    }
  }

  return parsedInstructions;
}

interface TokenAccountMetadata {
  mint: string;
  owner: string;
}

async function getTokenAccountMetadata(
  connection: Connection,
  tokenAccount: string,
  cache: Map<string, TokenAccountMetadata | null>
): Promise<TokenAccountMetadata | null> {
  if (cache.has(tokenAccount)) {
    return cache.get(tokenAccount) || null;
  }

  try {
    const accountInfo = await connection.getParsedAccountInfo(
      new PublicKey(tokenAccount),
      'confirmed'
    );
    const value = accountInfo.value;
    if (!value || typeof value.data !== 'object' || value.data === null) {
      cache.set(tokenAccount, null);
      return null;
    }

    if (!('parsed' in value.data)) {
      cache.set(tokenAccount, null);
      return null;
    }

    const parsed = value.data.parsed as {
      info?: { mint?: string; owner?: string };
    };

    const mint = parsed?.info?.mint;
    const owner = parsed?.info?.owner;
    if (typeof mint !== 'string' || typeof owner !== 'string') {
      cache.set(tokenAccount, null);
      return null;
    }

    const metadata = { mint, owner };
    cache.set(tokenAccount, metadata);
    return metadata;
  } catch {
    cache.set(tokenAccount, null);
    return null;
  }
}

function extractRawTokenAmount(info: {
  tokenAmount?: { amount?: string };
  amount?: string;
}): bigint | null {
  const rawAmountString = info.tokenAmount?.amount || info.amount;
  if (!rawAmountString || !/^\d+$/.test(rawAmountString)) {
    return null;
  }

  return BigInt(rawAmountString);
}

async function resolveMintTokenProgram(
  connection: Connection,
  mintPublicKey: PublicKey
): Promise<PublicKey> {
  const mintAccountInfo = await connection.getAccountInfo(mintPublicKey, 'confirmed');
  if (!mintAccountInfo) {
    throw new PaymentVerificationError(
      'MINT_MISMATCH',
      'Configured MINSTR mint account was not found on chain'
    );
  }

  if (mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return TOKEN_2022_PROGRAM_ID;
  }

  if (mintAccountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
    return TOKEN_PROGRAM_ID;
  }

  throw new PaymentVerificationError(
    'MINT_MISMATCH',
    'MINSTR mint is not owned by SPL Token or Token-2022 program'
  );
}

function instructionMatchesTokenProgram(
  parsedProgram: string,
  parsedProgramId: unknown,
  tokenProgramId: PublicKey
): boolean {
  if (parsedProgramId instanceof PublicKey) {
    if (parsedProgramId.equals(tokenProgramId)) {
      return true;
    }
  } else if (typeof parsedProgramId === 'string') {
    try {
      if (new PublicKey(parsedProgramId).equals(tokenProgramId)) {
        return true;
      }
    } catch {
      // Ignore malformed IDs and fall back to parsed program labels.
    }
  }

  const normalizedProgram = parsedProgram.toLowerCase();
  if (tokenProgramId.equals(TOKEN_2022_PROGRAM_ID)) {
    // Some RPC nodes label Token-2022 parsed instructions as `spl-token`.
    return normalizedProgram === 'spl-token' || normalizedProgram.includes('token-2022');
  }

  return normalizedProgram === 'spl-token';
}

function verifySolTransfer(
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
  expectedLamports: number
): string {
  let sawTreasuryTransferFromWallet = false;
  let sawAmountMismatch = false;

  for (const instruction of tx.transaction.message.instructions) {
    const parsedInstruction = getParsedInstruction(instruction);
    if (!parsedInstruction) continue;
    if (parsedInstruction.program !== 'system') continue;
    if (parsedInstruction.parsed?.type !== 'transfer') continue;

    const info = parsedInstruction.parsed.info as {
      source?: string;
      destination?: string;
      lamports?: number;
    };

    if (info.source !== walletAddress) continue;
    if (info.destination !== TREASURY_WALLET) continue;
    sawTreasuryTransferFromWallet = true;
    if (Number(info.lamports) !== expectedLamports) {
      sawAmountMismatch = true;
      continue;
    }

    return expectedLamports.toString();
  }

  if (sawTreasuryTransferFromWallet && sawAmountMismatch) {
    throw new PaymentVerificationError(
      'AMOUNT_MISMATCH',
      'SOL transfer amount does not match selected tier'
    );
  }

  throw new PaymentVerificationError(
    'RECIPIENT_MISMATCH',
    'No matching SOL transfer to treasury wallet found in transaction'
  );
}

async function verifyMinstrTransfer(
  connection: Connection,
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
  expectedTokenAmount: number
): Promise<string> {
  const mintPublicKey = new PublicKey(MINSTR_MINT);
  const tokenProgramId = await resolveMintTokenProgram(connection, mintPublicKey);
  const mintInfo = await getMint(
    connection,
    mintPublicKey,
    'confirmed',
    tokenProgramId
  );
  const expectedRawAmount =
    BigInt(expectedTokenAmount) * 10n ** BigInt(mintInfo.decimals);
  const tokenAccountCache = new Map<string, TokenAccountMetadata | null>();
  let sawTreasuryDestinationMatch = false;
  let sawMintMismatch = false;
  let sawAmountMismatch = false;

  for (const parsedInstruction of getParsedTokenTransferInstructions(tx)) {
    if (
      !instructionMatchesTokenProgram(
        parsedInstruction.program,
        parsedInstruction.programId,
        tokenProgramId
      )
    ) {
      continue;
    }

    const parsedType = parsedInstruction.parsed?.type;
    if (parsedType !== 'transferChecked' && parsedType !== 'transfer') {
      continue;
    }

    const info = parsedInstruction.parsed.info as {
      authority?: string;
      source?: string;
      destination?: string;
      mint?: string;
      tokenAmount?: { amount?: string };
      amount?: string;
    };

    if (!info.destination) continue;

    if (typeof info.authority === 'string') {
      if (info.authority !== walletAddress) continue;
    } else if (typeof info.source === 'string') {
      const sourceAccount = await getTokenAccountMetadata(
        connection,
        info.source,
        tokenAccountCache
      );
      if (!sourceAccount || sourceAccount.owner !== walletAddress) {
        continue;
      }
    } else {
      continue;
    }

    const destinationAccount = await getTokenAccountMetadata(
      connection,
      info.destination,
      tokenAccountCache
    );
    if (!destinationAccount || destinationAccount.owner !== TREASURY_WALLET) {
      continue;
    }
    sawTreasuryDestinationMatch = true;

    const destinationMint =
      typeof info.mint === 'string' ? info.mint : destinationAccount.mint;
    if (destinationMint !== MINSTR_MINT) {
      sawMintMismatch = true;
      continue;
    }

    const rawAmount = extractRawTokenAmount(info);
    if (rawAmount === null) continue;

    if (rawAmount !== expectedRawAmount) {
      sawAmountMismatch = true;
      continue;
    }

    return rawAmount.toString();
  }

  if (sawAmountMismatch) {
    throw new PaymentVerificationError(
      'AMOUNT_MISMATCH',
      'MINSTR transfer amount does not match selected tier'
    );
  }

  if (sawMintMismatch) {
    throw new PaymentVerificationError(
      'MINT_MISMATCH',
      'Token transfer mint does not match configured MINSTR mint'
    );
  }

  if (sawTreasuryDestinationMatch) {
    throw new PaymentVerificationError(
      'RECIPIENT_MISMATCH',
      'No matching MINSTR transfer to treasury-owned token account found in transaction'
    );
  }

  throw new PaymentVerificationError(
    'RECIPIENT_MISMATCH',
    'No matching MINSTR transfer to treasury-owned token account found in transaction'
  );
}

export async function verifyPaymentOnChain(
  input: VerifyPaymentInput
): Promise<VerifiedPaymentResult> {
  if (input.paymentMethod !== 'SOL' && input.paymentMethod !== 'MINSTR') {
    throw new PaymentVerificationError(
      'INVALID_PAYMENT_METHOD',
      'Unsupported payment method'
    );
  }

  const connection = await getWorkingConnection();
  let transaction: ParsedTransactionWithMeta | null = null;
  try {
    transaction = await getFinalizedTransactionWithRetries(
      connection,
      input.signature
    );
  } catch (error) {
    const message = (error as Error)?.message || 'Failed to fetch transaction';
    if (/wrongsize|invalid param/i.test(message)) {
      throw new PaymentVerificationError(
        'TX_NOT_FOUND',
        'Invalid transaction signature format'
      );
    }

    throw new PaymentVerificationError('RPC_UNAVAILABLE', message);
  }

  if (!transaction) {
    throw new PaymentVerificationError(
      'TX_NOT_FOUND',
      'Transaction signature not found as finalized yet. Wait a few seconds and retry.'
    );
  }

  if (transaction.meta?.err) {
    throw new PaymentVerificationError(
      'TX_FAILED',
      'Transaction failed on chain and cannot be used as payment proof'
    );
  }

  if (!getSignerMatches(transaction, input.walletAddress)) {
    throw new PaymentVerificationError(
      'SIGNER_MISMATCH',
      'Connected wallet did not sign the provided transaction'
    );
  }

  const verifiedAmount =
    input.paymentMethod === 'SOL'
      ? verifySolTransfer(
          transaction,
          input.walletAddress,
          expectedSolLamports(input.paymentTier)
        )
      : await verifyMinstrTransfer(
          connection,
          transaction,
          input.walletAddress,
          expectedMinstrAmount(input.paymentTier)
        );

  return {
    signature: input.signature,
    walletAddress: input.walletAddress,
    paymentMethod: input.paymentMethod,
    paymentTier: input.paymentTier,
    verifiedAmount,
    slot: transaction.slot,
    blockTime: transaction.blockTime || null,
  };
}
