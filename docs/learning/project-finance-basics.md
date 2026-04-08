---
title: "Project Finance Conventions for Dashboard Design"
type: learning / reference
domain: project-finance / dashboard
created: 2026-03-25
status: living document
relates-to:
  - ../cashflow_dscr_methodology.md
  - technical/charting_libraries_for_financial_dashboards.md
---

# Project Finance Conventions for Dashboard Design

> **Purpose:** A reference for anyone building or reviewing financial dashboards
> for infrastructure/renewable energy project finance. Covers the conventions,
> definitions, and pitfalls that determine whether a dashboard is trusted by
> analysts and lenders — or dismissed as "pretty but wrong."
>
> This is **not** a methodology document (see `cashflow_dscr_methodology.md` for
> the math). This is about **presentation conventions** — the rules that financial
> professionals expect to see followed when numbers are displayed.

---

## 1. DSCR — The Central Metric

### What it is

**Debt Service Coverage Ratio** = Cash Flow Available for Debt Service (CFADS) ÷ Debt Service

It answers: "For every $1 the project owes, how many dollars of operating cash flow does it generate?"

### Three flavours — know which one you're showing

| Type | Definition | Numerator window | Denominator window | Computed at | Industry use |
|------|-----------|-----------------|-------------------|-------------|-------------|
| **Annual DSCR** | Full-year CFADS ÷ full-year DS | 12 months (full year) | 12 months (full year) | Once per year | Term sheet covenants, annual credit reviews |
| **LTM DSCR** | Trailing 12-month CFADS ÷ trailing 12-month DS | 12 months (rolling lookback) | 12 months (rolling lookback) | Each quarter (or semi-annual test date) | Operational monitoring, semi-annual covenant testing |
| **Quarterly DSCR** | Single-quarter CFADS ÷ single-quarter DS | 3 months (one quarter) | 3 months (one quarter) | Each quarter | Short-term monitoring, cash trap tests |

### How each maps to our dashboard views

| Dashboard view | DSCR type shown | X-axis resolution | Heatmap DSCR source | Why this type? |
|---------------|----------------|-------------------|--------------------|----|
| **Forward 12M** | Quarterly DSCR | Monthly (12 points) | Per-quarter block DSCR | Shows seasonal cash flow risk — does this quarter's revenue cover this quarter's DS? |
| **3-Year** | LTM DSCR | Quarterly (12 points) | LTM at each quarter | Smooths out seasonality over a rolling year; matches how lenders test covenants operationally |
| **Lifecycle** | LTM DSCR | Quarterly (72 points) | LTM at each quarter | Same as 3-Year but for the full 18-year loan tenor; shows how DSCR improves as debt amortizes |
| **Annual fallback** | Annual DSCR | Annual (18 points) | Per-year DSCR | Only used when monthly data is unavailable (no quarterly breakdown possible); one value per year |

**Key distinction — 3-Year and Lifecycle both use LTM DSCR, not Annual DSCR.**
They display quarterly data points on the x-axis (the CFADS band undulates
seasonally), but the DSCR used for heatmap coloring is the LTM value — which
in Gen 1 equals the annual DSCR and is flat across all 4 quarters in a year.
The LTM value only changes at year boundaries when debt service steps down.

The Annual fallback is a **degraded mode** — it appears only when the API
returns no monthly paths (e.g., a site where only annual aggregation has run).
It is not the primary view for any chart mode.

**Common mistake:** Mixing these without labelling. An analyst seeing "DSCR: 1.25x" will assume
Annual DSCR unless told otherwise. If you're showing quarterly DSCR, label it explicitly:
"Quarterly DSCR" or "Q2 2026 DSCR." Our tooltips label each type:
`"Q2 2026 (Apr–Jun) — LTM DSCR"` or `"Q2 2026 (Apr–Jun) — Quarterly DSCR"`.

### LTM DSCR in early quarters — the lookback problem

LTM means "Last Twelve Months." But if the project's COD is March 2026,
how can Q1 2026 have an LTM DSCR? The project has zero operating history.

**Our Gen 1 approach:** Assign the full annual DSCR to every quarter from
Day 1 — including Q1 Year 1. There is no ramp-up, no partial-year
adjustment, no "insufficient history" flag.

```
Q1 2026 (project just started):
  LTM DSCR = Annual CFADS (P50) / Annual DS
           = uses the full annual figure, as if the project already ran a full year
```

This works in Gen 1 because:
- Revenue is a **repeating 12-month seasonal pattern** (not actual metered data)
- All percentiles come from Monte Carlo simulation, not from actuals
- The only thing changing year-to-year is **debt service** (as the loan amortizes)
- OpEx is flat and deterministic

