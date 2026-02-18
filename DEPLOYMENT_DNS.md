# exwhyzee.fun — DNS Configuration Guide
## Firebase App Hosting Custom Domain Setup

**App Hosting Backend:** `xyzsessionkernel` (us-east4)  
**GitHub Repo:** `https://github.com/sessionmint/sessionkernelxyz` (branch: `main`)  
**App Hosting URL:** `https://xyzsessionkernel--sessionkernelxyz.us-east4.hosted.app`  
**Cloud Run URL:** `https://xyzsessionkernel-3u5q4h7zvq-uk.a.run.app`  
**Registrar:** Namecheap  
**Generated:** 2026-02-18 — final tokens for xyzsessionkernel backend

---

## ✅ GitHub Connection Status: CONNECTED

The backend `xyzsessionkernel` is GitHub-connected to `sessionmint/sessionkernelxyz` (branch `main`).  
Every push to `main` triggers an automatic deployment.  
First rollout: `rollout-2026-02-18-000 | SUCCEEDED`

---

## ⚠️ Required DNS Changes at Namecheap

### Current domain status
| Domain | Host | Ownership | SSL Cert |
|--------|------|-----------|----------|
| `exwhyzee.fun` | HOST_NON_FAH (A record points to wrong IP) | ✅ ACTIVE | VALIDATING |
| `www.exwhyzee.fun` | HOST_UNHOSTED (no A record) | ❌ MISSING | VALIDATING |

### 1. Root Domain: `exwhyzee.fun`

| Action | Type | Host | Value |
|--------|------|------|-------|
| ❌ **REMOVE** | A | `@` | `162.255.119.27` |
| ✅ **ADD** | A | `@` | `35.219.200.203` |
| ✅ **KEEP** | TXT | `@` | `fah-claim=023-02-fd9331eb-bbce-4f6e-983c-0913b4a54033` *(already verified)* |
| ✅ **KEEP** | TXT | `@` | `v=spf1 include:spf.efwd.registrar-servers.com ~all` |

> Ownership already ACTIVE — just need to swap the A record.

### 2. WWW Subdomain: `www.exwhyzee.fun`

| Action | Type | Host | Value |
|--------|------|------|-------|
| ❌ **REMOVE** | CNAME | `www` | `parkingpage.namecheap.com` |
| ✅ **ADD** | A | `www` | `35.219.200.203` |
| ✅ **ADD** | TXT | `www` | `fah-claim=023-02-99dcf579-2665-42b3-a796-7e84b604f72e` |

### 3. SSL Certificate ACME Challenge (shared by both domains)

| Action | Type | Host | Value |
|--------|------|------|-------|
| ✅ **ADD** | CNAME | `_acme-challenge_67w7b3voeym4z3gv` | `fe005815-2f10-4ac9-a59f-773d6434d264.10.authorize.certificatemanager.goog.` |

> **Namecheap note:** Enter the CNAME host as `_acme-challenge_67w7b3voeym4z3gv` (Namecheap appends the root domain automatically). Include the trailing dot in the CNAME value.

---

## 📋 Namecheap Step-by-Step

1. Log in to Namecheap → **Domain List** → `exwhyzee.fun` → **Manage** → **Advanced DNS**
2. **Delete:** A record pointing to `162.255.119.27`
3. **Delete:** CNAME `www` → `parkingpage.namecheap.com`
4. **Add** the following records:

   | Type | Host | Value | TTL |
   |------|------|-------|-----|
   | A Record | `@` | `35.219.200.203` | Automatic |
   | A Record | `www` | `35.219.200.203` | Automatic |
   | TXT Record | `www` | `fah-claim=023-02-99dcf579-2665-42b3-a796-7e84b604f72e` | Automatic |
   | CNAME Record | `_acme-challenge_67w7b3voeym4z3gv` | `fe005815-2f10-4ac9-a59f-773d6434d264.10.authorize.certificatemanager.goog.` | Automatic |

   *(The `@` TXT `fah-claim=023-02-fd9331eb-bbce-4f6e-983c-0913b4a54033` should already be present — verify it's there)*

5. Save all changes.

---

## ⏱️ Propagation Timeline

| Stage | Expected Time |
|-------|--------------|
| DNS propagation | 15 min – 1 hour |
| Firebase host verification | 5–15 min after DNS propagates |
| SSL certificate provisioning | 15–30 min after host verified |
| Domain fully live | ~1–2 hours total |

---

## ✅ Verification Commands

```powershell
# A record should return 35.219.200.203
nslookup exwhyzee.fun

# TXT should include fah-claim token
nslookup -type=TXT exwhyzee.fun

# ACME CNAME should resolve
nslookup -type=CNAME _acme-challenge_67w7b3voeym4z3gv.exwhyzee.fun

# Test app once live
Invoke-WebRequest -Uri "https://exwhyzee.fun/api/state" -UseBasicParsing | Select StatusCode
```

---

## 📊 Infrastructure Status

| Component | Status | Details |
|-----------|--------|---------|
| Firebase Project | ✅ ACTIVE | `sessionkernelxyz` |
| App Hosting Backend | ✅ LIVE | `xyzsessionkernel`, us-east4 |
| GitHub Connection | ✅ CONNECTED | `sessionmint/sessionkernelxyz`, branch `main` |
| First Rollout | ✅ SUCCEEDED | `rollout-2026-02-18-000` |
| Cloud Run Service | ✅ RUNNING | `xyzsessionkernel-3u5q4h7zvq-uk.a.run.app` |
| Firestore Database | ✅ ACTIVE | `(default)`, native mode |
| Cloud Tasks Queue | ✅ RUNNING | `state-tick-queue` (us-east4) |
| Cloud Scheduler Watchdog | ✅ ENABLED | every minute → `xyzsessionkernel--sessionkernelxyz.us-east4.hosted.app` |
| Secret: HELIUS_API_KEY | ✅ SET | Secret Manager |
| Secret: CRON_SECRET | ✅ SET | Secret Manager v2 (clean) |
| Secret: AUTOBLOW_DEVICE_TOKEN | ✅ SET | Secret Manager |
| Secret: ADMIN_API_KEY | ✅ SET | Secret Manager |
| IAM: cloudtasks.enqueuer | ✅ GRANTED | `firebase-app-hosting-compute` SA |
| IAM: secretmanager.secretAccessor | ✅ GRANTED | `firebase-app-hosting-compute` SA |
| Custom Domain: exwhyzee.fun | ⏳ HOST_NON_FAH | Swap A record at Namecheap |
| Custom Domain: www.exwhyzee.fun | ⏳ PENDING DNS | Add A + TXT at Namecheap |
| SSL Certificate | ⏳ CERT_VALIDATING | Auto-provisioned after DNS propagates |
