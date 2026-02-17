# SessionMint.fun — Hackathon Implementation Plan

## Internal Project Name: SessionKernel
## Public Website: SessionMint.fun

## Core Logic: Session State Architecture

### Base stream vs Session State
- Each app page ALWAYS renders an embedded live stream as the **BACKGROUND layer**.
- **Session State** is the **OVERLAY** rendered ABOVE the stream.
- Session State is the product: users pay to set what is displayed as the overlay for a time window.

### Session State types
Session State is a structured object, not HTML:
- `type: "chart"` → overlay shows a Dexscreener chart for `tokenMint` + intent (`buy|sell`).
- `type: "entertainment"` → overlay shows an allowlisted embed URL (YouTube/Kick/Twitch/X/etc).
- `type: "game"` → overlay shows an app-specific interactive UI (hot/not, strike meter, vote panels).

### Canonical sources of truth
- Firestore is canonical. The UI derives from Firestore snapshots.
- The server enforces time/expiry via tick endpoints. Never trust client timers.
- All "who is active" decisions (queue promotion, expiry, seat expiry) are done server-side using Firestore transactions.

### Every app has a different stream
- Each app has its own streamer and thus its own `streamUrl`.
- The `streamUrl` must be stored per app session (`/sessions/{appId}.streamUrl`) and treated as background-only.

## Global Constraints (Non-negotiable)

- Next.js App Router only; deploy only to Firebase App Hosting.
- All API routes: `app/api/**/route.ts`.
- Wallet: Phantom Browser SDK only (`@phantom/browser-sdk`). Remove Solana Wallet Adapter and WalletConnect.
- No backdoors: no client isAdmin/operator flags, no fake txSig bypass.
- Firestore transactions for:
  - receipts anti-replay
  - queue enqueue + activation + promotion
  - seat assignment + expiry
  - embed set/clear + active select
  - game actions that must be seat-gated
- URL validation: accept URLs only, normalize embeds, allowlist domains, https only.

## Data Model (Firestore Canonical)

Use `appId` as the sessionId initially for simplicity.

### /sessions/{appId}
```
{
  appId: "chartgobrralpha"|"chartgobrrkernel"|"streamgobrrr"|"kachingornot"|"onlykachings"|"kachingstrike",
  status: "live"|"ended",

  // Stream background (each app has its own streamer)
  stream: {
    streamUrl: string,         // background embed URL
    ownerWallet?: string,      // streamer wallet (for later "stream for sale")
    isStreamForSale?: boolean, // kernel testing feature
    streamPrice?: { solLamports: string, minstrAmount?: string },
    streamLeaseDurationSec?: number
  },

  // Pricing defaults
  pricing: {
    sessionState: { solLamports: string, minstrAmount: string }, // default 0.01 SOL + 10,000 MINSTR where enabled
    seat?: { solLamports: string, minstrAmount?: string }        // seat apps default 0.01 SOL (MINSTR optional later)
  },

  seatCount: 0|4,
  seatDurationSec?: number,

  // The overlay currently displayed
  activeState: {
    type: "chart"|"entertainment"|"game",
    source: "streamer"|"viewer"|"seat"|"operator",
    seatIndex?: 1|2|3|4,

    // for chart
    tokenMint?: string,
    intent?: "buy"|"sell",

    // for entertainment
    playUrl?: string,
    kind?: "youtube"|"twitch"|"kick"|"x"|"generic",

    // expiry / control
    startedAt?: Timestamp,
    expiresAt?: Timestamp
  },

  // Defaults (used when queue empty or seat expires)
  defaults: {
    defaultTokenMint?: string,   // for chart apps
    defaultOverlay?: { type:"chart"|"entertainment", tokenMint?:string, playUrl?:string, intent?:"buy"|"sell", kind?:string }
  },

  updatedAt: Timestamp
}
```

### /sessions/{appId}/stateQueue/{stateId}
```
{
  stateId,
  buyerWallet: string,
  type: "chart"|"entertainment",   // for now, chart primarily (entertainment used in StreamGoBrrr if needed)
  tokenMint?: string,
  intent?: "buy"|"sell",
  playUrl?: string,
  kind?: string,

  durationSec: number,
  status: "queued"|"active"|"expired"|"canceled",
  startsAt?: Timestamp,
  expiresAt?: Timestamp,

  payment: {
    method: "SOL"|"MINSTR",
    amount: string,         // lamports or token amount as string
    receiptTxSig: string
  },

  createdAt: Timestamp
}
```

