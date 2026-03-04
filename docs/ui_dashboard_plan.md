---
title: Project Finance Risk Dashboard — UI Plan (New)
type: design-plan
domain: project-finance
created: 2026-03-04
status: v2-ui-redesign
relates-to:
  - ui_dashboard_plan_old.md
  - From_Forecast_to_Cashflow_and_DSCR.md
  - gcs_bucket_structure.md
  - notebooks/01_gen1_cashflow_dscr.ipynb
---

# Project Finance Risk Dashboard — New UI Plan

> **Purpose:** Plan **UI-focused updates** only. Modeling (Gen 1 DSCR, amortization, CFADS, validation rules) stays as-is.  
> **Previous spec:** Full v1 prototype spec is preserved in [`ui_dashboard_plan_old.md`](ui_dashboard_plan_old.md).

---

## 1. Current state — what we have

### 1.1 Stack and entrypoints

| Layer | Technology | Location |
|-------|-------------|----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript | `scripts/dashboard/` |
| Charts | Plotly via `react-plotly.js` | All chart components |
| Styling | Tailwind v4, CSS variables (light/dark) | `app/globals.css`, components |
| Theme | `next-themes` (light / dark / system) | `ThemeProvider`, `ThemeToggle` |
| Backend API | FastAPI (Python 3.12) | `scripts/api/` |
| Data | GCS + DuckDB (asset registry, revenue.duckdb per site) | `api/data_loader.py` |
| Deployment | Single Docker image: Nginx → Next.js (port 3000) + FastAPI (8001) | `Dockerfile`, `nginx.conf`, `start.sh` |

**Run locally:**
- API: `cd scripts/api && pip install -r requirements.txt && uvicorn main:app --port 8001 --reload`
- Dashboard: `cd scripts/dashboard && npm install && npm run dev` (port 3001)
- API base URL for frontend: `NEXT_PUBLIC_API_URL` (empty in prod behind Nginx; `http://localhost:8001` in dev if needed)

---

### 1.2 Folder and file inventory

**Root `scripts/`**

| File | Purpose |
|------|---------|
| `README.md` | Quick start, theme description, architecture (browser → Next.js + libs; API → GCS/DuckDB) |
| `package.json` | *(absent at repo root; dashboard has its own)* |
| `Dockerfile` | Multi-stage: Node 22 build Next.js standalone → Python 3.12 runtime + Nginx; copies `api/`, `dashboard` build, `nginx.conf`, `start.sh` |
| `nginx.conf` | Listens 8080; `/api/` and `/health` → FastAPI 8001; `/` → Next.js 3000 |
| `start.sh` | Starts uvicorn (API) and Node server.js (Next) in background, then nginx foreground; supports `GOOGLE_APPLICATION_CREDENTIALS_JSON` |
| `.dockerignore` | Excludes node_modules, .next, __pycache__, tests, .env.local, README |
| `create_gcs_key.sh` | Creates GCS service account key for deployment (e.g. Railway) |

**`scripts/dashboard/`**

