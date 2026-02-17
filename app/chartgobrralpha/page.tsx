'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { 
  Connection, 
  LAMPORTS_PER_SOL, 
  PublicKey, 
  SystemProgram, 
  Transaction 
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token';
import { WelcomeModal } from '@/components/WelcomeModal';
import { usePhantomWallet } from '@/contexts/ContextProvider';
import { useAppStateStream } from '@/hooks/useAppStateStream';
import {
  AUTOBLOW_PUBLIC_ENABLED,
  DEFAULT_TOKEN_MINT,
  DISPLAY_DURATION_STANDARD,
  HELIUS_RPC_URL,
  LIVESTREAM_URL,
  MINSTR_MINT,
  MINSTR_PRIORITY_PRICE,
  MINSTR_STANDARD_PRICE,
  MINSTR_SYMBOL,
  PRIORITY_PRICE,
  STANDARD_PRICE,
  TREASURY_WALLET,
} from '@/lib/constants';
import { AppStateSnapshot, DeviceStateSnapshot } from '@/lib/state';
import {
  updateChartForToken,
  createChartSession,
  syncChartToAutoblow
} from '@/lib/chartSync';

const AUTOBLOW_KEEPALIVE_INTERVAL_MS = 12000;
const FALLBACK_MAINNET_RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
];

type PaymentOptionId =
  | 'sol_standard'
  | 'sol_priority'
  | 'minstr_standard'
  | 'minstr_priority';

interface PaymentOptionConfig {
  id: PaymentOptionId;
  tier: 'standard' | 'priority';
  currency: 'SOL' | 'MINSTR';
  amount: number;
  label: string;
}

interface QueuePrecheckResult {
  ok: boolean;
  tokenValid: boolean;
  inCooldown: boolean;
  allowStandard: boolean;
  allowPriority: boolean;
  reason?: string;
}

const PAYMENT_OPTIONS: PaymentOptionConfig[] = [
  {
    id: 'sol_standard',
    tier: 'standard',
    currency: 'SOL',
    amount: STANDARD_PRICE,
    label: `${STANDARD_PRICE.toFixed(2)} SOL Standard`,
  },
  {
    id: 'sol_priority',
    tier: 'priority',
    currency: 'SOL',
    amount: PRIORITY_PRICE,
    label: `${PRIORITY_PRICE.toFixed(2)} SOL Priority`,
  },
  {
    id: 'minstr_standard',
    tier: 'standard',
    currency: 'MINSTR',
    amount: MINSTR_STANDARD_PRICE,
    label: `${MINSTR_STANDARD_PRICE.toLocaleString()} $${MINSTR_SYMBOL} Standard`,
  },
  {
    id: 'minstr_priority',
    tier: 'priority',
    currency: 'MINSTR',
    amount: MINSTR_PRIORITY_PRICE,
    label: `${MINSTR_PRIORITY_PRICE.toLocaleString()} $${MINSTR_SYMBOL} Priority`,
  },
];

const SOL_PAYMENT_OPTIONS = PAYMENT_OPTIONS.filter((option) => option.currency === 'SOL');
const MINSTR_PAYMENT_OPTIONS = PAYMENT_OPTIONS.filter((option) => option.currency === 'MINSTR');