So the LTM DSCR is identical across all 4 quarters within a year, and only
changes at year boundaries when DS steps down. This is equivalent to a
"forecast fill" approach — treating projected revenue as if it already happened.

**What changes in Gen 2 (and why this matters going forward):**

When revenue varies year-to-year (degradation, PPA escalators, merchant curve
changes), the LTM lookback becomes non-trivial:

| Approach | How it works | When appropriate |
|----------|-------------|-----------------|
| **Forecast fill** (our Gen 1) | Use projected full-year figure for all quarters | Pre-operational or when only forecast data exists |
| **Annualize** | Scale partial-year actuals to 12-month equivalent (e.g., 6 months × 2) | Early operational, limited history |
| **Blend** | Mix actuals (months available) with forecast (remaining months) | Transition from forecast to operational |
| **N/A until 4 quarters** | Don't report LTM until 4 full quarters of actuals exist | Conservative lender requirement |

Most lenders use one of these. Our simplification is adequate for Gen 1 where
the seasonal pattern repeats identically — but it **hides seasonal DSCR
variation** (a Q1 winter quarter may actually breach while we show a passing
annual figure uniformly).

**Cross-references for deeper treatment:**
- `docs/learning/examples/dscr-calculations-by-view.md` §3 — worked examples
  showing why LTM is flat within a year, the "statistical trap" of summing
  quarterly percentiles, and a side-by-side of quarterly vs LTM DSCR
- `docs/learning/explain_model_granularity_and_payment_frequency.md` — the
  Gen 1 ÷4/÷12 simplification and its impact on interest accrual, seasonal
  DS, and covenant testing; includes the Gen 2 enhancement roadmap
- `docs/cashflow_dscr_methodology.md` §2 — extending a 12-month forecast to
  full cash flow, periodicity alignment, and multi-year extrapolation caveats

### Covenant thresholds

Typical term sheet language:

| Level | Typical threshold | Consequence |
|-------|-------------------|-------------|
| **Lock-up** | 1.10x – 1.20x | Cash distributions to equity holders are blocked; cash is trapped in reserve account |
| **Default** | 1.00x – 1.05x | Event of default; lender can accelerate the loan |

Our dashboard uses a single `minDscr` threshold (typically 1.25x) for covenant testing. In practice,
lenders define two thresholds. A future enhancement could distinguish lock-up from default.

### The frequency × data window framework

Every time-based financial metric has two dimensions:
1. **Computation frequency** — how often do you calculate it?
2. **Data window** — how much data feeds the calculation?

This framework applies uniformly across DSCR, CFADS, and Debt Service.
Understanding where Gen 1 sits in this grid — and where Gen 2 needs to
move — is the clearest way to see what's simplified and what's already
correct.

#### DSCR in the grid

```
                         Computation frequency
                         Annual              Quarterly
                    ┌────────────────────┬────────────────────┐
  Data         12mo │  Annual DSCR       │  LTM DSCR          │
  window            │  • 1 value/year    │  • 4 values/year   │
                    │  • term sheets     │  • lender standard │
                    │  • our fallback    │  • our 3Y/Lifecycle│
                    ├────────────────────┼────────────────────┤
                3mo │  (not useful)      │  Quarterly DSCR    │
                    │                    │  • seasonal signal │
                    │                    │  • cash trap tests │
                    │                    │  • our Forward 12M │
                    └────────────────────┴────────────────────┘
```

DSCR is already in the **right quadrants** in Gen 1:
- Lifecycle/3-Year use LTM (quarterly frequency, annual window) ✓
- Forward 12M uses Quarterly (quarterly frequency, quarterly window) ✓
- Annual fallback only appears when monthly data is unavailable

#### CFADS (numerator) in the grid

```
                         Computation frequency
                         Annual              Quarterly          Monthly
                    ┌────────────────────┬───────────────────┬───────────────────┐
  Data         12mo │  Annual CFADS      │  (not used)       │  (not used)       │
  window            │  Rev P50 − OpEx    │                   │                   │
                    │  • DSCR table      │                   │                   │
                    │  • loan sizing     │                   │                   │
                    ├────────────────────┼───────────────────┼───────────────────┤
                3mo │                    │  Quarterly CFADS  │                   │
                    │                    │  • seasonal rev   │                   │
                    │                    │  • flat OpEx ÷ 4  │                   │
                    │                    │  • chart band     │                   │
                    ├────────────────────┼───────────────────┼───────────────────┤
                1mo │                    │                   │  Monthly CFADS    │
                    │                    │                   │  • seasonal rev   │
                    │                    │                   │  • flat OpEx ÷ 12 │
                    │                    │                   │  • Forward 12M    │
                    └────────────────────┴───────────────────┴───────────────────┘
```

