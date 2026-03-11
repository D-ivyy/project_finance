---
title: Cloud Deployment Guide — Project Finance Risk Dashboard
type: infrastructure-guide
domain: project-finance
created: 2026-02-28
status: v1
relates-to:
  - ui_dashboard_plan.md
  - gcs_bucket_structure.md
---

# Cloud Deployment Guide

> Comprehensive guide to deploying the Project Finance Risk Dashboard.
> Covers local development through production hosting, with a comparison
> matrix of all viable platforms rated by cost, reliability, scalability,
> setup effort, and suitability for different use cases.

---

## 1. Architecture Overview

The dashboard is a two-process application:

```
Browser
  │
  ├─── /api/*     →  Python FastAPI (port 8001)
  │                    └── Reads from GCS: asset_registry.duckdb, revenue.duckdb
  │
  └─── /*         →  Next.js frontend (port 3000)
                       └── All financial computation runs client-side (TypeScript)
                       └── Plotly.js charts rendered in browser
```

**Key constraint:** The Python API needs **Google Cloud Storage credentials** to read
from `gs://infrasure-model-gpr-data`. Every deployment option must solve this.

### Credential Options (ranked by preference)

| Method | Where it works | Setup effort |
|--------|---------------|-------------|
| **Application Default Credentials (ADC)** | GCP-hosted services (Cloud Run, GCE, GKE) | Zero — automatic |
| **Service account key JSON** | Any platform (Railway, Render, Fly.io, etc.) | Medium — create key, set env var |
| **Workload Identity Federation** | Non-GCP clouds (AWS, Azure) | High — OIDC federation setup |

For non-GCP platforms, you need a GCS service account key:
```bash
# Create a service account with Storage Object Viewer role
gcloud iam service-accounts create finance-dashboard-reader \
  --project infrasure-model-gpr \
  --display-name "Finance Dashboard (read-only)"

gcloud projects add-iam-policy-binding infrasure-model-gpr \
  --member "serviceAccount:finance-dashboard-reader@infrasure-model-gpr.iam.gserviceaccount.com" \
  --role "roles/storage.objectViewer"

# Download the key JSON
gcloud iam service-accounts keys create gcs-key.json \
  --iam-account finance-dashboard-reader@infrasure-model-gpr.iam.gserviceaccount.com

# IMPORTANT: Never commit gcs-key.json to git
```

---

## 2. Local Development (reference baseline)

**Cost:** $0
**Setup time:** 2 minutes
**Who sees it:** Only you