### /receipts/{txSig}
```
{
  txSig,
  payer: string,
  purpose: "session_state"|"seat"|"stream_lease",
  appId: string,
  method: "SOL"|"MINSTR",
  amount: string,
  createdAt: Timestamp
}
```

### Seats (seat apps only): /sessions/{appId}/seats/{seatIndex}
```
{
  seatIndex: 1|2|3|4,
  wallet: string,
  expiresAt: Timestamp,
  createdAt: Timestamp
}
```

### Embeds (StreamGoBrrr): /sessions/{appId}/embeds/{slotIndex}
```
{
  slotIndex: 1|2|3|4,
  ownerWallet: string,
  playUrl: string,
  kind: string,
  updatedAt: Timestamp
}
```

### KachingOrNot votes: /sessions/{appId}/votes/{voteId}
```
{
  voteId,
  seatIndex: 1|2|3|4,
  voterWallet: string,
  choice: "hot"|"not",
  createdAt: Timestamp
}
```

### OnlyKachings actions: /sessions/{appId}/actions/{actionId}
(real gameplay)
```
{
  actionId,
  seatIndex: 1|2|3|4,
  wallet: string,
  action: "KACH"|"NO_KACH",
  createdAt: Timestamp
}
```

### KachingStrike rounds: /sessions/{appId}/rounds/{roundId}
(real gameplay)
```
{
  roundId,
  startedAt: Timestamp,
  endsAt: Timestamp,
  status: "live"|"ended",
  tally: { strike: number, chill: number },
  createdAt: Timestamp
}
```
and votes:
- /sessions/{appId}/rounds/{roundId}/votes/{voteId}
```{ seatIndex, wallet, choice:"strike"|"chill", createdAt }```

## Implementation Plan

### Phase 0: Static Homepage (Hours 1-2)

#### Static Page Setup
- [ ] Create simple static homepage for SessionMint.fun
- [ ] Add navigation links to all 6 applications
- [ ] Include basic description of the platform
- [ ] Ensure responsive design works across all devices

### Phase 1: ChartGoBrrAlpha Implementation (Hours 3-14)
**CRITICAL: This must be online and ready first**

#### UI Component Implementation (Hours 3-8)
- [ ] Create basic dashboard layout with stream and chart layers
- [ ] Implement stream embed component using iframe
- [ ] Create chart embed using DexScreener iframe
- [ ] Build sidebar with session state purchase module
- [ ] Implement queue list component showing pending states
- [ ] Add active state display showing current overlay
- [ ] Implement proper micro-interactions and hover states for all interactive elements
- [ ] Add toast notifications using sonner with proper positioning
- [ ] Ensure responsive design works across all screen sizes

#### Payment System Implementation (Hours 9-14)
- [ ] Create token mint input field with validation against known tokens
- [ ] Implement intent toggle (BUY/SELL)
- [ ] Add SOL payment options (0.01 SOL default)
- [ ] Add MINSTR payment options (10,000 MINSTR) - LIVE TOKEN, not mock
- [ ] Implement transaction signing using Phantom SDK
- [ ] Create payment processing logic for SOL with proper error handling
- [ ] Create payment processing logic for MINSTR with proper error handling
- [ ] Implement receipt validation in Firestore
- [ ] Add transaction simulation before submission to estimate compute units
- [ ] Implement proper transaction landing strategies (compute budget, priority fees)
- [ ] Ensure transfer_checked instruction is used for Token-2022 instead of transfer (critical for MINSTR)
- [ ] Add proper arithmetic using checked_add, checked_sub, etc. instead of raw operators

### Phase 2: Foundation Setup (Hours 15-18)

#### Setup and Configuration
- [ ] Fork and clone the Builderz scaffold
- [ ] Update package.json to remove Solana Wallet Adapter dependencies
- [ ] Add Phantom Browser SDK dependency (`@phantom/browser-sdk`)
- [ ] Set up basic environment variables for Phantom, Firebase, and Helius RPC
- [ ] Install additional dependencies as needed
- [ ] Configure Firebase App Hosting deployment
- [ ] Set up Firestore database with proper indexes
- [ ] Install shadcn/ui components and configure Tailwind CSS 4.0

#### Shared Libraries Setup
- [ ] Create `/lib/types.ts` — shared types for sessions, queue, seats, receipts, votes
- [ ] Create `/lib/db.ts` — Firestore init + helpers
- [ ] Create `/lib/embed.ts` — url allowlist + normalization + kind inference
- [ ] Create `/lib/payments/sol.ts` — SOL transfer build helpers (client) + server verify parser
- [ ] Create `/lib/payments/minstr.ts` — MINSTR token transfer build helpers + server verify parser
- [ ] Create `/lib/kernel/transitions.ts` — promotion/expiry logic
- [ ] Create `/lib/kernel/policy.ts` — app-specific rules (seatCount, allowed overlay types, vote rules)
- [ ] Create `/lib/auth.ts` — cron secret checks + optional operator signed-message verification

