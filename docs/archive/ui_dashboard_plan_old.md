---
title: Project Finance Risk Dashboard — UI Plan
type: design-plan
domain: project-finance
created: 2026-02-28
status: v1-prototype-spec
relates-to:
  - ../cashflow_dscr_methodology.md
  - ../infra/gcs_bucket_structure.md
  - notebooks/01_gen1_cashflow_dscr.ipynb
---

# Project Finance Risk Dashboard — UI Plan

> One-page prototype dashboard for Gen 1 DSCR analysis.
> Designed to extend seamlessly to Gen 2 (Monte Carlo, breach probability).
> The goal: a lender-grade risk communication tool, not a charting exercise.

---

## 1. Design Philosophy

### 1.1 North Star

The user is a project finance analyst or lender. They open this dashboard with one
question: **"Can this project service its debt? Under what weather conditions does
it fail, and how much headroom do I have?"**

Every element on the page must answer a sub-question that leads to that answer.
Nothing decorative. Nothing that requires reading a tooltip to understand.

### 1.2 Principles

**Signal over noise**
Remove everything that does not carry information. No 3D, no gradients on bars,
no pie charts. Financial data deserves financial precision aesthetics.

**Progressive disclosure**
The top of the page answers the headline question in 5 seconds (KPI cards).
Scroll or interact to get detail. The lender should never have to search for the
number they care about.

**Conservative bias made visible**
Gen 1 assumptions are large. The dashboard shows them explicitly and flags which
numbers are overstated. It earns trust by being honest about its own limitations.

**Gen 2 ready by architecture**
Every panel is designed so that its Gen 1 content (5 deterministic lines) maps
cleanly onto its Gen 2 content (probability bands, breach %, Monte Carlo paths).
No redesign needed — only the data feeding each panel changes.