### Terminal 1 — Python API
```bash
cd scripts/api
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

### Terminal 2 — Next.js dashboard
```bash
cd scripts/dashboard
npm install
npm run dev    # → http://localhost:3001
```

GCS credentials: uses `gcloud auth application-default login` (already configured).

---

## 3. Platform Comparison Matrix

| Dimension | Google Cloud Run | Railway | Render | Vercel + Railway | Fly.io |
|-----------|-----------------|---------|--------|-----------------|--------|
| **Monthly cost** | $0 (free tier) | $5/mo (hobby) | $0 (free tier) | $0 + $5 | ~$3–5/mo |
| **Cold starts** | ~2–5s (min-instances=0) | None (always warm) | ~60s (spins down after 15min) | None (Vercel edge) + Railway warm | ~1–3s |
| **Reliability** | Very high (Google SLA) | High (99.9%) | Low (free tier suspends) | High | High |
| **Scalability** | Excellent (auto 0→1000) | Good (8 vCPU/8 GB) | Poor (free = 1 instance) | Excellent + Good | Good (multi-region) |
| **GCS auth** | Automatic (ADC) | Env var (key JSON) | Env var (key JSON) | Env var (key JSON) | Env var (key JSON) |
| **Deploy method** | `gcloud run deploy` | GitHub auto-deploy | GitHub auto-deploy | GitHub auto-deploy | `fly deploy` |
| **Custom domain** | Yes (free) | Yes (hobby plan) | Yes (free) | Yes (free) | Yes (free) |
| **HTTPS** | Automatic | Automatic | Automatic | Automatic | Automatic |
| **Setup effort** | Medium (needs billing) | Low (2 clicks) | Low (2 clicks) | Medium (2 deploys) | Medium (CLI + config) |
| **Docker support** | Yes (builds in cloud) | Yes (auto-detect) | Yes (auto-detect) | No (serverless) | Yes (Firecracker VM) |
| **Best for** | Production / enterprise | Quick sharing / demos | Free prototypes | Frontend perf + API | Multi-region / latency |

### Recommendation by use case

- **"Share with my team this week"** → **Railway** ($5/mo, 5-minute setup, no cold starts)
- **"Free prototype for a demo"** → **Render** ($0, but 60s cold start after idle)
- **"Production lender-facing tool"** → **Google Cloud Run** ($0–10/mo, auto-scales, Google SLA)
- **"Best frontend performance"** → **Vercel (frontend) + Railway (API)** (edge CDN for static assets)
- **"Global low-latency"** → **Fly.io** (multi-region VMs)

---

## 4. Option A: Google Cloud Run (Recommended for Production)

**Cost:** $0 on free tier (2M requests, 360K GB-seconds/month)
**Setup time:** 10 minutes
**Requires:** GCP project with billing enabled + Cloud Run admin permissions

### Architecture

Single Docker container running Nginx as a reverse proxy:
- `/api/*` → FastAPI on port 8001
- `/*` → Next.js standalone on port 3000
- Nginx listens on port 8080 (Cloud Run requirement)

GCS credentials are automatic (Application Default Credentials — the Cloud Run
service account inherits access from the GCP project).

### Files already created

- `scripts/Dockerfile` — multi-stage build (Node build + Python runtime + Nginx)
- `scripts/nginx.conf` — reverse proxy config
- `scripts/start.sh` — entrypoint that starts all three processes
- `scripts/.dockerignore` — excludes node_modules, .next, etc.
- `scripts/dashboard/next.config.ts` — `output: "standalone"` enabled

### Deploy command

```bash
cd scripts/

gcloud run deploy finance-dashboard \
  --source . \
  --project YOUR_GCP_PROJECT \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --port 8080 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300 \
  --quiet
```

Output:
```
Service [finance-dashboard] revision [...] has been deployed
Service URL: https://finance-dashboard-XXXXX-uc.a.run.app
```

### Subsequent deploys

Same command. Or push to GitHub and set up Cloud Build trigger for CI/CD.

### Gotchas

- Billing must be enabled on the GCP project (even though cost is $0 on free tier)
- You need `roles/run.admin` and `roles/cloudbuild.builds.editor` IAM roles
- First request after cold start takes ~3–5s (set `--min-instances 1` to keep warm, costs ~$5/mo)
- If deploying to a different GCP project than the GCS bucket, grant the Cloud Run
  service account `roles/storage.objectViewer` on the bucket

---

## 5. Option B: Railway (Recommended for Quick Sharing)

**Cost:** $5/month (hobby plan, includes $5 usage credit)
**Setup time:** 5 minutes
**Requires:** GitHub account, GCS service account key

### Step-by-step

1. **Create GCS service account key** (see Section 1 above)

2. **Sign up** at [railway.com](https://railway.com) with your GitHub account

3. **New Project** → **Deploy from GitHub Repo** → select `D-ivyy/project_finance`

4. **Settings:**
   - Root Directory: `scripts`
   - Builder: Dockerfile (auto-detected)

5. **Environment Variables** (Settings → Variables):
   ```
   GOOGLE_APPLICATION_CREDENTIALS_JSON = <paste entire gcs-key.json content>
   PORT = 8080
   ```

6. **Update `start.sh`** to write the key before starting the API:
   Add this at the top of `start.sh` (before the FastAPI start line):
   ```bash
   # Write GCS credentials from env var (for non-GCP platforms)
   if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_JSON" ]; then
       echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/gcs-key.json
       export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcs-key.json
   fi
   ```

7. **Deploy** → Railway builds the Docker image and assigns a URL like
   `finance-dashboard-production.up.railway.app`

8. **Custom domain** (optional): Settings → Networking → add your domain

### Pricing breakdown

| Resource | Estimated usage | Monthly cost |
|----------|----------------|-------------|
| Compute (1 vCPU idle) | ~$2.50 | Covered by $5 credit |
| Memory (512 MB) | ~$1.50 | Covered by $5 credit |
| Bandwidth | <1 GB | ~$0.10 |
| **Total** | | **$5/mo** (subscription minimum) |

---

## 6. Option C: Render (Free Prototype)

**Cost:** $0
**Setup time:** 5 minutes
**Requires:** GitHub account, GCS service account key

### Limitations

- Service **spins down after 15 minutes** of no traffic
- Cold start takes **~60 seconds** (user sees a loading page)
- 750 free instance hours/month (all free services share this pool)
- Ephemeral filesystem (no persistent storage)

### Step-by-step

1. **Sign up** at [render.com](https://render.com) with GitHub

2. **New** → **Web Service** → connect `D-ivyy/project_finance` repo

3. **Settings:**
   - Root Directory: `scripts`
   - Environment: Docker
   - Instance Type: Free

4. **Environment Variables:**
   ```
   GOOGLE_APPLICATION_CREDENTIALS_JSON = <paste gcs-key.json content>
   PORT = 8080
   ```

5. Same `start.sh` credential-writing block as Railway (Section 5, step 6)

6. Deploy → URL like `finance-dashboard.onrender.com`

### When to use

- Demo to one person who can tolerate a 60-second initial load
- Verify the deployment works before paying for Railway or Cloud Run
- Not suitable for anything that needs to be "always ready"

---

## 7. Option D: Vercel (Frontend) + Railway (API)

**Cost:** $0 (Vercel) + $5/mo (Railway API)
**Setup time:** 15 minutes
**Requires:** GitHub account, GCS service account key

### Why split?

- Vercel serves Next.js on their **global edge CDN** (fastest possible page loads)
- Railway runs the Python API (always warm, no cold starts)
- Best frontend performance, but slightly more complex setup

### Vercel setup (frontend only)

1. [vercel.com](https://vercel.com) → Import `D-ivyy/project_finance`
2. Root Directory: `scripts/dashboard`
3. Framework: Next.js (auto-detected)
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL = https://your-railway-api-url.up.railway.app
   ```
5. Deploy → URL like `project-finance.vercel.app`

Note: Remove `output: "standalone"` from `next.config.ts` for Vercel
(it uses its own serverless build).

### Railway setup (API only)

For the API-only deploy, you need a separate Dockerfile. Create `scripts/api/Dockerfile`:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Then deploy the `scripts/api` directory to Railway with the GCS env var.

### CORS

The FastAPI `main.py` already allows `localhost:3000` and `localhost:3001`.
Add your Vercel domain to the CORS origins list:
```python
allow_origins=[
    "https://project-finance.vercel.app",  # add this
    ...
]
```

---

## 8. Option E: Fly.io (Multi-Region)

**Cost:** ~$3–5/month (pay-as-you-go)
**Setup time:** 15 minutes
**Requires:** `flyctl` CLI, GCS service account key

### When to choose Fly.io

- You need **low-latency access from multiple continents** (Fly runs VMs at the edge)
- You want fine-grained control over VM size and region placement
- You're comfortable with CLI-based workflows

### Setup

1. Install: `brew install flyctl`
2. Auth: `fly auth login`
3. Create app:
   ```bash
   cd scripts/
   fly launch --name finance-dashboard --region ord --no-deploy
   ```
4. Set secrets:
   ```bash
   fly secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat gcs-key.json)"
   ```
5. Deploy:
   ```bash
   fly deploy
   ```
6. URL: `https://finance-dashboard.fly.dev`

### Multi-region (optional)

```bash
fly regions add lhr sin    # London + Singapore
fly scale count 2          # 2 instances total
```

---

## 9. GCS Credential Handling for Non-GCP Platforms

All non-GCP platforms (Railway, Render, Fly.io, Vercel) need the GCS service
account key passed as an environment variable. Add this block to the top of
`scripts/start.sh` (before any process starts):

```bash
# Write GCS credentials from env var (for non-GCP platforms)
# On GCP (Cloud Run), ADC handles this automatically — this block is a no-op.
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_JSON" ]; then
    echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/gcs-key.json
    export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcs-key.json
    echo "[start] GCS credentials written from env var"
fi
```

Then set the env var on the platform:
```
GOOGLE_APPLICATION_CREDENTIALS_JSON = { "type": "service_account", "project_id": "infrasure-model-gpr", ... }
```

**Security notes:**
- Never commit the key JSON to git
- Use the platform's secrets/env var management (encrypted at rest)
- The service account should have **only** `roles/storage.objectViewer` (read-only)
- Rotate the key periodically (GCP console → IAM → Service Accounts → Keys)

---

## 10. Cloud Storage & Database Connections — The Full Picture

> **Generalized learning:** Everything in this section applies equally to AWS S3,
> Azure Blob Storage, or any other cloud object store. GCS is Google's equivalent
> of S3. The patterns are identical — only the SDK names differ.

### Why the API needs a storage connection

The dashboard has no local database. All financial data lives in a GCS bucket as
**DuckDB files** (`.duckdb`). On every API call, the Python backend:

1. Downloads the `.duckdb` file from GCS into a temporary local file
2. Opens it with DuckDB (in-process SQL engine — no server required)
3. Runs a SQL query and returns JSON
4. Deletes the temp file

```
API request
    │
    ▼
data_loader.py
    │
    ├── download_to_tmpfile()   ← GCS SDK call (needs credentials)
    │       gs://infrasure-model-gpr-data/aggregated_data/{site}/revenue.duckdb
    │
    ├── duckdb.connect(tmp_path)  ← opens the file locally (no network)
    │
    └── con.execute("SELECT ...")  ← pure in-process SQL
```

This is different from a traditional database (Postgres, MySQL) which runs as a
persistent server. DuckDB is **file-based and serverless** — it reads a file,
runs SQL, and closes. The "connection" is just file I/O.

---

### GCS vs S3 — The Analogy

| Concept | Google Cloud (this project) | AWS equivalent |
|---------|---------------------------|----------------|
| Object store service | Google Cloud Storage (GCS) | Amazon S3 |
| Bucket | `gs://infrasure-model-gpr-data` | `s3://my-bucket` |
| SDK | `google-cloud-storage` Python library | `boto3` Python library |
| Credentials (same cloud) | Application Default Credentials (ADC) | IAM Role attached to EC2/Lambda |
| Credentials (different cloud) | Service Account key JSON | IAM User access key + secret |
| Env var for key path | `GOOGLE_APPLICATION_CREDENTIALS` | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` |
| Programmatic auth | `storage.Client()` | `boto3.client('s3')` |
| Download file | `blob.download_to_filename(path)` | `s3.download_file(bucket, key, path)` |
| IAM read-only role | `roles/storage.objectViewer` | `AmazonS3ReadOnlyAccess` |

The mental model is the same: **object store = remote file system**. Files live in
a bucket at a path. Your code downloads them, works with them locally, and
optionally uploads results back.

---

### The Three Credential Scenarios

#### Scenario 1: Same cloud, same project (easiest)

Your code runs on Cloud Run **inside the same GCP project** that owns the bucket.
No credential config needed — GCP automatically injects identity.

```
Cloud Run service
    │  (runs as default Compute Engine service account)
    │
    ▼
GCS bucket
    │  (bucket grants objectViewer to all project members by default)
    ▼
  ✅ Access granted — zero config
```

AWS equivalent: EC2 instance with an IAM Role that has S3 read permissions.

#### Scenario 2: Different cloud or different project (this project's Railway situation)

Your code runs outside GCP (Railway, Render, Fly.io) or in a **different GCP project**
from the bucket. You need a long-lived credential:

```
Railway container
    │  (has no GCP identity — it's not on GCP)
    │
    │  GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcs-key.json
    │      ↑ service account key JSON written from env var at startup
    │
    ▼
GCS bucket
    │  (bucket grants objectViewer to the service account email)
    ▼
  ✅ Access granted — needs key JSON env var
```

AWS equivalent: An EC2 instance or Lambda using an IAM user's access key + secret
stored in environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

**The key JSON is a file that proves identity.** It contains:
- Which service account (email) is making the request
- A private key to sign requests (cryptographic proof)
- The GCP project it belongs to

#### Scenario 3: Workload Identity Federation (advanced)

Your code runs on AWS or Azure and needs GCS access without storing a long-lived key.
Instead, AWS/Azure short-lived tokens are exchanged for GCP tokens via OIDC.
Not needed for this project; mentioned for completeness.

---

### How `data_loader.py` Handles Credentials

The `google-cloud-storage` library's `storage.Client()` automatically checks these
locations **in order** and uses the first one it finds:

```
1. GOOGLE_APPLICATION_CREDENTIALS env var
       → points to a service account key JSON file

2. Application Default Credentials (ADC) file
       → ~/.config/gcloud/application_default_credentials.json
       → set by: gcloud auth application-default login

3. GCE/Cloud Run metadata server
       → automatic on GCP-hosted services, no file needed

4. ❌ Fail with authentication error
```

This is why the same code works in both environments:
- **Local dev:** `gcloud auth application-default login` sets option 2.
- **Cloud Run:** metadata server provides option 3.
- **Railway:** `start.sh` writes the env var JSON to `/tmp/gcs-key.json` → option 1.

```python
# data_loader.py — same line works everywhere
client = storage.Client(project=GCS_PROJECT)
# No credential config needed here — the library handles it
```

AWS `boto3` works the same way: checks `AWS_ACCESS_KEY_ID` env vars, then
`~/.aws/credentials`, then EC2 instance metadata.

---

### DuckDB as the Query Engine

DuckDB deserves its own explanation because it is unusual:

| Property | DuckDB | Traditional DB (Postgres) |
|----------|--------|--------------------------|
| Architecture | In-process (no server) | Client-server |
| Where it runs | Inside your Python process | Separate daemon/service |
| Connection string | Local file path | `postgresql://host:5432/db` |
| Persistence | File on disk (or GCS) | Server manages its own storage |
| Concurrent writers | One at a time (file lock) | Many (MVCC) |
| Best for | Analytics / OLAP reads | Transactional / OLTP |
| SQL support | Full SQL + Pandas integration | Full SQL |

**Why DuckDB here?** The financial model data is read-only, analytical (aggregations,
percentiles), and generated offline. DuckDB files are:
- Portable (just a file, no server to manage)
- Fast for analytical queries (columnar storage)
- Easy to store in GCS and download on demand
- Self-contained (no migrations, no schema management)

The pattern `download → query → delete` is a common "data lakehouse" pattern:
GCS/S3 is the persistent store; DuckDB is the query engine that runs the SQL locally.

---

### Security Best Practices for Storage Credentials

```
✅ DO                                    ❌ DON'T
───────────────────────────────────────────────────────────────
Use env vars / platform secrets          Hardcode keys in source code
Minimum required role (objectViewer)     Use project Owner for app credentials
Rotate keys periodically                 Leave old keys active forever
Use ADC on GCP platforms                 Use service account keys on GCP platforms
Write key to /tmp (ephemeral)            Write key to a committed file path
Add gcs-key.json to .gitignore          Commit gcs-key.json to git
```

For this project, `gcs-key.json` is already in `.gitignore`. The bucket only needs
`roles/storage.objectViewer` (read-only) — the app never writes to GCS.

---

## 12. CI/CD: Auto-Deploy on Git Push

All platforms support auto-deploy from GitHub:

| Platform | Setup |
|----------|-------|
| **Cloud Run** | Cloud Build trigger: GCP Console → Cloud Build → Triggers → Connect repo → `scripts/` directory |
| **Railway** | Automatic — every push to `main` triggers a deploy |
| **Render** | Automatic — every push to `main` triggers a deploy |
| **Vercel** | Automatic — every push to `main` triggers a deploy |
| **Fly.io** | Add GitHub Action: `superfly/flyctl-actions/setup-flyctl@master` |

For Railway/Render/Vercel, zero config needed — just connecting the GitHub repo
enables auto-deploy by default.

---

## 13. Custom Domain Setup

All platforms provide free HTTPS with custom domains:

1. **Add domain in platform dashboard** (e.g., `dashboard.infrasure.com`)
2. **DNS:** Add a CNAME record pointing to the platform's URL
   ```
   dashboard.infrasure.com  CNAME  finance-dashboard-xxxxx.up.railway.app
   ```
3. **Wait** for SSL certificate provisioning (~2–10 minutes)
4. **Verify** HTTPS works at `https://dashboard.infrasure.com`

---

## 14. Monitoring and Observability

### Health check

All deployments expose `GET /health` which returns:
```json
{"status": "ok", "service": "finance-dashboard-api"}
```

Use this for:
- Platform health checks (Cloud Run, Railway, Render all support custom health endpoints)
- Uptime monitoring (UptimeRobot, BetterStack — both have free tiers)

### Logs

| Platform | How to view logs |
|----------|-----------------|
| Cloud Run | `gcloud run services logs read finance-dashboard --region us-central1` |
| Railway | Dashboard → Service → Logs tab |
| Render | Dashboard → Service → Logs tab |
| Fly.io | `fly logs` |

---

## 15. Quick Reference: Which Option to Pick

```
Need to share TODAY with no budget?
  └── Render (free, 60s cold start)

Need to share TODAY and $5/mo is fine?
  └── Railway (warm, 5-min setup)

Need production reliability for lender demos?
  └── Cloud Run (Google SLA, auto-scale, $0 on free tier)

Need best possible page load speed?
  └── Vercel (frontend) + Railway (API)

Need global low-latency for international team?
  └── Fly.io (multi-region VMs)

Already have GCP admin on the infrasure project?
  └── Cloud Run (zero credential setup, everything automatic)
```

---

## 16. Files Reference

| File | Purpose |
|------|---------|
| `scripts/Dockerfile` | Multi-stage Docker build (Node build + Python runtime + Nginx) |
| `scripts/nginx.conf` | Reverse proxy: `/api/*` → FastAPI, `/*` → Next.js |
| `scripts/start.sh` | Entrypoint: starts uvicorn + node + nginx |
| `scripts/.dockerignore` | Excludes node_modules, .next, .venv from Docker context |
| `scripts/dashboard/next.config.ts` | `output: "standalone"` for container deployment |
| `scripts/dashboard/.env.local` | Local dev: `NEXT_PUBLIC_API_URL=http://localhost:8001` |
| `scripts/dashboard/lib/api.ts` | API client: uses relative URLs in production (same-origin via Nginx) |

---

*Document version: v1. Created: 2026-02-28.*