export default function ChartGoBrrAlphaPage() {
  // Stream is always enabled - controlled by SessionMint.fun
  const [nowMs, setNowMs] = useState(() => Date.now());
  const autoblowSyncInFlightRef = useRef(false);
  const autoblowSyncStateRef = useRef({
    token: DEFAULT_TOKEN_MINT,
    intensity: 0.85,
  });

  const stateStream = useAppStateStream(true);
  const currentToken = stateStream.snapshot?.currentToken || DEFAULT_TOKEN_MINT;
  const currentItem = stateStream.snapshot?.currentItem || null;
  const queue = stateStream.snapshot?.queue || [];
  const deviceState = stateStream.snapshot?.device || null;
  const autoblowIntensity = useMemo(() => {
    // Keep motion active for default and paid states.
    if (deviceState?.state === 'active') {
      const speed = deviceState.session?.speed ?? 85;
      return Math.max(0, Math.min(1, speed / 100));
    }

    if (deviceState?.state === 'error') {
      return 0.6;
    }

    return 0.85;
  }, [deviceState]);

  useEffect(() => {
    autoblowSyncStateRef.current = {
      token: currentToken,
      intensity: autoblowIntensity,
    };
  }, [autoblowIntensity, currentToken]);

  const syncAutoblow = useCallback(async (reason: 'event' | 'keepalive') => {
    if (!AUTOBLOW_PUBLIC_ENABLED) return;
    if (autoblowSyncInFlightRef.current) return;

    const { token, intensity } = autoblowSyncStateRef.current;
    if (!token) return;

    autoblowSyncInFlightRef.current = true;
    try {
      await syncChartToAutoblow(token, intensity);
    } catch (error) {
      console.error(
        `[ChartGoBrrAlpha] Error syncing chart to Autoblow device (${reason}):`,
        error
      );
    } finally {
      autoblowSyncInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const clock = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!currentToken) return;
    void createChartSession(currentToken, DISPLAY_DURATION_STANDARD).catch((error) => {
      console.error('[ChartGoBrrAlpha] Failed to initialize chart session:', error);
    });
  }, [currentToken]);

  useEffect(() => {
    if (!currentToken) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const trend =
        autoblowIntensity > 0.7
          ? 'up'
          : autoblowIntensity < 0.3
            ? 'down'
            : 'neutral';

      try {
        await updateChartForToken(currentToken, {
          boost: autoblowIntensity > 0.7 ? 1.5 : 1,
          volatility: autoblowIntensity,
          trend,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('[ChartGoBrrAlpha] Error updating chart data:', error);
        }
      }

      if (!AUTOBLOW_PUBLIC_ENABLED || cancelled) return;

      await syncAutoblow('event');
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autoblowIntensity, currentToken, syncAutoblow]);

  useEffect(() => {
    if (!AUTOBLOW_PUBLIC_ENABLED || !currentToken) return;

    const timer = window.setInterval(() => {
      void syncAutoblow('keepalive');
    }, AUTOBLOW_KEEPALIVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [currentToken, syncAutoblow]);

  const streamUrl = useMemo(() => {
    if (LIVESTREAM_URL.includes('player.kick.com') || LIVESTREAM_URL.includes('kick.com')) {
      const separator = LIVESTREAM_URL.includes('?') ? '&' : '?';
      return `${LIVESTREAM_URL}${separator}autoplay=true&muted=false`;
    }
    return LIVESTREAM_URL;
  }, []);

  return (
    <>
      <WelcomeModal />

      <div className="dashboard">
        <div className="bg-pattern" />

        <main className="main-column">
          <div className="stream-layer">
            <div className="layer-badge">
              <span className="dot" style={{ background: '#ef4444' }} />
              LIVE
            </div>
            <StreamEmbed url={streamUrl} sessionKey={currentItem?.id || currentToken} />
          </div>

          <div className="chart-layer">
            <div className="layer-badge">CHART</div>
            <iframe
              title="chartgobrrr-chart"
              src={`https://dexscreener.com/solana/${currentToken}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTimeframesToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=marketCap&interval=5`}
            />
          </div>
        </main>

        <aside className="sidebar">
          <div className="sidebar-header">
              <div className="brand-logo">
              <Image
                src="/images/logo.png"
                alt="ChartGoBrrAlpha logo"
                className="brand-logo-image"
                width={64}
                height={64}
                priority
              />
              </div>
            <div className="brand-text">
              <h1>ChartGoBrrAlpha</h1>
              <span>
                <span className="dot" style={{ background: '#39ff14' }} />
                SessionMint.fun
              </span>
            </div>
          </div>
          <div className="sidebar-content">
            <div className="sidebar-scroll">
              <DeviceStatus device={deviceState} streamConnected={stateStream.connected} />
              <PromoteForm />
              <ActiveToken currentItem={currentItem} currentToken={currentToken} nowMs={nowMs} />
              <QueueList queue={queue} currentItem={currentItem} nowMs={nowMs} />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function StreamEmbed({ url, sessionKey }: { url: string; sessionKey: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-copy">
            <div className="loading-title">CONNECTING LIVESTREAM</div>
            <div className="loading-subtitle">Syncing chart + device</div>
          </div>
        </div>
      )}
      <SessionTransitionOverlay key={sessionKey} />
      <iframe
        src={url}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{
          opacity: loaded ? 1 : 0,
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          border: 'none',
          pointerEvents: 'auto',
        }}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

function SessionTransitionOverlay() {
  const [visible, setVisible] = useState(true);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const countdownTimer = window.setInterval(() => {
      setCountdown((previous) => (previous <= 1 ? 1 : previous - 1));
    }, 1000);

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, 3200);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="loading loading-transition">
      <div className="spinner" />
      <div className="loading-copy">
        <div className="loading-title">NEW SESSION IS LOADING</div>
        <div className="loading-subtitle">Syncing chart + device</div>
        <div className="loading-countdown">{countdown}</div>
      </div>
    </div>
  );
}

function ActiveToken({
  currentItem,
  currentToken,
  nowMs,
}: {
  currentItem: AppStateSnapshot['currentItem'];
  currentToken: string;
  nowMs: number;
}) {
  const isDefault = currentToken === DEFAULT_TOKEN_MINT;
  const timeLeftMs =
    !isDefault && currentItem?.expiresAt
      ? Math.max(0, currentItem.expiresAt - nowMs)
      : 0;
  const format = (ms: number) =>
    `${Math.floor(ms / 60000)}:${Math.floor((ms % 60000) / 1000)
      .toString()
      .padStart(2, '0')}`;

  return (
    <div className="section">
      <div className="section-title-row" style={{ marginBottom: 8 }}>
        <span className="section-title">Now Showing</span>
        {!isDefault && currentItem ? (
          <span className={`mini-timer ${currentItem.isPriority ? 'priority' : ''}`}>
            {format(timeLeftMs)}
          </span>
        ) : null}
      </div>
      <div className="token-details">
        <div className="detail-row">
          <span
            className="detail-value mono"
            style={{ textAlign: 'left', width: '100%' }}
          >
            {currentToken}
          </span>
        </div>
        {!isDefault && currentItem ? (
          <>
            <div className="detail-row">
              <span className="detail-label">Tier</span>
              <span className="detail-value">
                {currentItem.priorityLevel >= 1 ? 'Priority' : 'Standard'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Wallet</span>
              <span className="detail-value mono">
                {currentItem.walletAddress.slice(0, 4)}...{currentItem.walletAddress.slice(-4)}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DeviceStatus({
  device,
  streamConnected,
}: {
  device: DeviceStateSnapshot | null;
  streamConnected: boolean;
}) {
  const isEnabled = streamConnected && Boolean(device) && device?.state !== 'error';
  const text = isEnabled ? 'Device enabled' : 'Device disabled';

  return (
    <div className="section device-section">
      <div className="section-title">Device</div>
      <div className="device-status">
        <span className="device-indicator" style={{ backgroundColor: isEnabled ? '#39ff14' : '#ef4444' }} />
        <span className="device-text">{text}</span>
      </div>
    </div>
  );
}

function PromoteForm() {
  const [token, setToken] = useState('');
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOptionId>('sol_standard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [precheckStatus, setPrecheckStatus] = useState<QueuePrecheckResult | null>(null);
  const [checkCooldown, setCheckCooldown] = useState(false);
  const [buttonCooldown, setButtonCooldown] = useState(0);

  const nonceSignedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wallet = usePhantomWallet();
  const rpcCandidates = useMemo(
    () => Array.from(new Set([HELIUS_RPC_URL, ...FALLBACK_MAINNET_RPC_URLS].filter(Boolean))),
    []
  );
  const getWorkingConnection = useCallback(async () => {
    let lastError: Error | null = null;

    for (const rpcUrl of rpcCandidates) {
      const candidate = new Connection(rpcUrl, 'confirmed');
      try {
        await candidate.getLatestBlockhash('confirmed');
        return { connection: candidate, rpcUrl };
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw lastError ?? new Error('No available Solana RPC endpoint');
  }, [rpcCandidates]);
  const selectedConfig = useMemo(
    () => PAYMENT_OPTIONS.find((option) => option.id === selectedPaymentOption) || PAYMENT_OPTIONS[0],
    [selectedPaymentOption]
  );
  const selectedTier = selectedConfig.tier;
  const selectedCurrency = selectedConfig.currency;
  const selectedAmount = selectedConfig.amount;
  const selectedAmountLabel = useMemo(() => {
    if (selectedCurrency === 'SOL') {
      return `${selectedAmount.toFixed(2)} SOL`;
    }
    return `${selectedAmount.toLocaleString()} $${MINSTR_SYMBOL}`;
  }, [selectedAmount, selectedCurrency]);

  const isOptionAllowed = useCallback(
    (option: PaymentOptionConfig) => {
      if (!precheckStatus) return true;
      return option.tier === 'priority'
        ? precheckStatus.allowPriority
        : precheckStatus.allowStandard;
    },
    [precheckStatus]
  );

  useEffect(() => {
    if (buttonCooldown <= 0) return;
    const timer = setInterval(() => setButtonCooldown((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [buttonCooldown]);

  useEffect(() => {
    setPrecheckStatus(null);
    if (!token.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCheckCooldown(true);
      try {
        const response = await fetch('/api/queue/precheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenMint: token.trim() }),
        });
        const data = (await response.json()) as QueuePrecheckResult;
        setPrecheckStatus(data);

        if (!data.allowStandard && data.allowPriority) {
          setSelectedPaymentOption((current) => {
            if (current === 'sol_standard') return 'sol_priority';
            if (current === 'minstr_standard') return 'minstr_priority';
            return current;
          });
        }
      } catch {
        setPrecheckStatus(null);
      } finally {
        setCheckCooldown(false);
      }
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [token]);

  const pay = async () => {
    if (buttonCooldown > 0) return;
    if (!wallet.connected || !wallet.address) {
      setMessage('Connect Phantom first');
      return;
    }
    if (!token.trim()) {
      setMessage('Token address is required');
      return;
    }

    setLoading(true);
    setButtonCooldown(2);
    setMessage(null);

    try {
      const precheckResponse = await fetch('/api/queue/precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenMint: token.trim(),
          paymentTier: selectedTier,
        }),
      });
      const precheck = (await precheckResponse.json()) as QueuePrecheckResult;
      if (!precheckResponse.ok || !precheck.ok) {
        throw new Error(precheck.reason || 'Token is not eligible for this tier');
      }

      if (!nonceSignedRef.current) {
        await wallet.signMessage(`SessionMint.fun auth ${Date.now()}`);
        nonceSignedRef.current = true;
      }

      const sender = new PublicKey(wallet.address);
      const treasury = new PublicKey(TREASURY_WALLET);
      const { connection: rpcConnection } = await getWorkingConnection();
      const { blockhash, lastValidBlockHeight } = await rpcConnection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({
        feePayer: sender,
        recentBlockhash: blockhash,
      });

      if (selectedCurrency === 'SOL') {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: sender,
            toPubkey: treasury,
            lamports: Math.floor(selectedAmount * LAMPORTS_PER_SOL),
          })
        );
      } else {
        const minstrMint = new PublicKey(MINSTR_MINT);
        const mintAccountInfo = await rpcConnection.getAccountInfo(
          minstrMint,
          'confirmed'
        );
        if (!mintAccountInfo) {
          throw new Error(`Could not load $${MINSTR_SYMBOL} mint account`);
        }

        const tokenProgramId = mintAccountInfo.owner;
        const isTokenProgramSupported =
          tokenProgramId.equals(TOKEN_PROGRAM_ID) ||
          tokenProgramId.equals(TOKEN_2022_PROGRAM_ID);
        if (!isTokenProgramSupported) {
          throw new Error('MINSTR mint is not owned by SPL Token or Token-2022 program');
        }

        const mintInfo = await getMint(
          rpcConnection,
          minstrMint,
          'confirmed',
          tokenProgramId
        );
        const senderTokenAccount = getAssociatedTokenAddressSync(
          minstrMint,
          sender,
          false,
          tokenProgramId
        );
        const treasuryTokenAccount = getAssociatedTokenAddressSync(
          minstrMint,
          treasury,
          false,
          tokenProgramId
        );

        const [senderTokenAccountInfo, treasuryTokenAccountInfo] = await Promise.all([
          rpcConnection.getAccountInfo(senderTokenAccount, 'confirmed'),
          rpcConnection.getAccountInfo(treasuryTokenAccount, 'confirmed'),
        ]);

        if (!senderTokenAccountInfo) {
          throw new Error(`Connected wallet has no $${MINSTR_SYMBOL} token account`);
        }

        if (!treasuryTokenAccountInfo) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              sender,
              treasuryTokenAccount,
              treasury,
              minstrMint,
              tokenProgramId
            )
          );
        }

        const tokenAmountRaw = BigInt(selectedAmount) * (BigInt(10) ** BigInt(mintInfo.decimals));
        transaction.add(
          createTransferCheckedInstruction(
            senderTokenAccount,
            minstrMint,
            treasuryTokenAccount,
            sender,
            tokenAmountRaw,
            mintInfo.decimals,
            [],
            tokenProgramId
          )
        );
      }

      const signature = await wallet.signAndSendTransaction(transaction);
      await rpcConnection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'finalized'
      );
      const queueResponse = await fetch('/api/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenMint: token.trim(),
          walletAddress: wallet.address,
          amount: selectedAmount,
          signature,
          paymentMethod: selectedCurrency,
          paymentTier: selectedTier,
        }),
      });

      const queueResult = (await queueResponse.json()) as { error?: string };
      if (!queueResponse.ok) {
        throw new Error(queueResult?.error || 'Failed to queue token');
      }

      setToken('');
      setPrecheckStatus(null);
      setMessage('Queued successfully');
    } catch (error) {
      const rawMessage = (error as Error).message || 'Transaction failed';
      if (
        /recent blockhash/i.test(rawMessage) ||
        /missing api key/i.test(rawMessage) ||
        /access forbidden/i.test(rawMessage) ||
        /\b401\b/.test(rawMessage) ||
        /\b403\b/.test(rawMessage)
      ) {
        setMessage('Could not reach RPC endpoint. Switched to public Solana RPC fallback. Please try again.');
      } else {
        setMessage(rawMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const onWalletButtonClick = async () => {
    try {
      if (wallet.connected) {
        await wallet.disconnect();
      } else {
        await wallet.connect();
      }
    } catch (error) {
      setMessage((error as Error).message || 'Wallet action failed');
    }
  };

  return (
    <div className="section">
      <div className="section-title">Load token</div>
      <div className="form">
        <input className="input" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Token mint or contract address..." />
        {message ? <div className="msg">{message}</div> : null}
        {precheckStatus && !precheckStatus.ok && precheckStatus.reason ? (
          <div className="msg">{precheckStatus.reason}</div>
        ) : null}
        {checkCooldown ? <div className="msg">Checking cooldown...</div> : null}
        <button className="btn" onClick={onWalletButtonClick}>
          {wallet.connecting ? 'Connecting...' : wallet.connected ? `Disconnect (${wallet.address?.slice(0, 4)}...${wallet.address?.slice(-4)})` : 'Connect Phantom'}
        </button>

        <div className="payment-rows">
          <div className="payment-row">
            <div className="payment-row-label">Pay in SOL</div>
            <div className="btns">
              {SOL_PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={selectedPaymentOption === option.id ? 'btn btn-selected-sol' : 'btn'}
                  onClick={() => setSelectedPaymentOption(option.id)}
                  disabled={loading || !isOptionAllowed(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="payment-row">
            <div className="payment-row-label">Pay in ${MINSTR_SYMBOL}</div>
            <div className="btns">
              {MINSTR_PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={selectedPaymentOption === option.id ? 'btn btn-selected' : 'btn'}
                  onClick={() => setSelectedPaymentOption(option.id)}
                  disabled={loading || !isOptionAllowed(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button className="btn btn-green" onClick={pay} disabled={loading || !wallet.connected || buttonCooldown > 0}>
          {loading ? 'Processing...' : buttonCooldown > 0 ? `Wait ${buttonCooldown}s` : `Pay ${selectedAmountLabel}`}
        </button>
      </div>
    </div>
  );
}

function QueueList({
  queue,
  currentItem,
  nowMs,
}: {
  queue: AppStateSnapshot['queue'];
  currentItem: AppStateSnapshot['currentItem'];
  nowMs: number;
}) {
  const waitTime = (index: number) => {
    const remaining = currentItem?.expiresAt ? Math.max(0, currentItem.expiresAt - nowMs) : 0;
    let total = remaining;
    for (let i = 0; i < index; i += 1) total += queue[i].displayDuration || DISPLAY_DURATION_STANDARD;
    const totalMins = Math.floor(total / 60000);
    if (totalMins >= 60) {
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${hours}h ${mins}m`;
    }
    return `${totalMins}m`;
  };

  const tierLabel = (priorityLevel: number) => {
    if (priorityLevel >= 1) return 'Priority';
    return 'Standard';
  };

  return (
    <div className="section">
      <div className="section-title">Queue ({queue.length})</div>
      {queue.length === 0 ? (
        <div className="queue-empty">No tokens waiting</div>
      ) : (
        <div className="queue-list">
          {queue.map((item, index) => (
            <div key={item.id} className="queue-item">
              <span className="n">#{index + 1}</span>
              <div className="queue-item-info">
                <span className="a">{item.tokenMint.slice(0, 4)}...{item.tokenMint.slice(-4)}</span>
                <span className="wait">~{waitTime(index)}</span>
              </div>
              <span className="wait">{tierLabel(item.priorityLevel)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