**Dark, precise, financial**
Color palette: near-black background (#0D1117), off-white text (#E6EDF3), steel
blue accent (#58A6FF), amber warning (#D29922), red breach (#F85149), green safe
(#3FB950). Monospace numbers. Thin chart lines. No rounded corners on data tables.
Inspired by: Bloomberg Terminal meets Vercel dashboard.

---

## 2. User Goals (What the Dashboard Must Enable)

| User Action | Dashboard Support |
|-------------|-------------------|
| **Size the debt** | Adjust principal → DSCR updates live across all years |
| **Structure the covenant** | Adjust MIN_DSCR threshold → breach cells highlight |
| **Stress test** | Toggle P10/P25 to see how bad weather affects coverage |
| **Understand the distribution** | Revenue histogram + P-value markers + KDE |
| **Read the seasonality** | Monthly box plots for the 12-month forecast horizon |
| **Communicate to lender** | Clean printable summary with assumptions explicit |

---

## 3. Layout — Full Page Wireframe

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  HEADER                                                                                  ║
║  [InfraSure Logo]  Project Finance Risk Dashboard   [Site: Ash Creek Solar ▼]  [Export] ║
╠═══════════╦══════════════════════════════════════════════════════════╦════════════════════╣
║           ║                                                          ║                    ║
║  LEFT     ║  ZONE A  ── KPI CARDS (top strip, full width)            ║  RIGHT             ║
║  SIDEBAR  ║  [Min DSCR]  [Binding Case]  [Debt/CFADS]  [Status]     ║  SIDEBAR           ║
║           ║                                                          ║                    ║
║  Config   ╠══════════════════════════════════════════════════════════╣  Covenant          ║
║  ──────   ║                                                          ║  Scorecard         ║
║  Site     ║  ZONE B  ── DSCR LIFETIME PROFILE  (primary chart)      ║  ──────────────    ║
║  Kind     ║                                                          ║  Yr  P10 P50 P90   ║
║  Market   ║  [DSCR vs Year, 5 percentile lines, covenant min line]   ║   1   ✓   ✓   ✓   ║
║           ║  [Improving curve from amortization — level_principal]   ║   2   ✓   ✓   ✓   ║
║  ──────   ║  [Gen2: shaded probability band replaces 5 lines]        ║  ...               ║
║  Loan     ║                                                          ║                    ║
║  ──────   ╠══════════════════╦═══════════════════════════════════════╣  ──────────────    ║
║  Principal║                  ║                                       ║  P-value           ║
║  Rate     ║  ZONE C          ║  ZONE D                               ║  Reference         ║
║  Tenor    ║  Revenue         ║  Annual CFADS vs Debt Service         ║  ──────────────    ║
║  Amort    ║  Distribution    ║                                       ║  P10  $23.9M       ║
║           ║  [histogram +    ║  [grouped bars: Revenue / OpEx /      ║  P25  $25.3M       ║
║  ──────   ║   KDE +          ║   CFADS / DS by year]                 ║  P50  $27.6M       ║
║  OpEx     ║   P-markers]     ║  [shows where CFADS > DS = safe       ║  P75  $30.4M       ║
║           ║                  ║   and CFADS < DS = breach zone]       ║  P90  $33.7M       ║
║  ──────   ╠══════════════════╩═══════════════════════════════════════╣                    ║
║  Display  ║                                                          ║  ──────────────    ║
║  ──────   ║  ZONE E  ── MONTHLY FORECAST DISTRIBUTION               ║  CFADS             ║
║  [x] P10  ║  (1-year horizon; monthly seasonal pattern)             ║  ──────────────    ║
║  [x] P25  ║                                                          ║  P10  $19.9M       ║
║  [x] P50  ║  [box plot per month Jan–Dec showing revenue dist        ║  P25  $21.3M       ║
║  [x] P75  ║   from simulated paths; P10/P50/P90 lines overlaid;      ║  P50  $23.6M       ║
║  [x] P90  ║   seasonal pattern (high summer, low winter for solar)]  ║  P75  $26.4M       ║
║           ║  [Gen2: swap to violin plots per month across years]     ║  P90  $29.7M       ║
╚═══════════╩══════════════════════════════════════════════════════════╩════════════════════╝
```

---

## 4. Zone-by-Zone Specification

### HEADER

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ▪ InfraSure    Project Finance Risk Dashboard — Gen 1              [Export PDF] │
│                 Ash Creek Solar  ·  Hub / DA  ·  1,000 simulated paths           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Site name prominent; kind/market shown as a badge
- Gen label (Gen 1 / Gen 2) shown as a version badge so users always know which
  model version produced the results
- Export: single-page PDF snapshot of current state

---

### ZONE A — KPI Cards (the "5-second answer")

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ MIN DSCR       │  │ BINDING CASE   │  │ DEBT / CFADS   │  │ COVENANT       │
│                │  │                │  │  (Year 1 P50)  │  │ STATUS         │
│   3.45x        │  │   P10, Yr 1    │  │                │  │                │
│   (P10, Yr 1)  │  │   3.45x        │  │   2.13x        │  │  ALL PASS ✓    │
│                │  │                │  │   (leverage)   │  │  18 yrs × 5    │
│  ▲ +0.32x      │  │  clears 1.25x  │  │                │  │  percentiles   │
│  vs covenant   │  │  headroom OK   │  │                │  │                │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘

  Color: green if clear by >0.5x, amber if 0.1–0.5x above, red if breach
```

**Gen 2 upgrade:** Replace "Min DSCR (P10, Yr 1)" with "P(breach) Year 1 =
3.2%" — the probability of breaching the covenant in the worst single year.

---

### ZONE B — DSCR Lifetime Profile (primary chart, ~40% of viewport height)

```
  DSCR
  10x ┤                                                     ○ P90
      │                                               ○
   8x ┤                                         ○
      │                                   ○
   6x ┤                             ○           ◆ P50
      │                       ○   ◆
   4x ┤               ○   ◆
      │         ○   ◆    ▪
      │       ○ ◆  ▪
   2x ┤──────────────────────────────────────── covenant min (1.25x)
      │   ▪ △
 1.0x ┤ △                                       △ P10
      │
   0x └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──▶
          1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18
                                  Loan Year
```

**Interactive controls (above chart):**
- Hover year → tooltip shows all 5 DSCR values + DS amount
- Toggle percentile lines via checkbox panel (left sidebar)
- Drag MIN_DSCR line to resize covenant — DSCR table updates instantly

**Gen 2 upgrade:** 5 deterministic lines → shaded confidence band:
- Dark band: P25–P75 (interquartile range)
- Light band: P10–P90
- Median line (P50) remains solid
- Breach probability shown as color intensity on x-axis tick marks

---

### ZONE C — Revenue Distribution (bottom left)

```
  Paths
  200 ┤         ████
      │       ████████
  150 ┤      ██████████
      │     ████████████
  100 ┤    ██████████████
      │   ████████████████
   50 ┤  ██████████████████
      │  ██████████████████
    0 └──┬──┬──┬──┬──┬──┬──┬──▶
        20  22  24  26  28  30  32  34
                Annual Revenue (M USD)

         │    │    │    │    │
        P10  P25  P50  P75  P90
         │                  │
         └── OpEx level ($4M) shown as vertical dashed line
```

- KDE overlay in accent color on top of histogram
- P-value markers as colored vertical lines (matching DSCR chart colors)
- OpEx level marked — shows gap to CFADS visually
- X-axis shows revenue in M USD; Y-axis path count

**Gen 2 upgrade:** Add year selector slider — distribution evolves across years
as degradation and escalation shift the curve.

---

### ZONE D — Annual CFADS vs Debt Service (bottom right)

```
  M USD
   35 ┤  ╔════╗
      │  ║ Rev║╔════╗
   30 ┤  ║    ║║    ║╔════╗
      │  ╠════╣║    ║║    ║ ...for each year
   25 ┤  ║OpEx║╠════╣║    ║
      │  ╠════╣║OpEx║╠════╣
   20 ┤  ║    ║╠════╣║OpEx║
      │  ║CFDS║║    ║╠════╣
   15 ┤  ║    ║║CFDS║║    ║
      │  ╠════╣║    ║║CFDS║
   10 ┤  ║ DS ║╠════╣║    ║
      │  ║    ║║ DS ║╠════╣
    5 ┤  ║    ║║    ║║ DS ║
      │  ║    ║║    ║║    ║
    0 └──────────────────────▶
         Yr 1  Yr 3  Yr 5  ...Yr18

  Legend: [Rev] [OpEx] [CFADS] [DS]
  CFADS > DS = safe (green highlight)
  DS > CFADS = breach (red highlight)
```

- Shows one selected percentile (dropdown: P10 / P50 / P90)
- Stacked bar: Revenue (full height) with OpEx and DS overlaid
- CFADS is the "gap" between OpEx and DS — visually clear
- DS bar line declines year over year (level_principal amortization)

**Gen 2 upgrade:** Add degradation curve overlaid on Revenue bars, showing
the revenue erosion from generation degradation year by year.

---

### ZONE E — Monthly Forecast Distribution (bottom strip, full width)

```
  M USD / month
  3.5 ┤
      │      ╔═══╗
  3.0 ┤  ╔═══╣   ╠═══╗
      │  ║   ║   ║   ║
  2.5 ┤  ║   ║   ║   ╠═══╗               ╔═══╗
      │  ║   ║   ║   ║   ╠═══╗       ╔═══╣   ║
  2.0 ┤  ║   ║   ║   ║   ║   ╠═══╗   ║   ║   ║
      │  ║   ║   ║   ║   ║   ║   ╠═══╣   ║   ║
  1.5 ┤  ║   ║   ║   ║   ║   ║   ║   ║   ║   ╠═══╗
      │  ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ╠═══╗
  1.0 ┤  ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ╠═══╗
      │  ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ║
  0.5 ┤  ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ║   ║
      └──┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┤
        Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec

  ─── P10 median   ─── P50 median   ─── P90 median
  Box = IQR (P25–P75) of monthly revenue paths
  Whiskers = P10–P90
```

- Box plot per month from the monthly table in `revenue.duckdb`
- Three horizontal lines per month: P10, P50, P90 monthly medians
- Seasonal pattern immediately visible (solar: summer peak, winter trough)
- Shows WITHIN-YEAR variability — which months are highest risk

**Gen 2 upgrade:** Add year slider to show how the monthly distribution
shifts across project years (degradation + escalation evolving the curve).
Add "covenant month check" — highlight months where half-year CFADS
could breach if tested semi-annually.

---

### LEFT SIDEBAR — Configuration Panel

```
┌───────────────────────────┐
│  ASSET                    │
│  ──────────────────────   │
│  Site    [dropdown ▼]     │
│  Kind    [hub] [node]     │
│  Market  [da]  [rt]       │
│                           │
│  LOAN TERMS               │
│  ──────────────────────   │
│  Principal  [50] M    (i) │
│  Rate       [6.0] %   (i) │
│  Tenor      [18] yr   (i) │
│  Amort  [lev_prin ▼]  (i) │
│    lev_payment            │
│    lev_principal          │
│    sculpted               │
│  ·· if sculpted ··        │
│  Target DSCR [1.40]x  (i) │
│  Sculpt pct  [P50 ▼]  (i) │
│                           │
│  OPERATING                │
│  ──────────────────────   │
│  OpEx  [auto] M/yr    (i) │
│  ↳ from registry cap      │
│                           │
│  COVENANT                 │
│  ──────────────────────   │
│  Min DSCR  [auto] x   (i) │
│  ↳ from asset type        │
│                           │
│  DISPLAY                  │
│  ──────────────────────   │
│  [x] P10  (red)           │
│  [x] P25  (orange)        │
│  [x] P50  (blue)          │
│  [x] P75  (green)         │
│  [x] P90  (teal)          │
│                           │
│  MODEL VERSION            │
│  ──────────────────────   │
│  (•) Gen 1                │
│  ( ) Gen 2 (coming)       │
└───────────────────────────┘
```

`(i)` = hoverable tooltip showing the default source (see Default Values Reference below).  
`[auto]` = value computed from asset registry at load time; user can override by typing a number.

- Every input change triggers full re-computation and chart refresh
- Principal / Rate sliders show live DSCR impact in the KPI cards
- Model version selector is present but Gen 2 is greyed out / locked

---

### Default Values Reference

Every input with `(i)` has a sourced default. The tooltip content and the notebook `OPEX_PER_KW` / `MIN_DSCR_BY_TYPE` dicts should match this table exactly.

| Input | Default | How derived | Source | Override? |
|-------|---------|-------------|--------|-----------|
| **Principal** | $50M | Illustrative mid-size utility-scale solar loan | None — user must set | Yes, required |
| **Rate** | 6.0% | Illustrative fixed rate; typical US project finance 2024–25 range is 5.5–7.5% | Market convention | Yes |
| **Tenor** | 18 yr | Industry standard for utility-scale renewable term debt | Norton Rose Fulbright 2024; NREL ATB guidance | Yes |
| **Amort type** | level_principal | Default chosen so DSCR improves over time (shows amortization benefit); industry increasingly uses sculpted | See `docs/cashflow_dscr_methodology.md §4a` | Yes — dropdown |
| **Target DSCR (sculpted)** | 1.40x | Conservative headroom above solar covenant (1.25x); common lender sculpt target | Industry practice | Yes |
| **Sculpt percentile** | P50 | Base-case revenue used to shape DS schedule | Convention — lenders sculpt to expected (P50) cash flow | Yes — dropdown |
| **OpEx** | `AC_MW × $23k/MW-yr` | Derived from `solar_asset.ac_capacity_mw` in asset registry × NREL ATB 2024 all-in solar OpEx | NREL ATB 2024: solar all-in $22–25/kWAC-yr; `docs/extra/discussions/project_finance_opex.md` | Yes — type to override |
| **Min DSCR** | solar → 1.25x; wind → 1.35x; battery → 2.0x | Derived from `asset.asset_type` in registry | Norton Rose Fulbright 2024 via NREL ATB; P50 DSCR sizing targets | Yes — type to override |

**Tooltip format (UX spec):** When user hovers `(i)`, show a small card:

```
┌─────────────────────────────────────────────┐
│ OpEx  default: $2.35M/yr                    │
│ = 102.0 MW × $23,000/MW-yr                  │
│ Source: NREL ATB 2024 solar all-in OpEx     │
│ Range: $22–25/kWAC-yr                       │
│ Override: type a value to use instead       │
└─────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────┐
│ Min DSCR  default: 1.25x                    │
│ Asset type: solar                           │
│ Source: Norton Rose Fulbright 2024 / NREL   │
│ Solar P50 target: 1.25x                     │
│ Wind P50 target:  1.35x                     │
│ BESS P50 target:  2.00x                     │
│ Override: type a value to use instead       │
└─────────────────────────────────────────────┘
```

**Why this matters:** A lender opening the dashboard for the first time should be able to understand where every pre-filled number came from without asking. This is part of the transparency requirement — same reason the assumption disclosure block exists at the bottom of the page.

---

### RIGHT SIDEBAR — Covenant Scorecard + P-value Reference

```
┌──────────────────────┐
│  COVENANT MATRIX     │
│  ─────────────────   │
│  Yr  P10  P50  P90   │
│  ─────────────────   │
│   1  3.45  4.08 5.14 │  ← all green
│   2  3.55  4.20 5.30 │
│   3  3.66  4.33 5.46 │
│   ...                │
│  18  6.77  8.00 10.1 │
│  ─────────────────   │
│  ✓ = DSCR >= 1.25x   │
│  Red = breach        │
│                      │
│  P-VALUE REFERENCE   │
│  ─────────────────   │
│  Revenue (hub/da)    │
│  P10    23.9M USD    │
│  P25    25.3M USD    │
│  P50    27.6M USD    │
│  P75    30.4M USD    │
│  P90    33.7M USD    │
│  ─────────────────   │
│  CFADS               │
│  P10    19.9M USD    │
│  P25    21.3M USD    │
│  P50    23.6M USD    │
│  P75    26.4M USD    │
│  P90    29.7M USD    │
│  ─────────────────   │
│  Yr 1 Debt Service   │
│          5.78M USD   │
│  Yr 18 Debt Service  │
│          2.94M USD   │
└──────────────────────┘
```

- Covenant matrix is color-coded: deep green > 2x, light green 1.5–2x,
  amber 1.25–1.5x, red < 1.25x
- Hovering a cell shows full breakdown: Revenue / OpEx / CFADS / DS / DSCR
- P-value reference is static — always visible without interaction

---

## 5. Interaction Model

### What the user can change (live re-compute)

| Control | Effect |
|---------|--------|
| Site dropdown | Re-loads revenue.duckdb from GCS, recomputes all |
| Kind / Market toggle | Filters data, recomputes percentiles |
| Principal slider | Rebuilds amortization, recomputes all DSCR values |
| Rate input | Rebuilds amortization, recomputes all DSCR values |
| Tenor input | Rebuilds amortization, recomputes all DSCR values |
| Amort type | Three options: `level_payment` / `level_principal` / `sculpted`. Rebuilds amortization schedule, recomputes all DSCR values. |
| Target DSCR (sculpted only) | Sets `DS(t) = CFADS(t) / target_DSCR`. Visible only when amort = sculpted. |
| Sculpt percentile (sculpted only) | Which revenue percentile defines base CFADS for sculpting (e.g. P50). Visible only when amort = sculpted. |
| OpEx input | Recomputes CFADS and all DSCR values |
| MIN_DSCR input | Re-colors covenant matrix and KPI status card |
| Percentile toggles | Shows/hides lines in Zone B |

### What is read-only

- Revenue distribution (comes from GCS — cannot be edited in dashboard)
- Monthly distribution (same)
- Assumptions list (shown at bottom, not editable)

---

### Input Validation & Guard Rails

Every interactive control must enforce a valid range and fail loudly with a clear
message rather than silently producing a wrong number. This is a correctness
requirement, not a UX nicety — a lender who gets a garbage DSCR because they typed
a zero into the rate box must see an error, not a chart.

#### Per-control rules

| Control | Valid range | What breaks if violated | Error / guard behaviour |
|---------|------------|------------------------|-------------------------|
| **Principal** | > 0, typically $1M–$500M | DS = 0 → DSCR = ∞; or negative balance | Clamp min to $1M; show inline warning if > $1B (sanity check) |
| **Rate** | 0.1%–30% | Rate = 0 → no interest, incorrect DS; Rate < 0 → nonsensical | Block 0 and negative; warn if > 20% (unusual for project finance) |
| **Tenor** | 1–40 years, integer | Tenor = 0 → division by zero in level_principal; fractional tenor breaks schedule | Integer-only input; min = 1, max = 40 |
| **Amort type** | `level_payment` / `level_principal` / `sculpted` | Any other value crashes `build_amortization()` | Strict dropdown — no free text |
| **Target DSCR (sculpted)** | > 1.0, typically 1.10–2.00 | Target ≤ 0 → negative DS; target < 1 → DS > CFADS → principal grows (non-amortizing) | Min = 1.01; warn if < 1.10 ("very thin coverage") or > 3.0 ("unusually conservative") |
| **Sculpt percentile** | One of the loaded percentile labels (P10/P25/P50/P75/P90) | Invalid key → KeyError in `pct_cfads` lookup | Strict dropdown populated from loaded data |
| **OpEx** | ≥ 0, typically $0.5M–$20M/yr | Negative OpEx → CFADS overstated | Min = 0; warn if OpEx > P10 revenue (CFADS would be negative at P10) |
| **MIN_DSCR** | 0.5–3.0 | Below 0 → meaningless; above 3 → almost everything breaches in Gen 1 | Clamp 0.5–3.0; default 1.25 |
| **Percentile toggles** | At least 1 must remain checked | All unchecked → empty chart with no guidance | Prevent unchecking the last active toggle |
| **Site dropdown** | Valid asset slug from asset_registry | Unknown slug → GCS 404 on revenue.duckdb download | Populate from asset_registry; disable free text |
| **Kind / Market toggle** | hub or node; da or rt | Invalid combination → empty DataFrame, all percentiles = NaN | Only show combinations that exist in the loaded data |

#### Cross-control consistency checks (run after any change)

These are relationships between controls that must be satisfied before re-computing:

1. **CFADS must be positive at the sculpt percentile:**
   `pct_cfads[SCULPT_PERCENTILE] > 0`
   → if OpEx ≥ revenue at that percentile, block compute and show:
   *"OpEx ($X.XM) ≥ revenue at SCULPT_PERCENTILE ($X.XM). CFADS is negative — sculpting requires positive CFADS."*

2. **Loan must be serviceable at P10 in Year 1:**
   `CFADS_P10 / DS_year1 > 0` (i.e. DS year 1 < CFADS P10)
   → if Year 1 DS exceeds P10 CFADS, show a prominent amber banner:
   *"Debt service in Year 1 ($X.XM) exceeds P10 CFADS ($X.XM). Project cannot service debt at worst-case revenue."*
   This is not blocked (lender may want to see it) but always surfaced.

3. **Sculpted schedule must amortize fully:**
   Closing balance at `year = TENOR_YEARS` must be ≈ 0 (within $1).
   → If not (e.g. DS too small to cover interest in late years), show error:
   *"Sculpted schedule does not fully amortize — DS(t) < Interest(t) in late years. Increase principal or reduce tenor."*

4. **Tenor must not exceed project life:**
   Not enforced in Gen 1, but warn if `TENOR_YEARS > 30`.

#### UX behaviour on validation failure

- **Hard block (red inline error, compute disabled):** Principal ≤ 0, Rate ≤ 0, Tenor ≤ 0, sculpted schedule non-amortizing.
- **Soft warning (amber banner, compute still runs):** Year 1 DS > P10 CFADS, Rate > 20%, OpEx close to revenue at any percentile.
- **Info note (grey, dismissible):** Tenor > 25 years, target DSCR < 1.15 or > 2.5.

#### Test checklist (verify before shipping any interactive version)

These must all produce correct output or the correct error, not a silent wrong number:

- [ ] Principal = 0 → hard error, no compute
- [ ] Rate = 0 → hard error
- [ ] Tenor = 0 → hard error
- [ ] AMORT_TYPE = sculpted, SCULPT_PERCENTILE = P10, OpEx set so P10 CFADS < 0 → hard error
- [ ] AMORT_TYPE = sculpted, TARGET_DSCR_SCULPT = 0.5 → sculpted DS < interest in Year 1 → non-amortizing error
- [ ] AMORT_TYPE = level_payment, all 5 percentile toggles unchecked → blocked
- [ ] Very high principal (e.g. $10B) → Year 1 DS > all CFADS → amber banner fires
- [ ] Switch amort type from level_payment → sculpted → DSCR chart updates (flat line at target DSCR in Gen 1)
- [ ] Switch amort type from sculpted → level_principal → DSCR chart updates (improving curve)
- [ ] Change MIN_DSCR from 1.25 to 5.0 → all cells in covenant matrix turn red
- [ ] Change MIN_DSCR back to 1.25 → all cells return to green
- [ ] Change site (if multi-site) → revenue data re-loads, all derived values update

---

## 6. Assumption Disclosure Block (bottom of page)

Always-visible strip at the bottom:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  GEN 1 ASSUMPTIONS (see docs/cashflow_dscr_methodology.md §5.4)        │
│  A1 Revenue constant across all years · A2 No degradation · A3 No price escal.  │
│  A4 Flat OpEx: zero escalation, no component structure, no inflation             │
│  A5 Annual covenant test · A6 Hub/DA only · A7 No reserves                      │
│  A8 Amort type shown in header (lev_pay/lev_prin/sculpted + sculpt target DSCR) │
│  A9 OpEx is a single deterministic value — no uncertainty distribution,          │
│     no correlation with revenue or climate risk, no component-level breakdown   │
│  Year 1 is the binding constraint. Late-year DSCR accuracy decreases.           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

This is non-negotiable — it communicates model limitations to any lender who sees
the dashboard, which is a transparency requirement for professional use.

**A4 and A9 are the most consequential OpEx assumptions.** Their combined effect on late-year
DSCR is large and directionally ambiguous (see `docs/cashflow_dscr_methodology.md §5.4`):
- No OpEx inflation (A4) → **overstates** late-year CFADS by ~40% at 2.5%/yr over 18yr
- No OpEx uncertainty (A9) → **understates** tail risk; a single bad year (insurance shock,
  major maintenance event) can push DSCR below covenant without appearing in any Gen 1 output

The Gen 1 dashboard makes A4 and A9 visible by name so the lender understands what is and
isn't being modeled. The upgrade path is explicit in §7.

---

## 7. Gen 1 → Gen 2 Upgrade Map

Each zone has an explicit upgrade path. No redesign needed:

| Zone | Gen 1 Content | Gen 2 Content |
|------|--------------|---------------|
| KPI: Min DSCR | P10 DSCR Year 1 | P(breach ≥ once in tenor) |
| KPI: Status | ALL PASS / N breach | Breach probability % per year |
| Zone B: DSCR chart | 5 deterministic lines | Shaded P10–P90 band + median |
| Zone C: Revenue dist | Static histogram | Year-animated distribution |
| Zone D: CFADS vs DS | Single percentile bars | Monte Carlo fan chart |
| Amort / DS profile | level_payment ≈ sculpted (flat CFADS); level_principal distinct | Sculpted meaningfully different — DS tracks declining CFADS |
| Zone E: Monthly | Box plots from monthly table | Violin plots per month per year |
| Covenant matrix | DSCR value per cell | Breach probability per cell |
| Right sidebar P-values | Point estimates | With confidence intervals |
| OpEx (A4): flat, no escalation | Single flat value; `OPEX_ESCALATION_RATE = 0.0` config ready | Annual escalation at 2.5%/yr (CPI); OpEx(t) = OpEx_base × (1 + r)^t |
| OpEx (A9): deterministic only | No distribution; no component breakdown | Probabilistic: insurance shock, maintenance event, augmentation distribution — see 5-step upgrade path below |

**OpEx modeling 5-step upgrade path** (for roadmap planning):

| Step | What changes | Dashboard impact | Complexity |
|------|-------------|-----------------|------------|
| 1 (Gen 1 now) | Flat deterministic OpEx | Single OpEx bar in Zone D | None |
| 2 (quick win) | Annual escalation at 2.5%/yr | OpEx bar grows year-by-year; CFADS and DSCR decline | Low — one new config param |
| 3 (Gen 2a) | Scenario-linked OpEx (e.g. severe climate → insurance +30%) | Scenario toggle changes DS and breach cells | Medium |
| 4 (Gen 2b) | Probabilistic OpEx per component (insurance, maintenance, augmentation) | OpEx fan chart in Zone D; breach probability changes | High |
| 5 (Gen 2c) | Correlated OpEx + revenue (hail → insurance spike AND generation loss) | Tail DSCR distribution; co-movement chart | Very high |

**The key architectural rule:** The dashboard's data contract is:
  - a DSCR DataFrame (years × percentiles)
  - a revenue array (N paths)
  - a monthly revenue DataFrame (months × paths)
  - a loan schedule DataFrame

Gen 1 fills these with deterministic values.
Gen 2 fills these with Monte Carlo draws.
The UI is identical.

---

## 8. Technical Approach

### Stack (recommended for prototype)

| Layer | Tool | Reason |
|-------|------|--------|
| Notebook (current) | Jupyter | Already working |
| Dashboard prototype | Panel + HoloViews OR Streamlit | Fastest path from notebook to interactive; no frontend build step |
| Charts | Matplotlib (already in notebook) OR Plotly | Plotly recommended for interactivity (hover, zoom) |
| Data | DuckDB (already in use) + GCS | No change |
| Auth | GCP Application Default Credentials | Already working |

### File to create

`notebooks/02_gen1_dashboard.ipynb` — a Panel or Streamlit app in a notebook.

Structure mirrors the zones above. Each zone is an independently runnable cell
that reads from shared state variables (dscr_df, loan_schedule, pct_revenue, etc.)
set in the config cell at the top.

### Folder structure (no new folders needed)

```
notebooks/
  01_gen1_cashflow_dscr.ipynb  ← existing: computation
  02_gen1_dashboard.ipynb      ← new: interactive dashboard
docs/
  ui_dashboard_plan.md         ← this file
```

---

## 9. Open Questions (decide before building)

| Question | Options | Recommendation |
|----------|---------|----------------|
| Dashboard framework | Streamlit vs Panel vs Voila | **Streamlit** — simplest, most mature, easiest to hand off |
| Chart library | Matplotlib vs Plotly | **Plotly** — native interactivity, hover, no extra effort |
| Monthly data | From monthly table in revenue.duckdb | Confirm monthly table has enough paths |
| Multi-site | Start single-site, add dropdown later | Single-site for prototype |
| Export | PDF snapshot | Add after core charts are working |

---

## 10. Next Steps (in order)

1. Confirm Streamlit as framework (install + add to requirements.txt)
2. Build Zone B (DSCR chart) as a standalone Plotly figure — this is the most
   important and will validate the data pipeline
3. Add KPI cards and left sidebar config
4. Add Zone C (revenue distribution)
5. Add Zone E (monthly distribution — needs monthly table query)
6. Add Zone D (CFADS vs DS bars)
7. Add right sidebar covenant scorecard
8. Wire all inputs to live re-compute — implement validation rules from §5 (Input Validation & Guard Rails)
9. Run the §5 test checklist end-to-end before any external demo
10. Add assumption disclosure strip
11. Style pass (dark theme, color coding, typography)

---

---

## 11. References

All files below live in this repo and are the authoritative source for the numbers,
architecture decisions, and domain knowledge used in this plan. Give this list to
anyone building the dashboard — they should read Group 1 first, then dip into the
others as needed.

---

### Group 1 — Core: read these before touching any code

| File | What it contains | Why it matters for the dashboard |
|------|-----------------|----------------------------------|
| [`notebooks/01_gen1_cashflow_dscr.ipynb`](../notebooks/01_gen1_cashflow_dscr.ipynb) | Working Gen 1 computation: asset registry lookup, revenue load from GCS, CFADS, amortization (level payment / level principal / sculpted), DSCR table, plots, summary | **The computation engine.** The dashboard is a UI wrapper around exactly this notebook. Every variable (`SITE`, `AMORT_TYPE`, `ANNUAL_OPEX`, `MIN_DSCR`, `loan_schedule`, `dscr_df`, `pct_revenue`) must match. |
| [`docs/cashflow_dscr_methodology.md`](../cashflow_dscr_methodology.md) | Full methodology: CFADS definition, loan inputs, amortization types (incl. sculpted deep dive), DSCR formula, Gen 1 assumptions (A1–A8), Gen 1→Gen 2 upgrade path, 5-step OpEx modeling evolution | **The spec.** Every chart, KPI, and assumption label in the dashboard maps to a section of this doc. If a number on the dashboard is questioned, the answer is here. |
| [`docs/infra/gcs_bucket_structure.md`](../infra/gcs_bucket_structure.md) | GCS bucket layout, `aggregated_data/{asset_slug}/revenue.duckdb` schema, `asset_registry.duckdb` location, file naming rules | **The data source.** Explains exactly what the dashboard loads and where it comes from. Critical for the site dropdown (asset slugs), revenue data load, and any GCS connectivity issues. |
| [`docs/infra/asset_registry.md`](../infra/asset_registry.md) | Full schema for `asset_registry.duckdb`: `asset` table (asset_slug, asset_type, state), `solar_asset` (ac_capacity_mw, system_type), `wind_asset` (ac_capacity_mw, n_turbines), `asset_price`, all lookup tables | **The registry schema.** Used by the `load_asset_registry()` function in the notebook to derive OpEx from capacity and set technology-appropriate MIN_DSCR defaults. Dashboard site dropdown is populated from here. |

---

### Group 2 — Defaults and benchmarks: where the numbers come from

| File | What it contains | Specific defaults it sources |
|------|-----------------|------------------------------|
| [`docs/extra/discussions/project_finance_opex.md`](extra/discussions/project_finance_opex.md) | US utility-scale OpEx benchmarks: solar ($22–25/kWAC-yr), wind ($43–48/kW-yr), offshore ($87–108/kW-yr), BESS (2.5–4% capex); component breakdown; regional variation; escalation rates; lender DSCR sizing targets | Solar `OPEX_PER_KW = 23_000`; wind `OPEX_PER_KW = 45_000`; `OPEX_ESCALATION_RATE` default 2.5%/yr; validation warn thresholds in §5 |
| [`docs/extra/knowlage_base/project finance/foundations/accounting/debt_structures.md`](extra/knowlage_base/project%20finance/foundations/accounting/debt_structures.md) | Term loan mechanics (principal, rate, tenor, amortization types); DSRA sizing; covenant definitions (DSCR, LLCR, PLCR); lock-up and cash sweep triggers; construction loan vs term loan | Amort type options; TENOR_YEARS default 18yr; MIN_DSCR defaults; covenant matrix color thresholds |
| [`docs/extra/knowlage_base/project finance/contracts/ppa_guide_us.md`](extra/knowlage_base/project%20finance/contracts/ppa_guide_us.md) | US PPA structures: fixed-price, escalating, index-linked; merchant tail; contract durations | Why A3 (no price escalation) is conservative for CPI-linked PPAs and aggressive for flat PPAs; context for the revenue distribution |

---

### Group 3 — Methodology extensions: for Gen 2 and beyond

| File | What it contains | Relevant for |
|------|-----------------|--------------|
| [`docs/extra/discussions/discussion_scaling_1yr_to_multiyear.md`](extra/discussions/discussion_scaling_1yr_to_multiyear.md) | How to extend a 12-month forecast distribution to full loan life; degradation + escalation approach; year-by-year CFADS construction | Zone B multi-year DSCR upgrade; Gen 2 CFADS computation |
| [`docs/extra/discussions/methodology_reference.md`](extra/discussions/methodology_reference.md) | Methodology reference for the InfraSure forecast engine: bootstrap resampling, percentile definitions, eligible path criteria | Why `eligible_for_rev_dist = TRUE` filter is correct; P-value semantics in Zone C and right sidebar |
| [`docs/extra/discussions/infrastructure_risk_review1.md`](extra/discussions/infrastructure_risk_review1.md) | Risk review covering correlated risk factors, climate persistence effects, tail DSCR | Gen 2 breach probability; OpEx–revenue correlation (A9 upgrade); tail DSCR modeling |
| [`docs/extra/knowlage_base/project finance/risk/Project_Finance_Risk_Guide.md`](extra/knowlage_base/project%20finance/risk/Project_Finance_Risk_Guide.md) | Comprehensive PF risk taxonomy: resource risk, price risk, operational risk, counterparty risk; debt sizing methodology; P90 sizing logic | Risk scorecard panel (future); MIN_DSCR default rationale; stress test scenarios |

---

### Group 4 — Domain knowledge: background for understanding why

| File | What it contains |
|------|-----------------|
| [`docs/extra/knowlage_base/project finance/foundations/project_finance_guide.md`](extra/knowlage_base/project%20finance/foundations/project_finance_guide.md) | Project finance fundamentals: SPV structure, non-recourse debt, waterfall, covenant tests |
| [`docs/extra/knowlage_base/project finance/foundations/accounting/accounting.md`](extra/knowlage_base/project%20finance/foundations/accounting/accounting.md) | Accounting in project finance: CFADS construction, interest vs principal, reserves |
| [`docs/extra/knowlage_base/project finance/_GLOSSARY.md`](extra/knowlage_base/project%20finance/_GLOSSARY.md) | Glossary: DSCR, LLCR, PLCR, DSRA, CFADS, COD, PPA, P50/P90 — all terms used in the dashboard |
| [`docs/extra/Methodological_Notes_ML_Physics_TimeHorizons.md`](extra/Methodological_Notes_ML_Physics_TimeHorizons.md) | ML + physics hybrid generation modeling; time horizon considerations | Why the 1-year forecast is reliable but multi-year requires degradation/escalation extensions |
| [`docs/extra/Locational_Revenue_Risk_Intelligence.md`](extra/Locational_Revenue_Risk_Intelligence.md) | Hub vs node pricing; locational revenue risk; DA vs RT spreads | Why the dashboard defaults to hub/DA; what node/RT would add |

---

### Group 5 — Case studies: real-world examples

| File | Scenario | Dashboard relevance |
|------|----------|---------------------|
| [`docs/extra/knowlage_base/project finance/case_studies/CS001_refinancing_inflation_2022_23.md`](extra/knowlage_base/project%20finance/case_studies/CS001_refinancing_inflation_2022_23.md) | Refinancing under 2022–23 inflation shock | Why A4 (flat OpEx) overstates late-year DSCR; insurance and maintenance cost spikes |
| [`docs/extra/knowlage_base/project finance/case_studies/CS002_winter_storm_uri_texas_ercot_2021.md`](extra/knowlage_base/project%20finance/case_studies/CS002_winter_storm_uri_texas_ercot_2021.md) | Winter Storm Uri: ERCOT price spike + generation loss | OpEx–revenue correlation (A9); tail DSCR in a correlated shock scenario |

---

### Group 6 — Existing real-world model reference

| File | What it contains |
|------|-----------------|
| [`docs/extra/models/project_finance_model/01_overview.md`](extra/models/project_finance_model/01_overview.md) | Overview of the Dexter RI project finance Excel model |
| [`docs/extra/models/project_finance_model/02_sheet_by_sheet.md`](extra/models/project_finance_model/02_sheet_by_sheet.md) | Sheet-by-sheet breakdown: inputs, amortization, DSCR, waterfall — useful as a cross-check that this notebook covers the same ground |
| [`docs/extra/models/project_finance_model/03_insights_process_and_methods.md`](extra/models/project_finance_model/03_insights_process_and_methods.md) | Model insights and methodology notes |

---

### Infrastructure

| File | Purpose |
|------|---------|
| [`requirements.txt`](../requirements.txt) | Python dependencies: `google-cloud-storage`, `duckdb`, `pandas`, `numpy`, `matplotlib`, `pytest` |
| [`scripts/tests/test_gcs_connection.py`](../scripts/tests/test_gcs_connection.py) | pytest suite for GCS connectivity — run this first if any GCS load in the dashboard fails |

---

*Document version: v2. Created: 2026-02-28. Updated: 2026-02-27. Author: generated with Cursor.*