CFADS frequency matches the data granularity at each level — **this is
already correct in Gen 1.** Revenue comes from the API at monthly
granularity and is aggregated up. The simplification is in OpEx (flat
annual ÷ N), not in the revenue signal.

| Component | Gen 1 | Gen 2 target |
|-----------|-------|-------------|
| Revenue | Monthly seasonal from simulation ✓ | Year-varying (degradation, PPA escalators) |
| OpEx | Annual ÷ N (flat) | Seasonal schedule (maintenance windows, insurance lumps) |
| CFADS | Revenue − flat OpEx | Revenue − seasonal OpEx − taxes − reserve top-ups |

#### Debt Service (denominator) in the grid

```
                         Computation frequency
                         Annual              Quarterly           Monthly
                    ┌────────────────────┬───────────────────┬───────────────────┐
  Accrual      12mo │  Annual DS         │  Annual ÷ 4       │  Annual ÷ 12      │
  period            │  • source of truth │  • display only   │  • display only   │
  (interest         │  • buildAmort()    │  • 3Y/Lifecycle   │  • Forward 12M    │
   compound-        │                    │  • NOT true Q DS  │  • NOT true mo DS │
   ing)             │                    │                   │                   │
                    ├────────────────────┼───────────────────┼───────────────────┤
                3mo │                    │  True quarterly   │                   │
                    │                    │  • Q compounding  │                   │
                    │                    │  • balance steps  │                   │
                    │                    │    down intra-year│                   │
                    │                    │  • Gen 2 target   │                   │
                    ├────────────────────┼───────────────────┼───────────────────┤
                1mo │                    │                   │  True monthly     │
                    │                    │                   │  • rare in PF     │
                    │                    │                   │  • Gen 2 optional │
                    └────────────────────┴───────────────────┴───────────────────┘
```

**This is where Gen 1 simplifies.** DS is computed annually and divided
down for display — it lives in the **top row** regardless of which view
you're in. The quarterly and monthly values on screen are not true
sub-annual debt service; they're annual ÷ 4 and annual ÷ 12.

Gen 2 moves DS into the second row: true quarterly compounding where
interest accrues on the actual quarterly balance and the balance steps
down after each payment.

#### Gen 1 vs Gen 2 — the full picture

| Component | Gen 1 (current) | Gen 2 (target) | Impact of change |
|-----------|----------------|----------------|------------------|
| **Revenue** | Repeating 12-month seasonal pattern | Year-varying: degradation (~0.5%/yr solar), PPA escalators, merchant price curves | CFADS changes year-to-year; LTM DSCR varies within a year |
| **OpEx** | Flat annual ÷ N | Seasonal schedule: maintenance (spring/fall), insurance (annual), land lease (quarterly) | Monthly CFADS more realistic; quarterly DSCR captures true cash timing |
| **Interest accrual** | Annual (once per year on opening balance) | Quarterly (on actual period balance, 30/360 or ACT/365 day count) | ~2.7% more total interest at 6% over 18yr; different DS profile per quarter |
| **Payment frequency** | Annual (÷4 or ÷12 for display) | Quarterly (actual payments reduce balance intra-year) | DS steps down 4x per year instead of once; changes DSCR shape |
| **DSCR computation** | LTM = annual (identical in Gen 1) | LTM ≠ annual (12-month window straddles years with different revenue) | LTM DSCR slides smoothly between years instead of stepping |
| **Covenant testing** | Single threshold, annual implicit | Dual threshold (lock-up + default), quarterly test dates | Can catch seasonal covenant breaches that annual smooths over |
| **Reserves** | Not modeled | DSRA (6-month DS), maintenance reserve, cash sweep | Affects available cash, can trigger technical defaults even when DSCR looks fine |

**The key takeaway:** In Gen 1, DSCR is in the right quadrant (LTM for
monitoring, quarterly for seasonal) but its **denominator** (DS) is
always annual substance. Gen 2 fixes the denominator — true quarterly DS
with real compounding — which makes the quarterly DSCR and LTM DSCR
genuinely different from each other and from the annual figure.

**Cross-references:**
- `docs/learning/explain_model_granularity_and_payment_frequency.md` —
  detailed comparison of Gen 1 vs true quarterly, with $50M worked
  example showing the $885K total interest difference over 18 years
- `docs/learning/examples/dscr-calculations-by-view.md` — worked DSCR
  numbers for all three views showing how the same quarter looks
  different under quarterly vs LTM DSCR

---

## 2. CFADS — Where the Cash Flow Comes From

### What it is

**Cash Flow Available for Debt Service** — the money left over from operations
that can go toward paying the loan.

