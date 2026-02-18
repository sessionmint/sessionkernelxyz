# exwhyzee.fun — DNS Configuration Guide
## Firebase App Hosting Custom Domain Setup

**App Hosting Backend:** `sessionkernelxyz` (us-east4)  
**Live Cloud Run URL:** `https://sessionkernelxyz-3u5q4h7zvq-uk.a.run.app`  
**App Hosting Default URL:** `https://sessionkernelxyz--sessionkernelxyz.us-east4.hosted.app`  
**Registrar:** Namecheap  
**Generated:** 2026-02-18

---

## ⚠️ Required DNS Changes at Namecheap

### 1. Root Domain: `exwhyzee.fun`

| Action | Type | Host | Value |
|--------|------|------|-------|
| ❌ **REMOVE** | A | `@` | `162.255.119.27` |
| ✅ **ADD** | A | `@` | `35.219.200.203` |
| ✅ **ADD** | TXT | `@` | `fah-claim=023-02-303f195a-bfe9-4d13-abff-46bf2c26bc58` |
| ✅ **KEEP** | TXT | `@` | `v=spf1 include:spf.efwd.registrar-servers.com ~all` |

### 2. WWW Subdomain: `www.exwhyzee.fun`

| Action | Type | Host | Value |
|--------|------|------|-------|
| ❌ **REMOVE** | CNAME | `www` | `parkingpage.namecheap.com` |
| ✅ **ADD** | A | `www` | `35.219.200.203` |
| ✅ **ADD** | TXT | `www` | `fah-claim=023-02-d986e774-ce88-411b-99b3-f659d38b3c76` |

### 3. SSL Certificate ACME Challenge (shared by both domains)

| Action | Type | Host | Value |
|--------|------|------|-------|
| ✅ **ADD** | CNAME | `_acme-challenge_67w7b3voeym4z3gv` | `fe005815-2f10-4ac9-a59f-773d6434d264.10.authorize.certificatemanager.goog.` |

> **Note:** The CNAME host at Namecheap should be entered as `_acme-challenge_67w7b3voeym4z3gv` (without the `.exwhyzee.fun.` suffix — Namecheap adds the root domain automatically). The value must include the trailing dot or Namecheap will add the root domain — enter it exactly as shown.

---

## 📋 Step-by-Step Namecheap Instructions

1. Log in to Namecheap → **Domain List** → `exwhyzee.fun` → **Manage**
2. Click **Advanced DNS** tab
3. **Delete** the existing A record pointing to `162.255.119.27`
4. **Delete** the existing CNAME `www` → `parkingpage.namecheap.com`
5. **Add** the following records (use **Add New Record** button):

   - **Type:** A Record | **Host:** `@` | **Value:** `35.219.200.203` | **TTL:** Automatic
   - **Type:** TXT Record | **Host:** `@` | **Value:** `fah-claim=023-02-303f195a-bfe9-4d13-abff-46bf2c26bc58` | **TTL:** Automatic
   - **Type:** A Record | **Host:** `www` | **Value:** `35.219.200.203` | **TTL:** Automatic
   - **Type:** TXT Record | **Host:** `www` | **Value:** `fah-claim=023-02-d986e774-ce88-411b-99b3-f659d38b3c76` | **TTL:** Automatic
   - **Type:** CNAME Record | **Host:** `_acme-challenge_67w7b3voeym4z3gv` | **Value:** `fe005815-2f10-4ac9-a59f-773d6434d264.10.authorize.certificatemanager.goog.` | **TTL:** Automatic

6. Save all changes.

---

## ⏱️ Propagation Timeline

| Stage | Expected Time |
|-------|--------------|
| DNS propagation | 15 min – 1 hour |
| Firebase ownership verification | 5–15 min after DNS propagates |
| SSL certificate provisioning | 15–30 min after ownership verified |
| Domain fully live | ~1–2 hours total |

---

## ✅ Verification Commands (run after DNS propagates)

```powershell
# Check A record
nslookup exwhyzee.fun

# Check TXT ownership record
nslookup -type=TXT exwhyzee.fun

# Check ACME CNAME
nslookup -type=CNAME _acme-challenge_67w7b3voeym4z3gv.exwhyzee.fun

# Test API endpoint (once live)
Invoke-WebRequest -Uri "https://exwhyzee.fun/api/state" -UseBasicParsing | Select StatusCode
```

---

## 🔄 After Domain Is Live

Once `https://exwhyzee.fun` resolves to the app, update the Cloud Scheduler watchdog job:

```bash
$cleanStr = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes("$env:TEMP\cron_clean.txt"))
gcloud scheduler jobs update http sessionkernel-tick-watchdog `
  --location=us-east4 `
  --project=sessionkernelxyz `
  --uri="https://exwhyzee.fun/api/state/tick" `
  --update-headers="x-cron-secret=$cleanStr"
```

Or run the pre-written update command in DEPLOYMENT_POSTDNS.md.

---

## 📊 Infrastructure Status Summary

| Component | Status | Details |
|-----------|--------|---------|
| Firebase Project | ✅ ACTIVE | `sessionkernelxyz` |
| App Hosting Backend | ✅ LIVE | `us-east4` |
| Cloud Run Service | ✅ HTTP 200 | `sessionkernelxyz-3u5q4h7zvq-uk.a.run.app` |
| Firestore Database | ✅ ACTIVE | `(default)`, native mode, `nam5` |
| Cloud Tasks Queue | ✅ RUNNING | `state-tick-queue` (us-east4) |
| Cloud Scheduler Watchdog | ✅ ENABLED | every minute → Cloud Run URL |
| Secret: HELIUS_API_KEY | ✅ SET | Secret Manager v1 |
| Secret: CRON_SECRET | ✅ SET | Secret Manager v2 (clean, no CRLF) |
| Secret: AUTOBLOW_DEVICE_TOKEN | ✅ SET | Secret Manager v1 |
| Secret: ADMIN_API_KEY | ✅ SET | Secret Manager v1 |
| IAM: cloudtasks.enqueuer | ✅ GRANTED | `firebase-app-hosting-compute` SA |
| IAM: secretmanager.secretAccessor | ✅ GRANTED | `firebase-app-hosting-compute` SA |
| Custom Domain: exwhyzee.fun | ⏳ PENDING DNS | Add records at Namecheap |
| Custom Domain: www.exwhyzee.fun | ⏳ PENDING DNS | Add records at Namecheap |
| SSL Certificate | ⏳ CERT_VALIDATING | Auto-provisioned after DNS verified |