### Phase 3: ChartGoBrrKernel Implementation (Hours 19-26)

#### Kernel Architecture Implementation (Hours 19-22)
- [ ] Implement deterministic tick/expiry/promotion logic
- [ ] Create server-side transaction verification using Helius RPC
- [ ] Implement receipts anti-replay mechanism
- [ ] Create seat mechanics (seat buy/list + expiry)
- [ ] Implement stream leasing scaffolding (for streamer purchase/testing)
- [ ] Add proper validation for all kernel operations

#### Kernel Endpoints Implementation (Hours 23-26)
- [ ] POST `/api/session/start` — create/ensure `/sessions/{appId}` with defaults
- [ ] POST `/api/tx/verify` — verify SOL/MINSTR tx + write `/receipts/{txSig}` (anti replay)
- [ ] POST `/api/state/buy` — enqueue chart/entertainment session states (requires verified receipt)
- [ ] POST `/api/state/tick` — CRON_SECRET protected; runs deterministic tick
- [ ] POST `/api/seat/buy` — seat purchase (seat apps) requires verified receipt; assigns seat
- [ ] GET  `/api/seat/list` — list active seats
- [ ] POST `/api/stream/lease` — streamer pays to lease stream placement (kernel testing feature)

### Phase 4: StreamGoBrrr Implementation (Hours 27-34)

#### Seat System Implementation (Hours 27-30)
- [ ] Create 4-seat system (seat indices 1-4) with proper validation
- [ ] Implement seat purchase functionality with SOL payments
- [ ] Add seat expiration handling using kernel tick system
- [ ] Create seat assignment logic with proper locking
- [ ] Implement seat clearing on expiration
- [ ] Add proper validation for seat operations with access controls

#### Entertainment URL System (Hours 31-33)
- [ ] Create URL validation for YouTube/Kick/Twitch/X/generic with security checks
- [ ] Implement URL normalization and kind inference
- [ ] Create embed component for entertainment content with security
- [ ] Implement URL setting/clearing by seat holders with validation
- [ ] Add security measures to prevent malicious embeds

#### Active Overlay Selection (Hour 34)
- [ ] Implement operator controls to select active overlay source
- [ ] Create UI for selecting between streamer default and seat embeds
- [ ] Add proper authorization for operator functions
- [ ] Implement dummy gameplay "Hype" button for seat holders
- [ ] POST `/api/streamgobrrr/embeds/set`
- [ ] POST `/api/streamgobrrr/embeds/clear`
- [ ] POST `/api/streamgobrrr/active/select`
- [ ] POST `/api/streamgobrrr/hype` (dummy gameplay; seat-gated)

### Phase 5: KachingOrNot Implementation (Hours 35-40)

#### Seat-Gated Voting System (Hours 35-37)
- [ ] Create voting interface for Hot/Not with proper UX
- [ ] Implement seat-gated voting access with validation
- [ ] Add vote persistence to Firestore with proper indexing
- [ ] Create vote history tracking and display
- [ ] Implement vote tallying system with real-time updates
- [ ] Add streak counter functionality for consecutive votes
- [ ] POST `/api/kachingornot/vote` (seat-gated)

#### Chart Overlay Integration (Hours 38-40)
- [ ] Integrate chart overlay with voting functionality
- [ ] Add voting controls to chart view with proper UX
- [ ] Implement real-time vote updates using Firestore listeners
- [ ] Create visual indicators for voting activity
- [ ] Integrate with existing payment system
- [ ] Implement combined functionality with session states
- [ ] GET `/api/kachingornot/votes` (optional)

### Phase 6: OnlyKachings Implementation (Hours 41-46)
**NOT A PLACEHOLDER - REAL GAMEPLAY IMPLEMENTATION REQUIRED**

#### Real Gameplay Implementation (Hours 41-44)
- [ ] Create "KACH" and "NO KACH" action buttons for seat holders
- [ ] Implement action persistence to Firestore with proper indexing
- [ ] Add rolling tally for actions in last 60 seconds
- [ ] Create "heat bar" visualization for action intensity
- [ ] Implement seat-gated access controls for actions
- [ ] POST `/api/onlykachings/action` (seat-gated)