```
CFADS = Revenue − Operating Expenses
```

In a full model this would also subtract taxes, reserve top-ups, working capital
changes, and other cash outflows. Our Gen 1 model uses the simplified form above.

### Where revenue comes from

Revenue flows through a pipeline before it reaches the dashboard:

```
Physical model          Price model           Aggregation         Dashboard
(generation MWh)   ×   ($/MWh by hour)   →   annual + monthly    → CFADS
                                              revenue paths
```

1. **Generation**: Physics-based simulation (solar irradiance → PV output, or
   wind speed → turbine output) produces hourly MWh for each simulated path
2. **Revenue**: Generation × locational marginal price (LMP) at the relevant
   hub/node, for day-ahead (DA) or real-time (RT) market
3. **Aggregation**: Hourly revenue is summed to monthly and annual totals,
   stored as DuckDB tables in GCS
4. **API**: The dashboard fetches annual and monthly revenue paths (typically
   ~1,000 simulated paths per site)

The monthly data captures **seasonal variation** — solar produces 2–3x more
revenue in summer than winter. This is critical for quarterly DSCR analysis.

### Granularity in our model

| Granularity | Source | What it represents |
|-------------|--------|--------------------|
| **Annual** | `revenue_paths[].annual_revenue_usd` | Total revenue per simulated path per year |
| **Monthly** | `monthly_paths[].monthly_revenue_usd` | Revenue per path per calendar month (Jan=1…Dec=12) |
| **Quarterly** | Derived: sum of 3 monthly values | Q1 = Jan+Feb+Mar revenue, etc. |

Annual percentiles (P10/P25/P50/P75/P90) are computed from the 1,000 annual
path values. Monthly percentiles are computed per calendar month across paths.

**Important:** Annual P50 ≠ sum of monthly P50s. Percentiles don't add linearly
(see `dscr-calculations-by-view.md` §3 for a worked example).

### Operating Expenses (OpEx)

Our Gen 1 model uses a **flat annual OpEx** derived from NREL ATB 2024 benchmarks:

| Asset type | OpEx rate | Example (100 MW) |
|------------|----------|-------------------|
| Solar | $23,000/MW-yr | $2.3M/yr |
| Wind | $45,000/MW-yr | $4.5M/yr |
| Battery | $40,000/MW-yr | $4.0M/yr |

```
Annual OpEx = AC Capacity (MW) × Rate per MW
```

**What this simplification misses:**

| Real-world component | Our model | Reality |
|---------------------|-----------|---------|
| Scheduled maintenance | Flat ÷12 per month | Lumpy — $400k spring outage, $150k other months |
| Insurance | Flat ÷12 per month | Often paid annually or semi-annually |
| Land lease | Flat ÷12 per month | Quarterly or annual payments |
| Property tax | Included in flat rate | Annual lump, varies by jurisdiction |
| Degradation | Not modeled | Solar loses ~0.5%/yr, wind ~0.3%/yr output |

The user can override OpEx manually in the sidebar. The auto-computed value
resets when switching sites.

### CFADS by view

| View | CFADS computation | Granularity |
|------|-------------------|-------------|
| **Forward 12M** | Monthly revenue percentile − monthly OpEx (annual ÷ 12) | Per month |
| **3-Year / Lifecycle** | Quarterly revenue percentile − quarterly OpEx (annual ÷ 4) | Per quarter (for chart band), but DSCR uses annual CFADS |
| **Ledger table** | Annual CFADS = annual revenue percentile − annual OpEx | Per year |

---

## 3. Debt Service — What the Project Owes

### What it is

**Debt Service** = Principal Repayment + Interest Payment (per period)

This is the fixed obligation the project must meet — unlike revenue (uncertain,
seasonal), debt service is **deterministic** once loan terms are set.

### The three amortization types

The dashboard supports three ways to structure debt repayment:

**Level Principal** (our default):

```
Each year repays the same amount of principal.
Interest decreases as balance shrinks → total DS declines over time.

Year 1:  ████████████ principal + ████████████████ interest  = $70.2M DS
Year 5:  ████████████ principal + ██████████████ interest    = $62.0M DS
Year 18: ████████████ principal + ██ interest               = $36.4M DS
                                                (for $213M at 5.75%, 18yr)
```

DSCR **improves** over time because DS shrinks while revenue stays constant.
This is why lenders often see the "binding case" (worst DSCR) in Year 1.

**Level Payment** (annuity):

```
Total DS is the same every year.
Interest decreases, principal increases.

Year 1:  ████ principal + ████████████████ interest         = $24.8M DS
Year 5:  ████████ principal + ████████████ interest         = $24.8M DS
Year 18: ████████████████ principal + ██ interest           = $24.8M DS
                                                (for $213M at 5.75%, 18yr)
```

