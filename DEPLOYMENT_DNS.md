# exwhyzee.fun — DNS Configuration Guide
## Firebase App Hosting Custom Domain Setup

**App Hosting Backend:** `sessionkernelxyz` (us-east4)  
**App Hosting Default URL:** `https://sessionkernelxyz--sessionkernelxyz.us-east4.hosted.app`  
**Registrar:** Namecheap  
**Generated:** 2026-02-18 (new backend — tokens updated)

---

## ⚠️ Step 1 — Connect GitHub Repo in Firebase Console (REQUIRED FIRST)

The backend must be connected to GitHub before it can serve traffic from a GitHub-driven deploy.

1. Open: **https://console.firebase.google.com/project/sessionkernelxyz/apphosting**
2. Click the `sessionkernelxyz` backend
3. Click **"Connect repository"** (or "Set up GitHub")
4. Install the **Firebase GitHub App** on the `sessionmint` GitHub account
5. Select repository: **`sessionmint/sessionkernelxyz`**
6. Select branch: **`main`**
7. Root directory: **`/`**
8. Click **Save** — Firebase will trigger the first build automatically

Once connected, every push to `main` on `https://github.com/sessionmint/sessionkernelxyz` will trigger a new deployment.

---

## ⚠️ Step 2 — Required DNS Changes at Namecheap

### 1. Root Domain: `exwhyzee.fun`

| Action | Type | Host | Value |
|--------|------|------|-------|
| ❌ **REMOVE** | A | `@` | `162.255.119.27` |
| ✅ **ADD** | A | `@` | `35.219.200.203` |
| ✅ **ADD** | TXT | `@` | `fah-claim=023-02-825cb319-0b62-4d0d-b53f-79c103e659ec` |
| ✅ **KEEP** | TXT | `@` | `v=spf1 include:spf.efwd.registrar-servers.com ~all` |

### 2. WWW Subdomain: `www.exwhyzee.fun`

| Action | Type | Host | Value |
|--------|------|------|-------|
| ❌ **REMOVE** | CNAME | `www` | `parkingpage.namecheap.com` |
| ✅ **ADD** | A | `www` | `35.219.200.203` |
| ✅ **ADD** | TXT | `www` | `fah-claim=023-02-e42b09e7-ef44-49cd-82e7-6c5febc5701b` |

### 3. SSL Certificate ACME Challenge (shared by both domains)

| Action | Type | Host | Value |
|--------|------|------|-------|
| ✅ **ADD** | CNAME | `_acme-challenge_67w7b3voeym4z3gv` | `fe005815-2f10-4ac9-a59f-773d6434d264.10.authorize.certificatemanager.goog.` |

> **Namecheap note:** Enter the CNAME host as `_acme-challenge_67w7b3voeym4z3gv` (Namecheap appends the root domain). Enter the CNAME value exactly as shown including the trailing dot.

---

## 📋 Namecheap Step-by-Step

1. Log in to Namecheap → **Domain List** → `exwhyzee.fun` → **Manage** → **Advanced DNS**
2. **Delete:** A record `162.255.119.27`
3. **Delete:** CNAME `www` → `parkingpage.namecheap.com`
4. **Add** the following records:

   | Type | Host | Value | TTL |
   |------|------|-------|-----|
   | A Record | `@` | `35.219.200.203` | Automatic |
   | TXT Record | `@` | `fah-claim=023-02-825cb319-0b62-4d0d-b53f-79c103e659ec` | Automatic |
   | A Record | `www` | `35.219.200.203` | Automatic |
   | TXT Record | `www` | `fah-claim=023-02-e42b09e7-ef44-49cd-82e7-6c5febc5701b` | Automatic |
   | CNAME Record | `_acme-challenge_67w7b3voeym4z3gv` | `fe005815-2f10-4ac9-a59f-773d6434d264.10.authorize.certificatemanager.goog.` | Automatic |

5. Save all changes.

---

## ⏱️ Propagation Timeline

| Stage | Expected Time |
|-------|--------------|
| DNS propagation | 15 min – 1 hour |
| Firebase ownership verification | 5–15 min after DNS propagates |
| SSL certificate provisioning | 15–30 min after ownership verified |
| Domain fully live | ~1–2 hours total |

---

## ✅ Verification Commands

```powershell
# Check A record resolves to Firebase
nslookup exwhyzee.fun

# Check TXT ownership record
nslookup -type=TXT exwhyzee.fun

# Check ACME CNAME
nslookup -type=CNAME _acme-challenge_67w7b3voeym4z3gv.exwhyzee.fun

# Test app once live
Invoke-WebRequest -Uri "https://exwhyzee.fun/api/state" -UseBasicParsing | Select StatusCode
```

---

## 📊 Infrastructure Status Summary

| Component | Status | Details |
|-----------|--------|---------|
| Firebase Project | ✅ ACTIVE | `sessionkernelxyz` |
| App Hosting Backend | ✅ CREATED | `us-east4`, needs GitHub connection |
| GitHub Connection | ⚠️ PENDING | Connect via Firebase Console (Step 1 above) |
| Firestore Database | ✅ ACTIVE | `(default)`, native mode, `nam5` |
| Cloud Tasks Queue | ✅ RUNNING | `state-tick-queue` (us-east4) |
| Cloud Scheduler Watchdog | ✅ ENABLED | every minute → Cloud Run URL (update after domain live) |
| Secret: HELIUS_API_KEY | ✅ SET | Secret Manager v1 |
| Secret: CRON_SECRET | ✅ SET | Secret Manager v2 (clean, no CRLF) |
| Secret: AUTOBLOW_DEVICE_TOKEN | ✅ SET | Secret Manager v1 |
| Secret: ADMIN_API_KEY | ✅ SET | Secret Manager v1 |
| IAM: cloudtasks.enqueuer | ✅ GRANTED | `firebase-app-hosting-compute` SA |
| IAM: secretmanager.secretAccessor | ✅ GRANTED | `firebase-app-hosting-compute` SA |
| Custom Domain: exwhyzee.fun | ⏳ PENDING DNS | Add records at Namecheap |
| Custom Domain: www.exwhyzee.fun | ⏳ PENDING DNS | Add records at Namecheap |
| SSL Certificate | ⏳ CERT_VALIDATING | Auto-provisioned after DNS verified |