#### Integration with Kernel (Hours 45-46)
- [ ] Extend kernel architecture to support action-specific state
- [ ] Add action-specific policy rules
- [ ] Integrate with existing payment system
- [ ] Implement combined functionality with session states

### Phase 7: KachingStrike Implementation (Hours 47-52)
**NOT A PLACEHOLDER - REAL GAMEPLAY IMPLEMENTATION REQUIRED**

#### Round-Based Voting System (Hours 47-50)
- [ ] Create round-based voting system with timed rounds (e.g., 60s rounds)
- [ ] Implement server-side round creation and management
- [ ] Add seat-gated voting for "STRIKE" or "CHILL" during rounds
- [ ] Create round tallying and results display
- [ ] Implement round countdown timer using Firestore timestamps
- [ ] POST `/api/kachingstrike/vote` (seat-gated)

#### Integration with Kernel (Hours 51-52)
- [ ] Extend kernel architecture to support round-specific state
- [ ] Add round-specific policy rules
- [ ] Integrate with existing payment system
- [ ] Implement combined functionality with session states

### Phase 8: Final Integration and Testing (Hours 53-60)

#### Demo Preparation (Hours 53-60)
- [ ] Test all applications work together seamlessly
- [ ] Create smooth demo flow for presentation
- [ ] Document key features and architecture
- [ ] Prepare pitch and slides highlighting SessionMint.fun concept
- [ ] Test on different devices/browsers
- [ ] Verify all critical path items work (wallet connection, SOL payments, queue system, real-time updates)
- [ ] Ensure all 6 applications are accessible and minimally functional
- [ ] Verify security measures are properly implemented
- [ ] Perform end-to-end testing of all payment methods (SOL and MINSTR)
- [ ] Verify all real-time features work properly

## Critical Success Metrics

### Core Functionality
- [ ] Working wallet connection via Phantom Browser SDK
- [ ] Successful SOL payment processing with proper verification
- [ ] Successful MINSTR payment processing with proper verification (LIVE TOKEN)
- [ ] Functional queue system with real-time updates
- [ ] All 6 applications accessible and minimally functional
- [ ] Smooth demo flow for presentation

### Technical Requirements
- [ ] Firestore as canonical data source with proper transactions
- [ ] Server-side transaction verification using Helius RPC
- [ ] Proper use of transfer_checked instruction for Token-2022 compatibility
- [ ] Deterministic kernel logic with proper state transitions
- [ ] Secure payment processing with anti-replay mechanisms

### User Experience
- [ ] Responsive design working across all screen sizes
- [ ] Proper loading/error/empty states everywhere
- [ ] Smooth real-time updates using Firestore listeners
- [ ] Intuitive navigation between applications
- [ ] Clear feedback for all user actions

## MINSTR Token Details (LIVE TOKEN - NOT MOCK)
- Token Name: SessionMint (MINSTR)
- Token Address: 2gWujYmBCd77Sf9gg6yMSexdPrudKpvss1yV8E71pump
- Decimals: 6
- Token Standard: Token-2022 (not SPL Token)
- Revenue Wallet: 4st6sXyHiTPpgp42egiz1r6WEEBLMcKYL5cpncwnEReg
- Payment Amounts: Standard (10,000 MINSTR), Priority (higher amount TBD)

## Helius Premium RPC Integration
- [ ] Use Helius premium RPC for transaction verification
- [ ] Implement webhooks for real-time transaction monitoring
- [ ] Add proper error handling for RPC failures
- [ ] Implement fallback mechanisms for RPC reliability

## Smart Contract Strategy
- No smart contracts will be deployed initially
- Group wallet functionality will be implemented as non-custodial in final implementation
- Phantom embedded wallets may be utilized for enhanced UX

## Time Management Strategy
- Hours 1-2: Static homepage
- Hours 3-14: ChartGoBrrAlpha (MUST BE ONLINE FIRST)
- Hours 15-18: Foundation setup
- Hours 19-26: Kernel architecture
- Hours 27-34: StreamGoBrrr seat system
- Hours 35-40: KachingOrNot voting system
- Hours 41-46: OnlyKachings gameplay (REAL IMPLEMENTATION)
- Hours 47-52: KachingStrike gameplay (REAL IMPLEMENTATION)
- Hours 53-60: Demo preparation and testing

Build efficiently, prioritize core functionality, and ensure the demo works flawlessly even if some features are simplified. Focus on demonstrating the core SessionMint.fun concept with clean, understandable code that judges can follow. The ChartGoBrrAlpha must be online and functional first as the flagship application.