DSCR is **flat** across years (constant DS, constant revenue in Gen 1).
Simpler to analyze but more interest paid over the life of the loan.

**Sculpted**:

```
DS is shaped so that DSCR = target (e.g., 1.40x) at a chosen percentile.
DS(t) = CFADS(t) / target_DSCR

Year 1:  DS set so DSCR at P50 = 1.40x exactly
Year 2:  Same (revenue is constant in Gen 1)
...
```

The principal may not fully amortize — the closing balance might not reach
zero. This is flagged as a validation error in the dashboard.

### The terms that shape Debt Service

Unlike CFADS (which is just revenue minus costs), debt service depends on
several **contractual and computational terms** that interact with each other.
Understanding these is essential for Gen 2 and for interpreting real term sheets.

#### Interest rate

The annual interest rate (e.g., 5.75%) is what the borrower pays for the
use of money. But how it's applied depends on the compounding convention:

| Rate type | Definition | Example (6% annual on $100M) |
|-----------|-----------|------------------------------|
| **Nominal annual** | Stated rate, not adjusted for compounding | 6.00% — what appears on the term sheet |
| **Periodic** | Nominal ÷ periods per year | Quarterly: 6% ÷ 4 = 1.50% per quarter |
| **Effective annual** | Actual cost including compounding | Quarterly compounding: (1.015)⁴ − 1 = 6.136% |

In Gen 1 we use the nominal annual rate applied once per year. In Gen 2
with quarterly payments, the periodic rate (nominal ÷ 4) would be applied
each quarter, producing a slightly higher effective annual rate.

#### Compounding frequency

How often interest is calculated and added to the accrual:

```
Same $100M loan at 6% nominal:

Annual compounding:     $100M × 6.000% = $6,000,000 interest in Year 1
Quarterly compounding:  $100M × 1.5% × 4 quarters = $6,045,339 (slightly more)
Monthly compounding:    $100M × 0.5% × 12 months  = $6,167,781 (more still)
```

The difference seems small per year but compounds over an 18-year tenor —
quarterly compounding adds ~$885K in total interest vs annual on a $50M
loan at 6% (see `explain_model_granularity_and_payment_frequency.md`).

#### Payment frequency

How often the borrower actually makes a debt service payment:

| Frequency | Common in | Effect |
|-----------|-----------|--------|
| **Annual** | Some international deals; our Gen 1 model | Balance stays high all year; more interest accrues |
| **Semi-annual** | Many US project finance term loans | Two step-downs per year in balance |
| **Quarterly** | Most common in project finance globally | Balance reduces 4x/year; less total interest |
| **Monthly** | Rare in project finance (more common in corporate/mortgage) | Finest granularity; lowest total interest |

Payment frequency matters because each payment reduces the outstanding
balance, which reduces the interest calculated in the next period. More
frequent payments = less total interest over the life of the loan.

#### Day count convention

How "days" in a period are counted for interest calculation:

| Convention | How it works | Used by |
|-----------|-------------|---------|
| **30/360** | Every month has 30 days, year has 360 | Most US fixed-rate project finance |
| **ACT/365** | Actual calendar days, 365-day year | UK, Australia, some floating-rate |
| **ACT/360** | Actual calendar days, 360-day year | SOFR/LIBOR-based floating rate |

Not implemented in our model — we use simple annual division. But it
matters in real deals: a quarterly interest payment on ACT/360 for a
92-day quarter (Q1) vs a 91-day quarter (Q3) produces different amounts.

#### Outstanding balance

The principal balance at any point determines the interest for the next
period. In Gen 1, the balance steps down once per year (after the annual
payment). With true quarterly payments, the balance steps down four times:

```
Gen 1 (annual):
  ────────────────────────────────── $213.0M (all year)
                                    ↓ annual payment
  ────────────────────────────────── $201.2M (all next year)

Gen 2 (quarterly):
  ──────────── $213.0M
              ↓ Q1 payment
  ──────────── $210.0M
              ↓ Q2 payment
  ──────────── $207.0M
              ↓ Q3 payment
  ──────────── $204.0M
              ↓ Q4 payment
  ──────────── $201.0M
```

Each step-down means less interest in the next period. This is why true
quarterly DS isn't just annual ÷ 4 — the interest component changes
within the year as the balance reduces.

### Why CFADS can be aggregated but DS cannot

This is the fundamental asymmetry:

**CFADS (numerator):** Revenue is observed at monthly granularity. Going
from monthly to quarterly is simple summation — add three months of cash
flow. Going from monthly to annual is the same: add twelve months. The
data exists at the finest level and aggregates upward naturally.

