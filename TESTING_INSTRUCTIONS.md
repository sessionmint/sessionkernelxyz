# ChartGoBrrAlpha Test Plan

## Deployment truth
- Production deploy path is GitHub -> Firebase App Hosting backend.
- This test plan is for local/preview validation only.

## 1) Setup
```bash
yarn install
yarn dev
```

Fill `.env.local` with required values before end-to-end checks.

## 1.1) ngrok setup
```bash
ngrok http 3000
```

Use the generated `https://...ngrok...` URL for remote callback tests.

## 2) Static Quality Gates
```bash
yarn lint
yarn typecheck
yarn build
```

## 3) API Smoke Tests

### State
- `GET /api/state` returns snapshot.
- `GET /api/state/stream` sends SSE `state` events + heartbeats.

### Queue Eligibility
- `POST /api/queue/precheck` with valid token returns allow flags.
- invalid token returns `ok: false`, `tokenValid: false`.

### Queue Add (strict verify)
- valid SOL payment tx -> `success: true`.
- valid MINSTR payment tx -> `success: true`.
- reused signature -> replay rejection.
- wrong recipient/mint/amount -> rejection.

### Tick
- `POST /api/state/tick` without `x-cron-secret` -> `401`.
- with correct secret -> deterministic transition result.
- Example:
  - `curl -X POST "http://localhost:3000/api/state/tick" -H "Content-Type: application/json" -H "x-cron-secret: <CRON_SECRET>" -d "{\"reason\":\"manual\"}"`

### Autoblow
- `GET /api/autoblow` checks connection.
- `POST /api/autoblow` sends movement parameters.
- verify default token and paid token both continue moving.

## 4) UI Functional Checks (`/chartgobrralpha`)
- Wallet connect/disconnect works.
- Token input precheck runs and blocks invalid token.
- Standard tier blocked when cooldown active; priority remains selectable.
- Successful payment queues token and reflects in queue list.
- Active token countdown and queue ordering update from state stream.
- No runaway sync loop in browser network panel.

## 5) Firebase/Cloud Runtime Checks
- Firestore documents persist queue/current state across restart.
- Cloud Task created on activation and fires near `expiresAt`.
- Scheduler watchdog can call `/api/state/tick` and safely re-run without corruption.

## 6) Helius checks
- Confirm browser RPC path works with either:
  - `NEXT_PUBLIC_HELIUS_RPC_URL`, or
  - `NEXT_PUBLIC_HELIUS_API_KEY`
- Confirm server verification path has `HELIUS_API_KEY`.
- Note: current app has no inbound Helius webhook endpoint; webhook tests must target an external receiver.