| File | Purpose |
|------|---------|
| `package.json` | next 15, react 19, react-plotly.js, plotly.js, next-themes, lucide-react, tailwind v4, TypeScript |
| `tsconfig.json` | Strict, path `@/*` → root, Next plugin |
| `next.config.ts` | reactStrictMode, output standalone |
| `next-env.d.ts` | Next type refs |
| `postcss.config.mjs` | Tailwind v4 PostCSS |
| `app/layout.tsx` | Root layout: Inter + JetBrains Mono fonts, ThemeProvider, metadata (title/description) |
| `app/page.tsx` | **Single dashboard page:** state (sites, selectedSite, siteData, loan, display, filter, opex/minDscr overrides), fetch sites/revenue, compute financials, validation, 3-column layout (ConfigSidebar | main | CovenantScorecard), Header, KPI, charts, AssumptionBanner |
| `app/globals.css` | Tailwind import; `@custom-variant dark`; `@theme` semantic colors; `:root` and `.dark` palettes; scrollbar; tooltip-card; plotly modebar; validation banners; badge-green/amber/red |
| `types/index.ts` | AssetMeta, RevenuePath, MonthlyRevenuePath, SiteData; LoanConfig, DisplayConfig, FilterConfig; LoanScheduleRow, DscrRow, ComputedFinancials, PercentileMap/Key; ValidationMessage; MonthlyStats |
| `lib/api.ts` | fetchSites(), fetchSiteData(slug, kind, market); fmtMillion, fmtDscr, fmtPct |
| `lib/finance.ts` | resolveOpex, resolveMinDscr; buildAmortization (level_payment, level_principal, sculpted); computeDscrTable; computeFinancials (percentiles, CFADS, schedule, DSCR table, KPIs, covenant status) |
| `lib/stats.ts` | percentile(), computePercentiles(), gaussianKDE(), scaleKdeToCounts(), computeMonthlyStats() |
| `lib/validation.ts` | validateLoanConfig (principal, rate, tenor, sculpt), validateCrossControls (Yr1 DS vs P10 CFADS, sculpt amortization), hasHardError() |
| `components/ThemeProvider.tsx` | next-themes provider, attribute class, defaultTheme light, enableSystem |
| `components/ThemeToggle.tsx` | Cycle dark → light → system; Sun/Moon/Monitor icon; compact button with label on sm+ |
| `components/Header.tsx` | Left: InfraSure + “Project Finance Risk Dashboard”; center: site badge, kind/market, path count, “GEN 1” badge; right: ThemeToggle, Export PDF (disabled) |
| `components/KpiCards.tsx` | Four cards: Min DSCR (with headroom vs covenant), Binding Case, Debt/CFADS (Yr1 P50), Covenant Status (ALL PASS / N BREACH); color by headroom (green/amber/red) |
| `components/DscrChart.tsx` | Plotly: DSCR vs loan year; toggle Lines vs Band; percentile lines or P10–P90 band + P50; covenant min horizontal line; theme-aware colors/paper/plot bg |
| `components/RevenueDistChart.tsx` | Plotly: histogram of annual revenue (paths), KDE overlay, P10–P90 vertical lines + labels, OpEx vertical dashed line; theme-aware |
| `components/CfadsDsChart.tsx` | Plotly: grouped bars (Revenue, CFADS, OpEx) + Debt Service line; toggle Standard vs Risk Map (CFADS bars colored by DSCR vs covenant); theme-aware |
| `components/MonthlyChart.tsx` | Plotly: IQR bars (P25–P75) + P10/P50/P90/Mean lines by month; empty state if no monthly data |
| `components/ConfigSidebar.tsx` | Left sidebar: validation errors; Asset (Site select, kind/market toggles); Loan Terms (Principal, Rate, Tenor, Amort, sculpt fields if sculpted); Operating (OpEx, reset to auto); Covenant (Min DSCR, reset); Display (P10–P90 checkboxes); Zone D percentile select; Model Version (Gen 1 only). Info tooltips on (i) fields. |
| `components/CovenantScorecard.tsx` | Right sidebar: Covenant Matrix (Yr × P10/P50/P90 DSCR cells, color by covenant); hover tooltip (Revenue, OpEx, CFADS, DS, DSCR); P-value tables (Revenue, CFADS); Debt Service Yr1 / Yr N. |
| `components/AssumptionBanner.tsx` | Collapsible strip: “Gen 1 Assumptions” with A1–A9; expanded list or truncated one-line; highlights A4/A9. |

**`scripts/api/`**

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app; CORS for localhost 3000/3001; GET /api/sites, GET /api/revenue/{slug}?kind=&market=, GET /health; Pydantic response models |
| `data_loader.py` | GCS client; load_available_sites() from asset_registry.duckdb; load_asset_metadata(slug); load_revenue_data(slug, kind, market) from aggregated_data/{slug}/revenue.duckdb (annual + monthly if table exists) |
| `requirements.txt` | fastapi, uvicorn, google-cloud-storage, duckdb, pandas, numpy, pydantic |

**`scripts/tests/`**

| File | Purpose |
|------|---------|
| `test_gcs_connection.py` | Pytest: GCS client, bucket exists, asset_registry.duckdb present, top-level prefixes |

---

### 1.3 Layout and zones (as built)

- **Header (full width):** Logo/title, site + kind/market + path count + Gen 1 badge, theme + Export PDF.
- **Body (flex row):**
  - **Left sidebar (ConfigSidebar):** Fixed width ~14rem (w-56); scrollable; all inputs and display toggles.
  - **Center (main):** Scrollable; order:
    1. ValidationBanner (warnings/info only)
    2. Zone A: KpiCards (four cards in a row)
    3. Zone B: Panel “DSCR Lifetime Profile” + DscrChart (Lines/Band toggle)
    4. Zone C + D: Two-column grid — Revenue Distribution (RevenueDistChart), Annual CFADS vs Debt Service (CfadsDsChart with Standard/Risk Map)
    5. Zone E: Panel “Monthly Forecast Distribution” + MonthlyChart
  - **Right sidebar (CovenantScorecard):** Fixed width ~13rem (w-52); covenant matrix, P-value and DS reference tables.
- **Footer:** AssumptionBanner (collapsible).

**Panel/SectionLabel:** Rounded border panel with “SECTION LABEL” uppercase muted text above content.

---

### 1.4 Component behaviour (summary)

