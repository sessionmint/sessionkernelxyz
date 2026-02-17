# ChartGoBrrAlpha Integration Notes

## Deployment model
- Production rollout is GitHub -> Firebase App Hosting backend.
- Local environment + ngrok are for testing/integration only.
- Configure env/secrets in App Hosting backend (not in repo files).

## Autoblow Integration

Autoblow is now controlled only through server routes so device secrets stay server-side.

### Behavior
- Device remains active and moving for:
  - default token state
  - paid session state
- No default-token dampening branch is applied in API route.
- Frontend sync loop is throttled to avoid runaway request feedback.

### Required vars
```env
AUTOBLOW_ENABLED=true
NEXT_PUBLIC_AUTOBLOW_ENABLED=true
AUTOBLOW_API_URL=https://latency.autoblowapi.com
AUTOBLOW_DEVICE_TOKEN=...
AUTOBLOW_TIMEOUT_MS=10000
```

## Queue + Payment Integration

### Pre-check endpoint
- `POST /api/queue/precheck`
- Input: `{ tokenMint, paymentTier? }`
- Use before wallet payment/signing to prevent pay-then-fail cases.

### Queue endpoint
- `POST /api/queue/add`
- Strictly verifies transaction on-chain before queue write.
- Checks:
  - finalized + successful transaction
  - signer wallet matches caller wallet
  - recipient matches treasury
  - amount matches selected tier
  - MINSTR mint and destination ATA match
  - tx signature replay blocked in Firestore

## Deterministic State Progression
- Firestore is canonical state.
- `POST /api/state/tick` is idempotent transition executor.
- Cloud Tasks schedule exact expiry transition.
- Cloud Scheduler is watchdog fallback.

## Helius Integration and Webhook Guidance
- Current app uses Helius for RPC and transaction verification.
- There is no inbound Helius webhook route in this codebase right now.
- If webhook events are needed today, use an external HTTPS receiver:
  - local testing: ngrok URL
  - production: stable hosted endpoint
- Add authentication on the webhook receiver (authorization header/signature validation) before trusting payloads.
