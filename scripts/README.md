# Project Finance Risk Dashboard

## Quick Start

### 1. Start the Python API (GCS data loader)

```bash
# Requires: gcloud auth application-default login
cd scripts/api
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

The API will be available at http://localhost:8001.
- `GET /api/sites` — list asset slugs
- `GET /api/revenue/{slug}?kind=hub&market=da` — load revenue data for a site
- `GET /health` — health check

### 2. Start the Next.js dashboard

```bash
cd scripts/dashboard
npm install
npm run dev
```

The dashboard will be available at http://localhost:3001.

## GCS credentials

The API uses Application Default Credentials. Run once before starting:

```bash
gcloud auth application-default login
```

Or set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`.

## Theme

The dashboard supports **light mode**, **dark mode**, and **system preference**.
Click the theme toggle (sun/moon icon) in the header to cycle between them.

- Dark mode: Bloomberg Terminal aesthetic (`#0D1117` background)
- Light mode: Clean Vercel-style (`#FAFBFC` background)

## Architecture

```
Browser (Next.js)
  ├── lib/finance.ts      — amortization, DSCR (client-side, instant)
  ├── lib/stats.ts        — percentiles, KDE
  ├── lib/validation.ts   — input validation rules
  └── components/         — React + Plotly charts

Python FastAPI (scripts/api/)
  ├── data_loader.py      — GCS download + DuckDB query
  └── main.py             — /api/sites, /api/revenue/{slug}
```

Financial computation runs **entirely client-side** for instant reactivity when
adjusting loan parameters. The API is only called once per site change.