- **State:** Site list and selected site; site data (asset, revenue_paths, monthly_paths); loan, display, filter, opexOverride, minDscrOverride. Simulated paths filtered from revenue_paths.
- **Computation:** Client-side only: computeFinancials(simulatedRevenue, asset, loan, opexOverride, minDscrOverride); computeMonthlyStats(monthly_paths). Validation runs on loan config and cross-control (post-compute); hard errors block computation.
- **Charts:** All Plotly; theme from useTheme (resolvedTheme); dark/light paper, plot bg, fonts, grid, axis; no modebar (displayModeBar: false). DscrChart and CfadsDsChart have internal view toggles (Lines/Band, Standard/Risk Map).
- **Sidebars:** ConfigSidebar shows validation errors at top; CovenantScorecard only when computed is non-null. Percentile display toggles in left sidebar control which lines appear in DscrChart; Zone D percentile is separate select for CfadsDsChart.

---

### 1.5 Data flow and API

1. On load: `fetchSites()` → set sites, default selectedSite to first.
2. When selectedSite or filter (kind/market) changes: `fetchSiteData(slug, kind, market)` → set siteData, clear overrides.
3. Simulated paths: `siteData.revenue_paths.filter(segment === 'simulated').map(annual_revenue_usd)`.
4. computeFinancials uses asset (from siteData), loan, overrides; produces ComputedFinancials (pctRevenue, pctCfads, loanSchedule, dscrTable, KPIs, covenant status).
5. API returns: asset, revenue_paths, monthly_paths, available_sites, kind, market. No computation on server.

---

### 1.6 Theming and styling