```
Monthly CFADS:   $1.2M + $1.5M + $1.8M = $4.5M quarterly CFADS  ✓
                 (sum is always valid)
```

**DS (denominator):** Debt service is *computed* from loan terms, and
the computation changes depending on the frequency. Annual DS ÷ 4 does
NOT equal the true quarterly DS because:

1. **Interest changes intra-year** — after Q1 payment reduces the balance,
   Q2 interest is on a lower balance
2. **Compounding differs** — quarterly rate compounds differently than
   annual rate applied once
3. **Payment timing affects balance** — paying $6M in Q1 vs $24M at
   year-end changes how much interest accrues

```
Annual DS ÷ 4:   $24.08M ÷ 4 = $6.02M per quarter  (our Gen 1)
True Q1 DS:      $213M × 1.4375% + $213M/72 = $3.06M + $2.96M = $6.02M
True Q4 DS:      $204M × 1.4375% + $213M/72 = $2.93M + $2.96M = $5.89M  ← different
                 (balance shrank after Q1-Q3 payments)
```

The gap is small in any single quarter but accumulates over 18 years.
More importantly, it means the quarterly DSCR profile is slightly
different from what annual ÷ 4 shows — Q4 has lower DS (easier to
service) than Q1, which matters for seasonal assets like solar where Q4
revenue is also low.

### How DS maps to sub-annual views (Gen 1)

In Gen 1, debt service is **computed annually** then divided down for display:

```
Annual DS = $24.08M (for Y1 of $213M level_principal at 5.75%)

Quarterly view:  $24.08M ÷ 4  = $6.02M per quarter
Monthly view:    $24.08M ÷ 12 = $2.01M per month
```

This is a simplification — real loans pay quarterly or semi-annually with
true compounding. For a detailed numerical comparison of Gen 1 vs true
quarterly, see `explain_model_granularity_and_payment_frequency.md`.

### Debt Service on the chart

On the hero chart, DS appears as a **step line** (flat within each year,
stepping down at year boundaries for level_principal). The CFADS band
undulates seasonally above or below this line — where the band is above DS,
the project is generating more cash than it owes; where it dips below, it's
in deficit for that period.

### Cross-references

- `docs/cashflow_dscr_methodology.md` §3–§4 — full loan math: principal,
  interest, amortization formulas, worked examples for all three types
- `docs/learning/explain_model_granularity_and_payment_frequency.md` —
  Gen 1 vs true quarterly comparison with numerical impact ($885K
  difference over 18 years at 6%)
- `docs/learning/explain_default_loan_sizing.md` — how the dashboard
  picks default principal, rate, and tenor from asset metadata

---

## 4. Calendar Quarters — The Only Standard

### Definition

| Quarter | Months | Period |
|---------|--------|--------|
| Q1 | January – March | Calendar year start |
| Q2 | April – June | |
| Q3 | July – September | |
| Q4 | October – December | Calendar year end |

