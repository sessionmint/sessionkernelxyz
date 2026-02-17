# SessionMint - ChartGoBrrAlpha

Production-hardened Next.js app for chart session leasing with:
- Phantom wallet payments (SOL / MINSTR)
- Strict on-chain payment verification
- Firestore canonical queue/state
- Cloud Tasks + Scheduler-friendly deterministic ticking
- Continuous Autoblow movement for default and paid states

## Tech Stack
- Next.js App Router
- React 19
- TypeScript
- Firebase Admin (Firestore)
- Google Cloud Tasks
- Solana Web3 + SPL Token

## Yarn Commands
```bash
yarn install
yarn dev
yarn lint
yarn typecheck
yarn build
yarn start
```

## Deployment Model
- Production deploys are **GitHub -> Firebase App Hosting backend**.
- Local machine is for development and ngrok validation only.
- Do not treat local `firebase deploy` as the primary production path.

GitHub rollout flow:
1. Connect repository in Firebase App Hosting.
2. Select deployment branch (default `main`).
3. Configure env vars and secrets in the App Hosting backend.
4. Push to branch to trigger rollout.

## Environment Setup
Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Important groups:
- **Public (`NEXT_PUBLIC_*`)**: wallet destination, default token, livestream URL, client feature flags.
- **Server-only**: Autoblow device token, Helius backend key, Cloud Tasks/Firebase settings, `CRON_SECRET`.

For local ngrok testing, keep `.env.local` populated with:
- `FIREBASE_PROJECT_ID`
- `FIRESTORE_DATABASE_ID` (`(default)` or named DB like `sessionkernelxyz`)
- `GOOGLE_CLOUD_REGION`
- `STATE_TICK_QUEUE_ID`
- `CRON_SECRET`
- `HELIUS_API_KEY`
- `NEXT_PUBLIC_HELIUS_RPC_URL` (or `NEXT_PUBLIC_HELIUS_API_KEY`)

## Required Runtime Variables (App Hosting / Cloud Run)
- `FIREBASE_PROJECT_ID`
- `FIRESTORE_DATABASE_ID`
- `GOOGLE_CLOUD_REGION`
- `STATE_TICK_QUEUE_ID`
- `CRON_SECRET`
- `AUTOBLOW_DEVICE_TOKEN` (if Autoblow enabled)

## Helius Usage
- Current app uses Helius for RPC/payment verification.
- There is currently **no inbound Helius webhook consumer route** in this repo.
- Helius webhooks are optional and should target an external receiver (or a future dedicated route).

## API Overview
- `POST /api/queue/precheck`  
  Validate token and tier eligibility before user sends payment.

- `POST /api/queue/add`  
  Strictly verifies on-chain transfer (recipient, amount, mint, signer, replay), then enqueues in Firestore transaction.

- `POST /api/queue/check-cooldown`  
  Backwards-compatible cooldown endpoint with explicit invalid-token behavior.

- `GET /api/state`  
  Returns canonical app snapshot from Firestore.

- `GET /api/state/stream`  
  SSE stream backed by Firestore revision polling.

- `POST /api/state/tick`  
  Protected deterministic transition endpoint (`x-cron-secret` required).  
  Used by Cloud Tasks and Cloud Scheduler watchdog.

- `GET|POST|PUT /api/autoblow`  
  Proxy for Autoblow device control; device token stays server-side.

## Firestore Canonical Paths
- `sessions/chartgobrralpha`
- `sessions/chartgobrralpha/queue/{queueItemId}`
- `sessions/chartgobrralpha/cooldowns/{tokenMint}`
- `sessions/chartgobrralpha/receipts/{txSig}`

## Deterministic Expiry Model
1. Queue activation writes active state in Firestore transaction.
2. Activation schedules a Cloud Task for `expiresAt` -> `POST /api/state/tick`.
3. Cloud Scheduler can also call `POST /api/state/tick` as watchdog.
4. Tick is idempotent (duplicate calls are safe).

## Firebase App Hosting Notes
- `apphosting.yaml` controls runtime sizing.
- Keep secrets in App Hosting env/secrets, not in source files.
- Configure Cloud Tasks queue matching `STATE_TICK_QUEUE_ID`.
- Configure Cloud Scheduler to hit `/api/state/tick` with `x-cron-secret`.

## Local ngrok Testing
```bash
yarn dev
ngrok http 3000
```

Use the ngrok URL for remote callbacks/tests. Important checks:
- `GET /api/state`
- `GET /api/state/stream`
- `POST /api/queue/precheck`
- `POST /api/state/tick` with `x-cron-secret: <CRON_SECRET>`

## Verification Checklist
Run locally before deployment:
```bash
yarn lint
yarn typecheck
yarn build
```

Then validate flows:
- valid SOL payment queues once
- valid MINSTR payment queues once
- replay signature rejected
- wrong recipient/mint/amount rejected
- queue persists across restart (Firestore-backed)
- default token still keeps Autoblow moving
