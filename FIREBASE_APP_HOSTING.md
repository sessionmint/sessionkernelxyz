# Firebase App Hosting Deployment Guide (GitHub-driven)

This project deploys to Firebase App Hosting from GitHub, not from local deploy commands.

## 1) Deployment model (source of truth)
1. Connect this repo in Firebase App Hosting.
2. Choose deployment branch (default `main`).
3. Configure env vars + secrets in the App Hosting backend.
4. Push commits to branch to trigger rollout.

`apphosting.yaml` controls runtime shape in the backend environment.

## 2) Runtime env/secrets
Set these in App Hosting backend config:

Public:
- `NEXT_PUBLIC_TREASURY_WALLET`
- `NEXT_PUBLIC_DEFAULT_TOKEN_MINT`
- `NEXT_PUBLIC_PHANTOM_APP_ID`
- `NEXT_PUBLIC_LIVESTREAM_URL`
- `NEXT_PUBLIC_HELIUS_RPC_URL` or `NEXT_PUBLIC_HELIUS_API_KEY`
- `NEXT_PUBLIC_AUTOBLOW_ENABLED`

Server-only:
- `HELIUS_API_KEY`
- `AUTOBLOW_ENABLED`
- `AUTOBLOW_API_URL`
- `AUTOBLOW_DEVICE_TOKEN`
- `AUTOBLOW_TIMEOUT_MS`
- `FIREBASE_PROJECT_ID`
- `FIRESTORE_DATABASE_ID` (`(default)` or named DB like `sessionkernelxyz`)
- `GOOGLE_CLOUD_REGION`
- `STATE_TICK_QUEUE_ID`
- `CRON_SECRET`
- `ADMIN_API_KEY` (optional)
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` (optional)

## 3) Cloud Tasks + Scheduler
Create Cloud Tasks queue in `GOOGLE_CLOUD_REGION` and set:
- `STATE_TICK_QUEUE_ID=<queue-name>`

Task target:
- `POST https://<app-domain>/api/state/tick`
- Header: `x-cron-secret: <CRON_SECRET>`
- Body: `{"reason":"cloud-task"}`

Scheduler watchdog (recommended, e.g. every minute):
- `POST https://<app-domain>/api/state/tick`
- Header: `x-cron-secret: <CRON_SECRET>`
- Body: `{"reason":"scheduler"}`

## 4) Local ngrok testing (no production deploy)
```bash
yarn dev
ngrok http 3000
```

Verify through localhost and ngrok URL:
- `GET /api/state`
- `GET /api/state/stream`
- `POST /api/queue/precheck`
- `POST /api/queue/add`
- `POST /api/state/tick` with header `x-cron-secret: <CRON_SECRET>`
- `GET /api/autoblow`

Example tick test:
```bash
curl -X POST "https://<your-ngrok-url>/api/state/tick" ^
  -H "Content-Type: application/json" ^
  -H "x-cron-secret: <CRON_SECRET>" ^
  -d "{\"reason\":\"manual\"}"
```

## 5) Helius guidance
- Current app uses Helius for RPC/payment verification.
- There is no inbound Helius webhook endpoint in this repo today.
- If you create Helius webhooks now, point them to an external receiver:
  - local: ngrok HTTPS receiver URL
  - production: stable HTTPS receiver URL
- Configure webhook auth header and validate it on that receiver.

## 6) Security notes
- Device token stays server-side.
- Queue insertion requires strict on-chain verification.
- Transaction replay protection is persisted in Firestore.