This is the **international standard** used by:
- Credit rating agencies (Moody's, S&P, Fitch)
- AEMO (Australian Energy Market Operator) quarterly energy dynamics reports
- Most project finance term sheets globally
- SEC/ASIC financial reporting

### Australian Financial Year (FY)

Australia uses a Jul–Jun financial year: FY2027 = 1 Jul 2026 – 30 Jun 2027.

| FY Quarter | Months | Calendar equivalent |
|------------|--------|---------------------|
| FY Q1 | Jul – Sep | Calendar Q3 |
| FY Q2 | Oct – Dec | Calendar Q4 |
| FY Q3 | Jan – Mar | Calendar Q1 |
| FY Q4 | Apr – Jun | Calendar Q2 |

**Our convention:** We use **calendar quarters** as the default. This matches AEMO reporting
and international lender conventions. The FY mapping is noted here for context but is not
currently implemented in the dashboard.

### The cardinal rule

> **Quarters are NEVER floating.** Q1 always means Jan–Mar, Q2 always means Apr–Jun.
> If a forecast starts in March, the first quarter block is Q1 (with March being the only
> month shown for that quarter), not "Q1 = Mar–May."

**Why this matters:** A financial analyst seeing "Q1" expects Jan–Mar. Showing "Q1 (Mar–May)"
breaks trust immediately — it signals that the tool doesn't follow standard conventions.
The analyst will then question every other number on the page.

### Partial quarters

When a forecast window doesn't align to quarter boundaries (e.g., starts in February or March),
partial quarters appear at the edges. This is normal and expected.

Example — forecast starts March 2026, covers 12 months:

```
|Q1'26| Q2 '26    | Q3 '26    | Q4 '26    |Q1'27|
| Mar | Apr May Jun| Jul Aug Sep| Oct Nov Dec| Jan Feb|
 (1mo)   (full)      (full)      (full)     (2mo)
```

**How to handle:**
- Show the partial quarter with proportional width (narrower block)
- Label clearly: tooltip says "Q1 2026 (Mar only)" or "Q1 2027 (Jan–Feb)"
- DSCR for partial quarters uses actual months available (not annualized)
- Analysts understand partial periods — they see them in every quarterly earnings report

---

## 5. Concrete Dates — Why They're Non-Negotiable

### The problem with "Y1, Y2, Y3"

Abstract labels like "Year 1" or "Y3 Q2" are common in financial models during the
**construction/planning phase** when exact dates aren't known. But once a project is operational
(post-COD), every period should map to a real calendar date.

Why:
- **Audit trail**: Lenders need to verify projections against actual results. "Q2 2027" can be
  checked against real generation data. "Y2 Q2" cannot.
- **Seasonal context**: A financial analyst seeing "Q3" immediately thinks "summer" (in the
  Southern Hemisphere: Jan–Mar of winter — or in standard calendar Q3: Jul–Sep). This context
  is invisible with abstract labels.
- **Cross-referencing**: Revenue projections should align with PPA contract dates, regulatory
  milestones, interest rate reset dates. All of these are calendar-anchored.

### What to show

| View | X-axis labels | Tooltip detail |
|------|---------------|----------------|
| Forward 12M | Month names: "Mar", "Apr", ... | "March 2026" |
| 3-Year | Year at Q1: "'26", "'27", "'28" | "Q2 2026 (Apr–Jun)" |
| Lifecycle | Year at Q1: "'26", "'27", ... "'43" | "Q3 2034 (Jul–Sep)" |

### COD as the anchor

**Commercial Operation Date (COD)** is the moment the project starts generating revenue
at full capacity. In our model:

- The forecast start date (year + month from the revenue model) serves as the calendar anchor
- Year 1 of the loan = the calendar year of the forecast start
- Each subsequent loan year maps to the next calendar year

For example: forecast starts February 2026 → Year 1 = 2026, Year 2 = 2027, etc.

---

## 6. LTV (Loan-to-Value) — What It Tells You

### Definition

**LTV = Outstanding Loan Balance ÷ Estimated Asset Value**

| LTV Range | Interpretation | Project finance context |
|-----------|---------------|------------------------|
| ≤ 60% | Conservative gearing | Strong equity cushion; typical for investment-grade |
| 60–75% | Moderate leverage | Common for operational renewable assets |
| > 75% | High leverage | Limited equity buffer; sensitive to asset value changes |

### Asset value estimation

In the absence of a formal valuation, we estimate asset value using installed cost benchmarks:

| Asset type | CapEx per MW | Source |
|------------|-------------|--------|
| Utility solar | $1.2M/MW | NREL ATB 2024 (moderate, utility-scale PV) |
| Onshore wind | $1.5M/MW | NREL ATB 2024 (moderate) |
| Battery (4hr) | $1.8M/MW | NREL ATB 2024 (moderate, Li-ion) |

**Asset Value = AC Capacity (MW) × CapEx per MW**

This is a **replacement cost proxy**, not a market valuation. A DCF-based valuation (present
value of future cash flows) would be more accurate but requires discount rate assumptions
we don't currently have.

### Limitations

- LTV changes over time as the loan amortizes (numerator decreases) and as the asset depreciates
  or market conditions change (denominator may change). We currently show initial LTV only.
- Battery degradation, solar panel degradation, and wind turbine aging reduce real asset value
  over the loan tenor. Our estimate does not account for this.

---

## 7. Debt / CFADS Ratio — Leverage at a Glance

**Debt / CFADS = Total Outstanding Debt ÷ Year 1 P50 CFADS**

This is a **leverage multiple** — how many years of cash flow it would take to repay the debt
if all CFADS went to repayment (ignoring time value of money).

| Range | Interpretation |
|-------|---------------|
| < 5x | Low leverage |
| 5–8x | Moderate, typical for infrastructure |
| > 8x | Highly leveraged |

Not a covenant metric — this is a "first-glance" leverage indicator for screening.

---

## 8. Common Pitfalls in Financial Dashboards

### 8.1 Floating quarters

**Mistake:** Grouping months into "quarters" based on forecast position instead of calendar.
If forecast starts March: Q1 = Mar–May.

**Why it's wrong:** No financial professional defines Q1 as Mar–May. This makes the dashboard
look unprofessional and creates confusion when cross-referencing with other reports.

**Fix:** Always use calendar quarters. Accept partial quarters at the edges.

### 8.2 Abstract year labels

**Mistake:** Labelling the x-axis "Y1, Y2, Y3" instead of "'26, '27, '28."

**Why it's wrong:** The viewer can't determine what calendar period "Y3 Q2" refers to without
counting from an unstated start date. This forces mental arithmetic and introduces errors.

**Fix:** Show real calendar years. The forecast start year is available from the data.

### 8.3 Mixing DSCR types without labelling

**Mistake:** Showing quarterly DSCR in one view and annual DSCR in another, both labelled "DSCR."

**Why it's wrong:** Quarterly DSCR is more volatile than annual DSCR (seasonal effects aren't
smoothed out). An analyst may compare Q3 DSCR (low solar output quarter) against the annual
DSCR threshold and conclude there's a covenant breach when there isn't one on an annual basis.

