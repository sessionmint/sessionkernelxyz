# Post-DNS Deployment Steps
## Run AFTER DNS propagates and exwhyzee.fun resolves correctly

---

## Step 1 — Verify DNS has propagated

```powershell
# A record should return 35.219.200.203
nslookup exwhyzee.fun

# TXT should include fah-claim token for xyzsessionkernel
nslookup -type=TXT exwhyzee.fun

# ACME CNAME should resolve
nslookup -type=CNAME _acme-challenge_67w7b3voeym4z3gv.exwhyzee.fun
```

---

## Step 2 — Verify app is live on exwhyzee.fun

```powershell
Invoke-WebRequest -Uri "https://exwhyzee.fun/api/state" -UseBasicParsing | Select-Object StatusCode
# Expected: 200
```

---

## Step 3 — Update Cloud Scheduler to target exwhyzee.fun

```powershell
gcloud scheduler jobs update http sessionkernel-tick-watchdog `
  --location=us-east4 `
  --project=sessionkernelxyz `
  --uri="https://exwhyzee.fun/api/state/tick"

# Verify
gcloud scheduler jobs describe sessionkernel-tick-watchdog --location=us-east4 --project=sessionkernelxyz
```

---

## Step 4 — Test tick endpoint on live domain

```powershell
$bytes = [System.IO.File]::ReadAllBytes("$env:TEMP\cron_clean.txt")
$cleanStr = [System.Text.Encoding]::ASCII.GetString($bytes[0..63])

$resp = Invoke-RestMethod `
  -Uri "https://exwhyzee.fun/api/state/tick" `
  -Method POST `
  -Headers @{ "Content-Type"="application/json"; "x-cron-secret"=$cleanStr } `
  -Body '{"reason":"manual"}'

$resp | ConvertTo-Json
# Expected: { "success": true, ... }
```

---

## Step 5 — Full endpoint verification

```powershell
# 1. State snapshot
Invoke-WebRequest -Uri "https://exwhyzee.fun/api/state" -UseBasicParsing | Select StatusCode, @{N="Body";E={$_.Content.Substring(0,100)}}

# 2. Queue precheck (expect 400 without body, not 500)
try { Invoke-WebRequest -Uri "https://exwhyzee.fun/api/queue/precheck" -Method POST -UseBasicParsing }
catch { Write-Host "Status: $($_.Exception.Response.StatusCode)" }

# 3. Tick unauthorized (expect 401)
try { Invoke-WebRequest -Uri "https://exwhyzee.fun/api/state/tick" -Method POST -UseBasicParsing }
catch { Write-Host "Status: $($_.Exception.Response.StatusCode)" }

# 4. Tick authorized (expect 200)
$bytes = [System.IO.File]::ReadAllBytes("$env:TEMP\cron_clean.txt")
$cleanStr = [System.Text.Encoding]::ASCII.GetString($bytes[0..63])
Invoke-WebRequest -Uri "https://exwhyzee.fun/api/state/tick" -Method POST `
  -Headers @{ "Content-Type"="application/json"; "x-cron-secret"=$cleanStr } `
  -Body '{"reason":"manual"}' -UseBasicParsing | Select StatusCode
```

---

## Step 6 — Final checklist

- [ ] `https://exwhyzee.fun` loads the app in browser
- [ ] `https://www.exwhyzee.fun` redirects/loads app
- [ ] SSL padlock shows (no certificate warnings)
- [ ] `/api/state` returns JSON with `session` data
- [ ] `/api/state/stream` SSE stream connects and holds open
- [ ] `/api/state/tick` with correct header returns `{ "success": true }`
- [ ] `/api/state/tick` without header returns 401
- [ ] Cloud Scheduler watchdog job updated to exwhyzee.fun URI
- [ ] Phantom wallet connects in browser
- [ ] Queue precheck returns correct validation response