- **Tokens (globals.css):** Semantic names (--color-bg, --color-surface, --color-text, --color-accent, --color-warning, --color-breach, --color-safe, etc.); chart-specific (--chart-paper, --chart-plot, --chart-grid, --chart-font, --chart-axis); covenant matrix (--cov-deep-green, --cov-amber, --cov-red, etc.).
- **Light:** Light gray bg (#fafbfc), white surface, dark text; blue accent; amber/red/green for status.
- **Dark:** Near-black bg (#0d1117), dark surface (#161b22), light text (#e6edf3), steel blue accent (#58a6ff); matches “Bloomberg Terminal” style from old plan.
- **Components:** Use var(--color-*) and Tailwind classes; charts duplicate theme in layout (paper_bgcolor, etc.) from resolvedTheme.
- **Typography:** Inter (sans), JetBrains Mono (numbers); applied via layout body class.

---

### 1.7 Validation and behaviour

- **validateLoanConfig:** Principal &gt; 0 (error), &lt; 1M / &gt; 1B (warnings); rate &gt; 0 (error), &gt; 20% (warning); tenor integer 1–40 (error if not), &gt; 30 (info); sculpted: target DSCR &gt; 1, &lt; 1.1 / &gt; 3 (warnings/info), sculpt percentile CFADS &gt; 0 (error).
- **validateCrossControls:** Yr1 DS &gt; P10 CFADS (warning); sculpted schedule closing balance ≈ 0 at end (error).
- **hasHardError:** blocks compute; ValidationBanner shows non-error messages; ConfigSidebar shows error list.
- **UI:** At least one percentile must stay checked in DSCR chart; number inputs have min/max/step; OpEx/Min DSCR “Reset to auto” when overridden.

---

### 1.8 Gaps vs original plan (ui_dashboard_plan_old.md)

| Original plan | Current implementation |
|---------------|------------------------|
| Export PDF | Button present in header; **disabled** (“coming soon”) |
| Site dropdown | Implemented (left sidebar) |
| Kind/Market | Implemented (hub/node, da/rt toggles) |
| Left sidebar sections | Implemented (Asset, Loan Terms, Operating, Covenant, Display, Zone D, Model Version) |
| Default-value tooltips (i) | Implemented (InfoTooltip with source text for Principal, Rate, Tenor, Amort, OpEx, Min DSCR, etc.) |
| Covenant matrix | Implemented (P10/P50/P90; every 3 years + first/last; color bands; hover tooltip) |
| P-value and CFADS/DS reference | Implemented in right sidebar |
| DSCR chart | Implemented; **extra:** Lines/Band toggle (plan had “Gen 2: band”) |
| Zone C Revenue dist | Histogram + KDE + P-markers + OpEx line — implemented |
| Zone D CFADS vs DS | Implemented; **extra:** Standard vs Risk Map toggle |
| Zone E Monthly | Implemented (IQR + P10/P50/P90/Mean) |
| Assumption disclosure | Implemented (collapsible A1–A9) |
| Drag MIN_DSCR to resize | Not implemented (plan “Drag MIN_DSCR line” — no slider on chart) |
| MIN_DSCR input | In sidebar only (no chart drag) |
| Framework | Plan suggested Streamlit/Panel; **actual:** Next.js + FastAPI |

---

## 2. UI Redesign — Detailed Plan

### 2.1 Design goal

Collapse the current 5-zone, 3-column layout into a focused 2-column layout
where **one hero chart + one ledger table** answer the core question immediately.
Everything else becomes supporting detail available on demand.

**Guiding principle:** A lender opens this page and within 5 seconds sees the
DSCR trajectory, where it breaches covenant, and by how much. Within 30 seconds
they've scanned the ledger table for exact numbers. Only if they want deeper
analysis (revenue distribution, monthly seasonality) do they click to expand.

---

### 2.2 New layout — wireframe

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  HEADER (slimmer)                                                           ║
║  [InfraSure]  Project Finance Risk Dashboard   [Site ▼] hub/da  GEN 1      ║
║               path count · theme toggle                                     ║
╠══════════╦═══════════════════════════════════════════════════════════════════╣
║          ║                                                                   ║
║  LEFT    ║  KPI STRIP  (3 compact cards)                                    ║
║  SIDEBAR ║  [Min DSCR + headroom]  [Debt / CFADS]  [Covenant Status]      ║
║          ║                                                                   ║
║  (as-is) ║───────────────────────────────────────────────────────────────── ║
║          ║                                                                   ║
║  Config  ║  HERO CHART — DSCR band + heatmap background                    ║
║  ──────  ║                                                                   ║
║  Asset   ║  ┌──────────────────────────────────────────────────────────┐    ║
║  Loan    ║  │░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████████████████████████│    ║
║  OpEx    ║  │░░░░░░▒▒▒╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲ CFADS P90 █████████│    ║
║  Cov.    ║  │░░░░╱══════ CFADS P50 median ═══════╲█████████████████│    ║
║  Display ║  │░╱══════════════════════════════════════╲ CFADS P10 ██│    ║
║          ║  │░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████████████████████████│    ║
║          ║  │──●─────●─────●─────●─────●────── Debt Service ($M) ──│    ║
║          ║  │░amber▒▒▒▒▒▒▓▓▓light-green▓▓▓▓▓▓▓█████ deep-green ██│    ║
║          ║  │░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████████████████████████│    ║
║          ║  │  Yr1   Yr3   Yr5  ...  Yr12  ...  Yr17   Yr18       │    ║
║          ║  └──────────────────────────────────────────────────────────┘    ║
║          ║  Foreground: CFADS band ($M) + DS line (gap = headroom)         ║
║          ║  Background: DSCR heatmap — hover for covenant detail per year  ║
║          ║                                                                   ║
║          ║───────────────────────────────────────────────────────────────── ║
║          ║                                                                   ║
║          ║  LEDGER TABLE (financial schedule)                               ║
║          ║  ┌────┬────────┬──────┬───────┬──────┬─────┬──────┬──────┬───┐  ║
║          ║  │ Yr │Rev P50 │ OpEx │ CFADS │  DS  │ Int │ Prin │ Bal  │...│  ║
║          ║  ├────┼────────┼──────┼───────┼──────┼─────┼──────┼──────┼───┤  ║
║          ║  │  1 │ 27.6M  │2.35M │25.3M  │5.78M │3.0M │2.78M │47.2M│...│  ║
║          ║  │  2 │ 27.6M  │2.35M │25.3M  │5.61M │2.83M│2.78M │44.4M│...│  ║
║          ║  │... │  ...   │ ...  │  ...  │ ...  │ ... │ ...  │ ... │...│  ║
║          ║  └────┴────────┴──────┴───────┴──────┴─────┴──────┴──────┴───┘  ║
║          ║  DSCR columns (P10 / P50 / P90) are color-coded cells           ║
║          ║                                                                   ║
║          ║───────────────────────────────────────────────────────────────── ║
║          ║                                                                   ║
║          ║  COLLAPSIBLE EXTRAS (accordion, all collapsed by default)        ║
║          ║  ▸ Revenue Distribution                                          ║
║          ║  ▸ Monthly Forecast (12-month seasonal)                          ║
║          ║                                                                   ║
╠══════════╩═══════════════════════════════════════════════════════════════════╣
║  ASSUMPTIONS BANNER (collapsible, as-is)                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Key structural changes:**

| Before (v1) | After (v2) |
|-------------|------------|
| 3-column: sidebar + main (5 zones) + right sidebar | 2-column: sidebar + main |
| Right sidebar (CovenantScorecard) | **Removed.** Covenant data → hero chart heatmap + ledger table |
| 4 KPI cards | 3 KPI cards (Min DSCR, Debt/CFADS, Covenant Status) |
| DSCR chart (Zone B) | **Replaced** by hero chart: cashflow band + DS line + DSCR heatmap bg |
| CFADS vs DS bars (Zone D) | **Replaced** by ledger table columns |
| Revenue dist (Zone C) | Moved to collapsible extra |
| Monthly forecast (Zone E) | Moved to collapsible extra |
| Covenant matrix (right sidebar) | **Merged** into hero chart (per-year heatmap overlay) + ledger DSCR columns |
| P-value / CFADS / DS reference tables (right sidebar) | **Merged** into ledger table |

---

### 2.3 Hero chart — Quarterly Cashflow band with LTM DSCR heatmap overlay

This is the single most important visualization. It replaces:
- DscrChart (Zone B)
- CfadsDsChart (Zone D)
- CovenantScorecard's covenant matrix
- KPI "where is the worst year" logic (now visible at a glance)

**Key design decisions:**

1. **Foreground: Quarterly CFADS band + Quarterly Debt Service line** — Y-axis in $M.
   The seasonal pattern (solar: summer peak, winter trough) is visible as undulation
   in the CFADS band. The gap between the band and the DS line is the headroom.

2. **Background: Per-quarter LTM DSCR heatmap** — each quarter's vertical column is
   tinted by the LTM (trailing 12-month) DSCR covenant status. Warm (amber/red) for
   risky quarters, cool (green) for safe quarters.

3. **DSCR is background context, not the primary signal** — it's accessible via hover
   (covenant detail tooltip per quarter), but the visual foreground is cashflow in
   familiar dollar terms.

#### Quarterly granularity — why it matters

With annual data, the CFADS band is a flat horizontal line (revenue constant in Gen 1).
Quarterly granularity uses the monthly paths already returned by the API to show the
actual seasonal shape of revenue:

| Gen | Chart appearance |
|-----|-----------------|
| Annual | Flat CFADS line — no seasonal story |
| Quarterly (now) | Undulating band — summer peaks, winter troughs visible |
| Gen 2 future | Year-over-year decline from degradation visible across 72 points |

#### Data pipeline

```
monthly_paths (12 months × N paths)
  → computeQuarterlyPercentiles()    [lib/stats.ts]
      sum months into Q1-Q4 per path → P10/P25/P50/P75/P90 per quarter
  → computeQuarterlyData()           [lib/finance.ts]
      72 QuarterlyPoint objects (18 years × 4 quarters)
      each: quarterly CFADS, quarterly DS, LTM DSCR
  → HeroChart.tsx (quarterly mode)
      72-point x-axis, seasonal CFADS band, step-down DS line
      per-quarter heatmap background, hover for LTM DSCR detail
```

Fallback: if monthly data is absent (e.g. site has no monthly table), the chart
falls back to the annual mode (18-point x-axis, flat CFADS, annual DS).

#### LTM DSCR formula

**LTM DSCR tested at quarter Q of year Y:**
```
LTM_Revenue[Y,Q] = Q(Y,1) + Q(Y,2) + Q(Y,3) + Q(Y,4)   (trailing 4 quarters)
LTM_CFADS[Y,Q]   = LTM_Revenue[Y,Q] - annual_OpEx
LTM_DSCR[Y,Q]    = LTM_CFADS[Y,Q] / annual_DS[Y]
```

**Gen 1 note:** Revenue repeats the same seasonal pattern each year (A1: revenue
constant). So all 4 quarters of the same year have the same LTM DSCR — only
varying year-to-year as DS changes with amortization. The heatmap background
therefore shows year-level coloring with 4 identical cells per year.

**Gen 2 readiness:** When degradation and escalation are added, each year's
revenue differs. LTM tested at Q3-Y5 will span Q4-Y4, Q1-Y5, Q2-Y5, Q3-Y5 —
a mix of two different years' generation levels. The framework handles this
seamlessly: `computeQuarterlyPercentiles()` will receive per-year monthly data,
and `computeQuarterlyData()` will compute true trailing sums.

#### What the user sees

```
  $M
       ┌────────────────────────────────────────────────────────────┐
       │░░░░░░░▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████████████████████│
  35M  │ CFADS P90 ╱‾╲   ╱‾╲   ╱‾╲   ...   ╱‾╲   ╱‾╲   ╱‾╲     │
       │          ╱   ╲ ╱   ╲ ╱   ╲         ╱   ╲ ╱   ╲ ╱   ╲  │
  30M  │       P50 ─────────────────── ─────────────────── ───── │
       │          ╲   ╱ ╲   ╱ ╲   ╱         ╲   ╱ ╲   ╱ ╲   ╱  │
  25M  │ CFADS P10 ╲─╱   ╲─╱   ╲─╱   ...   ╲─╱   ╲─╱   ╲─╱     │
       │░░░░░░░▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████████████████████│
  10M  │─────────────────│────────────────────────────────────── │
       │ Debt Service (step-down every year with amortization)    │
   5M  │░amber░▒▒▒▒▒▒▒▒▓▓▓light-green▓▓▓▓▓▓▓▓▓█████ deep-green█│
   0M  │░░░░░░░▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████████████████████│
       └──┬────┬────┬──...──┬────┬────┬────┬──────────────────────┘
          Y1   Y2   Y3     Y8   Y9  Y10  Y11  ...  Y18
  Seasonal peaks = Q3 (summer), troughs = Q1 (winter)
  Background: 72 columns, colored per LTM DSCR at that test date
```

#### Interactions

| Action | Result |
|--------|--------|
| Hover on CFADS band | Tooltip: "Q2-Y3 — CFADS P50: $X.XXM · Range: $X.XXM–$X.XXM" |
| Hover on DS line | Tooltip: "Q2-Y3 — Quarterly DS: $X.XXM · Annual DS: $X.XXM" |
| Hover on background | Covenant tooltip: "Q2-Y3 — LTM DSCR P10/P50/P90, covenant pass/fail" |
| Change loan config | DS line re-steps, heatmap recolors — CFADS band unchanged |
| Change OpEx | CFADS band shifts, heatmap recolors |
| Change covenant min | Heatmap recolors, more/fewer quarters go amber/red |

#### Plotly implementation

- **72-point x-axis:** integer index 0–71 with custom tickvals/ticktext showing
  only year labels (Y1, Y2...) at Q1 positions (indices 0, 4, 8, ..., 68)
- **Background rects:** `layout.shapes` with `xref: 'x'`, one rect per index
- **DS line:** `shape: 'hv'` (horizontal-then-vertical step) so the step-down at
  each year boundary is crisp rather than a sloped line
- **Fallback:** chart auto-detects `quarterlyData.length === 0` and switches to
  annual mode

---

### 2.4 KPI strip — 3 cards

Three industry-standard metrics above the hero chart:

| Card | Content | Why keep |
|------|---------|----------|
| **Min DSCR** | Value (e.g. 3.45x), where it occurs (P10, Yr 1), headroom vs covenant (+X.XXx), color by headroom | The single most important number. Answers "does it pass?" instantly. |
| **Debt / CFADS** | Leverage ratio (e.g. 2.13x), Year 1 P50, Yr 1 DS amount | Industry-standard metric — shows how leveraged the project is. Lenders size debt relative to CFADS. |
| **Covenant Status** | ALL PASS or N BREACHES; count of cells below threshold | Binary signal — pass/fail at a glance. |

---

### 2.5 Ledger table — financial schedule + export

This is the "30-second answer" — the precise numbers behind the hero chart.
Replaces CfadsDsChart (Zone D), the right sidebar reference tables, and the
covenant matrix.

#### Columns

| Column | Source | Format | Notes |
|--------|--------|--------|-------|
| **Year** | `loanSchedule[i].year` | Integer | Rows: 1 to TENOR_YEARS |
| **Revenue** | `pctRevenue[selectedPct]` | `$X.XXM` | Uses selectedPercentile from display config (default P50) |
| **OpEx** | `annualOpex` | `$X.XXM` | Gen 1: flat every year |
| **CFADS** | `pctCfads[selectedPct]` | `$X.XXM` | Revenue − OpEx |
| **Debt Service** | `loanSchedule[i].debtService` | `$X.XXM` | Changes by year (amort schedule) |
| **Interest** | `loanSchedule[i].interest` | `$X.XXM` | Declines as balance reduces |
| **Principal** | `loanSchedule[i].principal` | `$X.XXM` | Repayment per year |
| **Balance** | `loanSchedule[i].closingBalance` | `$X.XXM` | Outstanding after repayment |
| **Min DSCR** | `dscrTable[i].dscr.P10` | `X.XXx` | Color-coded cell. **Clickable** — expands inline detail row showing P10/P25/P50/P75/P90 + covenant pass/fail |
| **Export** | — | Download icon | Per-year CSV download with annual + quarterly detail |

#### DSCR column — collapsed with expandable detail

The old 3-column DSCR layout (P10/P50/P90 + Covenant) is replaced by a single
"Min DSCR" column showing the P10 value, color-coded by the heatmap palette.

**Clicking the Min DSCR cell** toggles an expansion row below that year showing:

```
  P10: 1.06x  P25: 1.15x  P50: 1.31x  P75: 1.45x  P90: 1.58x  Covenant (1.25x): BREACH
```

Each percentile value is individually color-coded. This preserves the full DSCR
detail without cluttering the default table view. The heatmap background on the
hero chart already conveys the DSCR risk visually — the table expansion is for
users who want exact numbers.

#### Per-year CSV export

Each row has a download icon button in the last column. Clicking it triggers a
client-side CSV download containing:
- Annual summary: Revenue, OpEx, CFADS, DS, Interest, Principal, Balance, all 5 DSCR percentiles, covenant status
- Revenue and CFADS percentile tables (P10–P90)
- Quarterly breakdown (if monthly data available): quarterly Revenue P50, CFADS P50, DS, LTM DSCR P10/P50/P90

Filename pattern: `{site_slug}_year{N}_detail.csv`

Implementation: `lib/export.ts` → `generateYearCsv()` builds CSV string →
`downloadCsv()` creates Blob + `<a>` click. Pure client-side, no server needed.

#### Full project report (table footer)

The summary row at the bottom includes a "Report" button that downloads a
comprehensive CSV covering:
- Site configuration (name, type, loan terms, OpEx, covenant min)
- KPI summary (min DSCR, binding case, leverage, covenant status)
- Gen 1 assumptions (A1–A9)
- Full annual schedule (18 rows × all columns × all 5 DSCR percentiles)
- Revenue and CFADS percentile tables
- Full quarterly detail (72 rows if monthly data available)

Filename pattern: `{site_slug}_full_report.csv`

Implementation: `lib/export.ts` → `generateFullReportCsv()`.

#### DSCR cell coloring

Same palette as the hero chart heatmap background:

| DSCR vs covenant | Background | Text |
|-----------------|------------|------|
| DSCR < minDscr | `--cov-red` | `--cov-red-text` |
| minDscr ≤ DSCR < minDscr + 0.25 | `--cov-amber` | `--cov-amber-text` |
| minDscr + 0.25 ≤ DSCR < minDscr + 0.75 | `--cov-light-green` | `--cov-light-green-text` |
| DSCR ≥ minDscr + 0.75 | `--cov-deep-green` | `--cov-deep-green-text` |

#### Table behaviour

- **All years shown** (18 rows for 18-year tenor)
- **Sticky header row**
- **Monospace font** for all number cells; right-aligned
- **Compact styling:** 11px font, minimal padding, thin borders
- **selectedPercentile** (left sidebar) controls Revenue/CFADS columns
- **Summary row** shows: total DS, total interest, total principal, final balance,
  min DSCR P10 (binding case), full report download button

---

### 2.6 Collapsible extras — accordion sections

The secondary charts move below the ledger table into collapsible accordion
panels. All collapsed by default.

```
┌──────────────────────────────────────────────────────────────────┐
│ ▸  Revenue Distribution (simulated paths)                        │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ ▸  Monthly Forecast Distribution (12-month seasonal pattern)     │
└──────────────────────────────────────────────────────────────────┘
```

When expanded (click on the header row):

```
┌──────────────────────────────────────────────────────────────────┐
│ ▾  Revenue Distribution (simulated paths)                        │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  (RevenueDistChart — histogram + KDE + P-markers + OpEx)   │   │
│ └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation:** Simple React state (`useState<Set<string>>` for open panel
IDs) with CSS transition for expand/collapse. The charts inside are the existing
`RevenueDistChart` and `MonthlyChart` components — no changes to their internals
needed.

Lucide icons: `ChevronRight` (collapsed) → `ChevronDown` (expanded). Same
SectionLabel typography as current panels.

---

### 2.7 Header — slimmer

Current header works well. Minor adjustments:

- Remove the Export PDF button for now (it was already disabled). Add back when
  export is actually implemented.
- Compact the center section slightly — site badge + kind/market + path count +
  Gen 1 badge is fine but can be tighter.
- Keep ThemeToggle on the right.

No structural changes needed — just minor CSS tweaks for visual balance now that
the page below is simpler.

---

### 2.8 Left sidebar — no changes

The ConfigSidebar stays exactly as-is. The only cleanup:

- **Remove "Zone D" section** (the "Show percentile" dropdown for the old
  CfadsDsChart). Replace with a "Ledger percentile" select that controls which
  percentile feeds the Revenue/CFADS columns in the ledger table. Same control,
  different label.
- **Remove the Lines/Band display toggles** (P10–P90 checkboxes). The hero chart
  always shows the full band. No toggle needed. The "Display" section in the
  sidebar can be simplified or removed entirely.

Everything else (Asset, Loan Terms, Operating, Covenant, Model Version) is
unchanged.

---

### 2.9 Components — what changes

| Component | Action | Details |
|-----------|--------|---------|
| `DscrChart.tsx` | **Rewrite** → `HeroChart.tsx` | New component: Cashflow (CFADS) band + DS line foreground, per-year DSCR heatmap background with hover tooltips. |
| `CfadsDsChart.tsx` | **Remove** | Replaced by ledger table |
| `CovenantScorecard.tsx` | **Remove** | Data merged into hero chart risk strip + ledger table DSCR columns |
| `KpiCards.tsx` | **Simplify** | 4 cards → 3 cards: Min DSCR, Debt/CFADS, Covenant Status |
| `RevenueDistChart.tsx` | **Keep** | Moves into collapsible accordion; no internal changes |
| `MonthlyChart.tsx` | **Keep** | Moves into collapsible accordion; no internal changes |
| `ConfigSidebar.tsx` | **Minor edit** | Remove "Zone D" / P10–P90 toggles section; relabel percentile select |
| `Header.tsx` | **Minor edit** | Remove Export PDF button; minor spacing |
| `AssumptionBanner.tsx` | **Keep** | No changes |
| `ThemeProvider.tsx` | **Keep** | No changes |
| `ThemeToggle.tsx` | **Keep** | No changes |
| *(new)* `LedgerTable.tsx` | **Create** | Financial schedule table with colored DSCR cells |
| *(new)* `CollapsiblePanel.tsx` | **Create** | Reusable accordion wrapper for extras |
| `page.tsx` | **Rewrite layout** | 2-column; KPI strip → hero → ledger → collapsible → assumptions |

---

### 2.10 Charting — stay on Plotly

**Decision: Keep Plotly.** Do not add ECharts.

Rationale:
- The hero chart (band + background shapes + risk strip) is achievable in Plotly
  using `shapes` for background zones, `fill: 'tonexty'` for bands, and a
  secondary y-axis bar trace for the risk strip.
- Adding ECharts means two charting libraries in the bundle, two theming systems,
  two tooltip paradigms. The marginal benefit (native `visualMap` for heatmap)
  does not justify the complexity.
- The collapsible extras (RevenueDistChart, MonthlyChart) already work in Plotly.
  Keeping one library means consistent look and feel.

**Future option:** If a more interactive heatmap is needed later (e.g., the
gridstatus-style color-range slider), ECharts can be introduced for *just* that
component while keeping Plotly for everything else. But that's a separate scope.

---

### 2.11 Data and computation — no changes

The backend API (`scripts/api/`) and client-side computation (`lib/finance.ts`,
`lib/stats.ts`, `lib/validation.ts`) are **unchanged**. The `ComputedFinancials`
type already provides everything the new UI needs:

| New UI element | Data source (already computed) |
|----------------|-------------------------------|
| Hero chart band | `dscrTable[].dscr.P10/P25/P50/P75/P90` |
| Hero chart risk strip | `dscrTable[].dscr.P10` vs `minDscr` |
| Background zones | `minDscr` (from resolveMinDscr) |
| Ledger Revenue/CFADS | `pctRevenue[selectedPct]`, `pctCfads[selectedPct]` |
| Ledger DS/Interest/Principal/Balance | `loanSchedule[]` |
| Ledger DSCR columns | `dscrTable[].dscr.P10/P50/P90` |
| Collapsible extras | Same props as current charts |

The `types/index.ts` file needs no changes. The `DisplayConfig` type can be
simplified (remove showP10–showP90 booleans, keep selectedPercentile).

---

### 2.12 Implementation order

| Step | What | Files touched | Depends on |
|------|------|---------------|------------|
| 1 | Create `CollapsiblePanel.tsx` | New component | — |
| 2 | Create `LedgerTable.tsx` | New component | — |
| 3 | Create `HeroChart.tsx` | New component (replaces DscrChart) | — |
| 4 | Simplify `KpiCards.tsx` | Edit existing | — |
| 5 | Edit `ConfigSidebar.tsx` | Remove Zone D / display toggles | — |
| 6 | Edit `Header.tsx` | Remove Export PDF button | — |
| 7 | Rewrite `page.tsx` layout | Major edit | Steps 1–6 |
| 8 | Remove `CfadsDsChart.tsx` | Delete | Step 7 |
| 9 | Remove `CovenantScorecard.tsx` | Delete | Step 7 |
| 10 | Clean up `DisplayConfig` type | Edit types/index.ts | Step 7 |
| 11 | Update `globals.css` if needed | Minor edits | Step 7 |
| 12 | Visual polish + dark/light QA | All components | Steps 1–11 |

Steps 1–3 can be built in parallel (independent new components).
Steps 4–6 are small edits, also parallelizable.
Step 7 is the integration point where the new layout comes together.
Steps 8–9 are cleanup after integration.

---

### 2.13 What we are NOT changing

Explicit list to avoid scope creep:

- **Modeling / computation:** Gen 1 DSCR, amortization types, CFADS, percentiles — all stay.
- **Validation rules:** Same loan validation, cross-control checks, error/warning/info levels.
- **Backend API:** No endpoint changes. Same /api/sites, /api/revenue/{slug}.
- **Data layer:** GCS + DuckDB pipeline unchanged.
- **Deployment:** Docker, Nginx, start.sh all unchanged.
- **Dependencies:** No new npm packages. Plotly, Tailwind, next-themes, lucide-react all stay.
- **Auth / analytics / monitoring:** Sentry, PostHog, Clerk — deferred to separate scope.
- **ECharts / D3:** Not adding. Stay on Plotly.
- **Color-range slider:** Deferred to phase 2 (could be added to hero chart later).
- **Export PDF:** Deferred (button removed from header for now).

---

## 3. References

| Document | Role |
|----------|------|
| [ui_dashboard_plan_old.md](ui_dashboard_plan_old.md) | Full v1 prototype spec (zones, wireframes, validation table, Gen 2 map, references) |
| [From_Forecast_to_Cashflow_and_DSCR.md](From_Forecast_to_Cashflow_and_DSCR.md) | Methodology and Gen 1 assumptions |
| [gcs_bucket_structure.md](gcs_bucket_structure.md) | GCS paths and DuckDB usage |
| [asset_registry.md](asset_registry.md) | Registry schema for site dropdown and defaults |
| `scripts/README.md` | Run instructions and architecture summary |

---

*Document version: v2 UI redesign plan. Created: 2026-03-04. Section 1 = current state inventory. Section 2 = approved redesign spec.*