**Fix:** Always specify the DSCR type in the label or tooltip. "Quarterly DSCR: 1.15x" vs
"Annual DSCR: 1.35x" vs "LTM DSCR: 1.28x."

### 8.4 Ignoring seasonality in quarterly views

**Mistake:** Using the same revenue for all quarters in a year.

**Why it matters:** Solar generation is 2–3x higher in summer than winter. Wind has different
seasonal patterns. Quarterly DSCR will naturally be lower in low-generation quarters — this is
expected, not a problem. But if the dashboard averages away seasonality, it hides real cash
flow timing risks.

**Our approach:** We use monthly revenue percentiles that capture seasonal variation, then
aggregate to quarters. This preserves the seasonal signal.

### 8.5 Not showing uncertainty

**Mistake:** Showing only the P50 (median) projection.

**Why it's wrong:** P50 means there's a 50% chance of underperforming this number. Lenders
care about downside scenarios — P90 (only 10% chance of doing worse) is typically the
covenant test case.

**Our approach:** We show P10–P90 bands and P25–P75 bands around the P50 line, giving
a visual sense of revenue uncertainty. The DSCR heatmap uses the P50 DSCR for coloring,
but the tooltip shows the full percentile range.

### 8.6 Comparing partial and full quarters

**Mistake:** Showing a 1-month "quarter" DSCR next to a 3-month quarter DSCR at the same
visual scale, without indicating the difference.

**Why it matters:** A single month's DSCR can be much more extreme than a full quarter's
(less smoothing). The visual comparison is misleading.

**Fix:** Clearly indicate partial quarters in the UI (narrower block, tooltip note).
Don't annualize — just show what you have and let the analyst interpret.

---

## 9. How Our Dashboard Maps to These Conventions

| Convention | Our implementation | Status |
|------------|-------------------|--------|
| Calendar quarters (Q1=Jan-Mar) | Forward 12M uses calendar quarter blocks | Implementing |
| Concrete dates on all views | Year labels from forecast_start_year | Implementing |
| DSCR type labelling | Forward 12M = quarterly, 3-Year = LTM, Lifecycle = LTM | In place (tooltip) |
| Seasonal revenue variation | Monthly percentiles from simulation paths | In place |
| Uncertainty bands (P10-P90) | Band fills on all views | In place |
| Partial quarter handling | Proportional-width blocks at edges | Implementing |
| LTV as KPI | 4th card using NREL ATB 2024 CapEx | In place |
| Dual covenant thresholds | Single minDscr threshold | Future enhancement |

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| **CFADS** | Cash Flow Available for Debt Service = Revenue − OpEx (simplified) |
| **COD** | Commercial Operation Date — when the project starts generating revenue |
| **DSCR** | Debt Service Coverage Ratio = CFADS ÷ Debt Service |
| **DS** | Debt Service = Principal repayment + Interest payment |
| **LTM** | Last Twelve Months (trailing 12-month lookback) |
| **NTM** | Next Twelve Months (forward 12-month lookahead) |
| **LTV** | Loan-to-Value = Outstanding Loan ÷ Asset Value |
| **P50** | Median scenario — 50% probability of exceeding this value |
| **P90** | Conservative scenario — 90% probability of exceeding (only 10% chance of doing worse) |
| **P10** | Optimistic scenario — only 10% probability of exceeding |
| **Lock-up** | DSCR threshold below which cash distributions to equity are blocked |
| **Sculpted debt** | Debt repayment schedule shaped to match expected cash flows |
| **Tenor** | Total duration of the loan (e.g., 18 years) |
| **Gearing** | Debt as a proportion of total capital (debt + equity). Related to LTV. |
| **ATB** | Annual Technology Baseline (NREL's cost benchmark dataset) |

---

*This document is a living reference. Update it as new conventions are adopted or
edge cases are discovered during dashboard development.*
