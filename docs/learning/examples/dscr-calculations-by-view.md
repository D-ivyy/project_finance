---
title: "DSCR Calculations by Dashboard View — Worked Examples"
type: learning / examples
domain: project-finance / dashboard
created: 2026-03-25
relates-to:
  - ../project-finance-basics.md
  - ../../../scripts/dashboard/lib/finance.ts
---

# DSCR Calculations by Dashboard View

> **Purpose:** Walk through the exact DSCR math used in each of the three
> dashboard chart views — Forward 12M, 3-Year, and Project Lifecycle — using
> a single concrete example with real numbers. After reading this, you should
> be able to point at any DSCR value on the dashboard and explain how it was
> computed and what it means.

---

## 1. Setup — Our Worked Example

### The Project

```
Project:        Lone Star Solar
Location:       West Texas
Capacity:       100 MW AC
COD:            March 2026 (forecast starts March)
Asset type:     Utility-scale solar PV
```

### Loan Terms

```
Principal:      $50,000,000
Annual rate:    6.0%
Tenor:          18 years
Amort type:     Level principal
```

Level principal means each year repays the same amount of principal:

```
Annual principal repayment = $50M / 18 = $2,777,778
```

Interest decreases each year as the balance shrinks:

```
Year 1 interest  = $50,000,000 × 6.0% = $3,000,000
Year 1 DS        = $2,777,778 + $3,000,000 = $5,777,778

Year 2 interest  = ($50M - $2.78M) × 6.0% = $2,833,333
Year 2 DS        = $2,777,778 + $2,833,333 = $5,611,111

Year 3 interest  = ($50M - 2×$2.78M) × 6.0% = $2,666,667
Year 3 DS        = $2,777,778 + $2,666,667 = $5,444,444
```

### Operating Expenses

```
OpEx (NREL ATB 2024):  $23,000/MW × 100 MW = $2,300,000/year
Monthly OpEx:          $2,300,000 / 12 = $191,667/month
Quarterly OpEx:        $2,300,000 / 4  = $575,000/quarter
```

### Monthly Revenue (P50) — Seasonal Pattern

Solar output follows a strong seasonal curve. Summer months produce 2-3x
more than winter months. Here are the P50 (median scenario) monthly revenues:

```
Month    Cal Month   Season    P50 Revenue    P50 CFADS
─────    ─────────   ──────    ───────────    ─────────
Jan         1        Winter     $310,000      $118,333    ($310K - $192K opex)
Feb         2        Winter     $380,000      $188,333
Mar         3        Spring     $520,000      $328,333
Apr         4        Spring     $680,000      $488,333
May         5        Spring     $820,000      $628,333
Jun         6        Summer     $950,000      $758,333
Jul         7        Summer    $1,020,000     $828,333
Aug         8        Summer     $980,000      $788,333
Sep         9        Fall       $750,000      $558,333
Oct        10        Fall       $560,000      $368,333
Nov        11        Fall       $390,000      $198,333
Dec        12        Winter     $340,000      $148,333
                               ──────────    ─────────
Annual total:                  $7,700,000    $5,400,000
```

**CFADS = Revenue - OpEx** (per month: revenue - $191,667)

Annual CFADS (P50) = $7,700,000 - $2,300,000 = **$5,400,000**

### Monthly Debt Service (Year 1)

```
Annual DS (Y1):   $5,777,778
Monthly DS:       $5,777,778 / 12 = $481,481/month
Quarterly DS:     $5,777,778 / 4  = $1,444,444/quarter
```

---

## 2. Forward 12M View — Quarterly DSCR

### What it shows

The Forward 12M view displays the **next 12 months** starting from the
forecast start date (March 2026). It groups months into **calendar quarter
blocks** and computes a **per-quarter DSCR** for each block.

This is NOT a trailing lookback — it's a forward snapshot of each quarter's
cash flow vs. that quarter's debt service.

### The 12-month window

Starting March 2026, the 12-month window covers Mar 2026 through Feb 2027:

```
                    2026                              2027
         Q1    |    Q2     |    Q3     |    Q4     |  Q1
         ─┬─   | ─────────| ─────────| ─────────| ──┬──
          Mar   | Apr May Jun| Jul Aug Sep| Oct Nov Dec| Jan Feb
         (1mo)    (3 mo)      (3 mo)      (3 mo)     (2mo)

Block:    [0]       [1]         [2]         [3]        [4]
```

**5 blocks** — the first and last are partial calendar quarters.

### Step-by-step calculation for each block

**Block 0: Q1 2026 (March only — 1 month, partial)**

```
Revenue:    $520,000  (March P50)
OpEx:       $191,667  (1 month)
CFADS:      $520,000 - $191,667 = $328,333
DS:         $481,481 × 1 month  = $481,481

DSCR (P50) = $328,333 / $481,481 = 0.68x   <-- BREACH (below 1.25x)
```

One month of spring solar can't cover one month of debt service.
This is expected — March alone is weak. This is why partial quarters
require careful interpretation.

**Block 1: Q2 2026 (Apr–Jun — 3 months, full quarter)**

```
Revenue:    $680K + $820K + $950K           = $2,450,000
OpEx:       $191,667 × 3                    = $575,000
CFADS:      $2,450,000 - $575,000           = $1,875,000
DS:         $481,481 × 3                    = $1,444,444

DSCR (P50) = $1,875,000 / $1,444,444 = 1.30x   <-- PASS (above 1.25x)
```

Late spring/early summer — solar is ramping up. Just above covenant.

**Block 2: Q3 2026 (Jul–Sep — 3 months, full quarter)**

```
Revenue:    $1,020K + $980K + $750K         = $2,750,000
OpEx:       $575,000
CFADS:      $2,750,000 - $575,000           = $2,175,000
DS:         $1,444,444

DSCR (P50) = $2,175,000 / $1,444,444 = 1.51x   <-- Comfortable
```

Peak summer production. Strongest quarter of the year.

**Block 3: Q4 2026 (Oct–Dec — 3 months, full quarter)**

```
Revenue:    $560K + $390K + $340K           = $1,290,000
OpEx:       $575,000
CFADS:      $1,290,000 - $575,000           = $715,000
DS:         $1,444,444

DSCR (P50) = $715,000 / $1,444,444 = 0.49x   <-- DEEP BREACH
```

Winter quarter. Solar production drops sharply. Revenue barely covers OpEx,
let alone debt service. This is the seasonal trough — normal for solar.

**Block 4: Q1 2027 (Jan–Feb — 2 months, partial)**

```
Revenue:    $310K + $380K                   = $690,000
OpEx:       $191,667 × 2                    = $383,333
CFADS:      $690,000 - $383,333             = $306,667
DS:         $481,481 × 2                    = $962,963

DSCR (P50) = $306,667 / $962,963 = 0.32x   <-- DEEP BREACH
```

Two winter months — the lowest production period.

### Summary table

```
Block   Quarter    Months    Revenue($)   CFADS($)    DS($)       DSCR(P50)  Status
─────   ───────    ──────    ──────────   ────────    ─────       ─────────  ──────
  0     Q1 '26     1 (Mar)     520,000     328,333     481,481     0.68x    BREACH
  1     Q2 '26     3          2,450,000   1,875,000   1,444,444    1.30x    PASS
  2     Q3 '26     3          2,750,000   2,175,000   1,444,444    1.51x    PASS
  3     Q4 '26     3          1,290,000     715,000   1,444,444    0.49x    BREACH
  4     Q1 '27     2            690,000     306,667     962,963    0.32x    BREACH
```

### What the heatmap shows

Each block gets a background color based on its P50 DSCR:

```
|Q1'26| Q2 '26    | Q3 '26    | Q4 '26    |Q1'27|
| RED | LT GREEN  |  GREEN    |   RED     | RED |
| Mar | Apr May Jun| Jul Aug Sep| Oct Nov Dec| Jan Feb|
 0.68x   1.30x      1.51x      0.49x      0.32x
```

### Key insight: Quarterly DSCR is volatile

Quarterly DSCR for solar swings wildly — from 1.51x in summer to 0.32x in
winter. This is **expected** and does not necessarily mean the project is
failing. Seasonal DSCR variation is normal for any weather-dependent asset.

This is exactly why lenders typically use **LTM DSCR** (next section) for
covenant testing — it smooths out seasonal variation by looking at the full year.

---

## 3. 3-Year & Lifecycle Views — LTM DSCR

### What LTM means

**LTM = Last Twelve Months** (also called "trailing twelve months" or TTM).

At any quarterly test date, LTM DSCR answers: "Over the past 12 months,
how much operating cash flow did the project generate for every $1 of
debt service?"

```
LTM DSCR = (Annual CFADS) / (Annual Debt Service)
```

### The sliding window concept

```
Timeline:   2026                          2027                          2028
            Q1  Q2  Q3  Q4               Q1  Q2  Q3  Q4               Q1
            ┌───┬───┬───┬───┐            ┌───┬───┬───┬───┐

Test at Q4 2026:
            ├───────────────┤
            ◄── 12 months ──►
            Look back from Q4 2026 to Q1 2026

Test at Q1 2027:
                ├───────────────┤
                ◄── 12 months ──►
                Look back from Q1 2027 to Q2 2026

Test at Q4 2027:
                             ├───────────────┤
                             ◄── 12 months ──►
                             Look back from Q4 2027 to Q1 2027
```

At each test date, the 12-month window slides forward. It always captures
a full year of seasonal variation.

### But wait — what about the initial quarters?

LTM means "Last Twelve Months." But if the project's COD is March 2026,
how can Q1 2026 have an LTM DSCR? The project has zero operating history.

**In our Gen 1 model, we skip this problem entirely.** The code assigns
the full annual CFADS / annual DS ratio to every quarter from Day 1 —
including Q1 Year 1. There is no ramp-up, no partial-year adjustment,
no "insufficient history" flag.

```
Q1 2026 (project just started):
  LTM DSCR = Annual CFADS (P50) / Annual DS
           = $5,400,000 / $5,777,778
           = 0.93x           <-- same as if the project ran a full year
```

This works because:
- We assume the seasonal pattern is **known in advance** (from simulation)
- The annual CFADS percentiles come from Monte Carlo, not from actuals
- Every quarter within a year uses the same annual figure

**In a real-world Gen 2 model**, the first few quarters would need
special handling:
- **Annualize**: Scale partial-year actuals to 12-month equivalent
  (e.g., 6 months of data × 2 = annualized estimate)
- **Use forecast fill**: Backfill missing months with projected revenue
- **Flag as N/A**: Don't report LTM until 4 full quarters of actuals exist
- **Blend**: Mix actuals with forecast for the trailing 12-month window

Most lenders use one of these approaches. Our Gen 1 simplification is
equivalent to the "forecast fill" approach — we treat projected revenue
as if it already happened.

### What this flattening hides: seasonal DSCR variation

The code **does** compute seasonal quarterly CFADS (line 221 of `finance.ts`):

```typescript
qCfads[k] = qRevPcts[k] - quarterlyOpex;   // varies by quarter (seasonal revenue)
```

But the DSCR displayed is always the **annual ratio** (line 214), not
`qCfads / quarterlyDS`. Here's what that masks:

```
Year 1 — What each quarter actually looks like vs what we show:

                Revenue    OpEx      CFADS      DS       True Q DSCR   Shown (LTM)
Q1 (winter):   $1.2M    - $0.575M = $0.625M  / $0.903M = 0.69x        0.93x
Q2 (spring):   $1.8M    - $0.575M = $1.225M  / $0.903M = 1.36x        0.93x
Q3 (summer):   $2.8M    - $0.575M = $2.225M  / $0.903M = 2.46x        0.93x
Q4 (fall):     $1.4M    - $0.575M = $0.825M  / $0.903M = 0.91x        0.93x
                                                         ─────         ─────
Annual:        $7.2M    - $2.3M   = $4.9M    / $3.61M  = 1.36x        0.93x
```

The seasonal swing (0.69x → 2.46x) is **invisible** in Gen 1. A lender
looking at Q1 would see a covenant breach at 0.69x, but our model shows
0.93x uniformly. This is the biggest limitation of the annual-ratio-
assigned-to-every-quarter approach.

**Gen 2 target:** Compute and display per-quarter DSCR alongside LTM DSCR
so seasonal covenant risk is visible.

### Why LTM DSCR is the same within a year (in our model)

In our current model (Gen 1), the seasonal revenue pattern **repeats
identically** every year. The monthly P50 revenues are the same in 2026
as in 2027 as in 2028. This means:

```
Annual CFADS (P50) = $5,400,000   (same every year)
```

The only thing that changes year to year is **debt service**, because
the loan is amortizing:

```
Year 1 DS:  $5,777,778   →   LTM DSCR = $5.4M / $5.78M = 0.93x
Year 2 DS:  $5,611,111   →   LTM DSCR = $5.4M / $5.61M = 0.96x
Year 3 DS:  $5,444,444   →   LTM DSCR = $5.4M / $5.44M = 0.99x
```

Because the revenue pattern repeats annually, the LTM DSCR at Q1 2026
is the same as Q2 2026, Q3 2026, and Q4 2026. It only changes when we
cross into Year 2 (where DS is lower).

```
Quarter    Cal Date     Annual CFADS(P50)   Annual DS      LTM DSCR(P50)
───────    ────────     ─────────────────   ─────────      ─────────────
Q1 '26     Jan-Mar 26      $5,400,000      $5,777,778        0.93x
Q2 '26     Apr-Jun 26      $5,400,000      $5,777,778        0.93x
Q3 '26     Jul-Sep 26      $5,400,000      $5,777,778        0.93x
Q4 '26     Oct-Dec 26      $5,400,000      $5,777,778        0.93x
─── Year boundary ───
Q1 '27     Jan-Mar 27      $5,400,000      $5,611,111        0.96x
Q2 '27     Apr-Jun 27      $5,400,000      $5,611,111        0.96x
Q3 '27     Jul-Sep 27      $5,400,000      $5,611,111        0.96x
Q4 '27     Oct-Dec 27      $5,400,000      $5,611,111        0.96x
─── Year boundary ───
Q1 '28     Jan-Mar 28      $5,400,000      $5,444,444        0.99x
...        ...              ...             ...               ...
```

### What the chart shows (Lifecycle view)

The heatmap for LTM DSCR changes in **annual steps** — same color for
all 4 quarters in a year, then shifts when debt service changes:

```
 '26         '27         '28         '29         '30     ... '43
├────────────┼────────────┼────────────┼────────────┼────
  0.93x        0.96x        0.99x        1.03x       1.06x
  (red)       (red)        (amber)      (green)     (green)
```

As the loan amortizes, annual DS decreases, so LTM DSCR improves
over the project lifetime. The project gets safer every year.

### Why not just sum quarterly CFADS?

You might think: "LTM = sum of the last 4 quarterly CFADS values, divided
by sum of the last 4 quarterly DS values." That's conceptually right, but
there's a **statistical trap**:

```
WRONG:   LTM DSCR (P50) = [Q1 CFADS(P50) + Q2 CFADS(P50) + Q3 CFADS(P50) + Q4 CFADS(P50)]
                           / Annual DS

         This gives: ($118K + $1,875K + $2,175K + $715K) / $5,778K = 0.85x
```

```
CORRECT: LTM DSCR (P50) = Annual CFADS (P50) / Annual DS

         This gives: $5,400,000 / $5,777,778 = 0.93x
```

The difference (0.85x vs 0.93x) exists because **the P50 of a sum is NOT
the sum of the P50s**. Percentiles don't add linearly.

Here's why: If Path #42 has an amazing Q3 but terrible Q1, and Path #77 has
the reverse, the P50 of each quarter might pick different paths. But the P50
of the annual sum picks the path whose **total** is at the median — and
seasonal highs/lows within that path cancel out.

Our code avoids this trap by using pre-computed **annual** CFADS percentiles
(from `computeFinancials()`) rather than summing quarterly P50s.

---

## 4. Quarterly DSCR vs LTM DSCR — Side by Side

Let's look at the same quarter from both perspectives:

### Q3 2026 (Jul–Sep): Peak Summer

```
                        Quarterly DSCR        LTM DSCR
                        (Forward 12M view)    (3-Year/Lifecycle view)
                        ──────────────────    ──────────────────────
Numerator:              Q3 CFADS (P50)        Annual CFADS (P50)
                        = $2,175,000          = $5,400,000

Denominator:            Q3 DS                 Annual DS
                        = $1,444,444          = $5,777,778

Result:                 1.51x                 0.93x
Interpretation:         Great quarter!        Tight year overall
```

### Q4 2026 (Oct–Dec): Winter Trough

```
                        Quarterly DSCR        LTM DSCR
                        (Forward 12M view)    (3-Year/Lifecycle view)
                        ──────────────────    ──────────────────────
Numerator:              Q4 CFADS (P50)        Annual CFADS (P50)
                        = $715,000            = $5,400,000

Denominator:            Q4 DS                 Annual DS
                        = $1,444,444          = $5,777,778

Result:                 0.49x                 0.93x
Interpretation:         Deep breach!          Same as every quarter
```

### The pattern

```
                 Quarterly DSCR          LTM DSCR
Quarter          (seasonal snapshot)     (annual smoothed)
────────         ──────────────────      ─────────────────
Q1 '26 (Mar)        0.68x                  0.93x
Q2 '26              1.30x                  0.93x
Q3 '26              1.51x                  0.93x
Q4 '26              0.49x                  0.93x

Visual:          ╱╲                      ────────────
                ╱  ╲                     flat line
               ╱    ╲
              ╱      ╲
```

**Quarterly DSCR** oscillates with the seasons.
**LTM DSCR** is flat within a year — it only changes at year boundaries
when debt service steps down.

### When each is used

| DSCR Type | Used For | Why |
|-----------|----------|-----|
| **Quarterly** | Cash trap tests, short-term monitoring | Shows whether the project can meet obligations THIS quarter |
| **LTM** | Annual covenant testing, credit analysis | Smooths out seasonality; answers "can this project service its debt over a full cycle?" |
| **Annual** | Term sheet negotiations, initial sizing | Simplest form; one number per year |

Lenders typically write covenants using **LTM DSCR** because they understand
that solar projects will have weak winter quarters. Testing quarterly would
trigger false covenant breaches every winter.

---

## 5. Percentile Bands — P10 through P90

### What the percentiles mean

The dashboard doesn't show just one DSCR number — it shows a **range** based
on revenue uncertainty from Monte Carlo simulation (1,000 paths):

```
Percentile   Revenue Meaning              DSCR Meaning
──────────   ──────────────────           ──────────────────
P90          Only 10% chance of           Optimistic DSCR
             doing this well              (high revenue scenario)

P75          25% chance of exceeding      Above-median DSCR

P50          Median — 50/50               Central DSCR estimate

P25          75% chance of exceeding      Below-median DSCR

P10          90% chance of exceeding      Conservative DSCR
             (only 10% downside)          (the "stress test")
```

**Important flip:** High revenue percentile (P90) gives high DSCR. But
lenders care about the **downside**, so they test at P10 DSCR (which
corresponds to the P10 revenue scenario — the bad case).

### Worked example: Q3 2026 at different percentiles

Assume these quarterly revenue percentiles for Q3 (Jul–Sep):

```
Percentile   Q3 Revenue    Q3 CFADS      Q3 DS         Quarterly DSCR
──────────   ──────────    ────────      ─────         ──────────────
P10          $2,200,000    $1,625,000    $1,444,444       1.12x
P25          $2,450,000    $1,875,000    $1,444,444       1.30x
P50          $2,750,000    $2,175,000    $1,444,444       1.51x
P75          $3,100,000    $2,525,000    $1,444,444       1.75x
P90          $3,500,000    $2,925,000    $1,444,444       2.02x
```

The spread from P10 to P90 is $1.3M in revenue, which translates to a
DSCR range of 1.12x to 2.02x. This is the "uncertainty band" visible
as the shaded area on the chart.

### How the heatmap uses percentiles

The heatmap background has 5 vertical bands, each colored by a different
percentile's DSCR:

```
    ┌──────────────────────────────┐
    │  P90 DSCR band (top 20%)    │  ← Optimistic (usually green)
    │  P75 DSCR band              │
    │  P50 DSCR band (middle)     │  ← Median (the main reference)
    │  P25 DSCR band              │
    │  P10 DSCR band (bottom 20%) │  ← Conservative (may be red)
    └──────────────────────────────┘
```

The color at each band reflects the DSCR value at that percentile:

| DSCR Value | Color | Meaning |
|------------|-------|---------|
| < minDscr (1.25x) | Red | Covenant breach |
| minDscr to minDscr + 0.25 | Amber | Close to breach |
| minDscr + 0.25 to minDscr + 0.75 | Light green | Comfortable |
| > minDscr + 0.75 | Dark green | Strong coverage |

So a column might be green at the top (P90 — optimistic) but red at the
bottom (P10 — stress case). This gives an instant visual read on both the
central case and the risk.

---

## 6. Reference — How Our Code Implements This

### Function mapping

| Dashboard View | DSCR Type | Function | File |
|---------------|-----------|----------|------|
| **Forward 12M** | Quarterly | `computeMonthlyViewData()` | `lib/finance.ts:273` |
| **3-Year** | LTM | `computeQuarterlyData()` | `lib/finance.ts:192` |
| **Lifecycle** | LTM | `computeQuarterlyData()` | `lib/finance.ts:192` |

### Data flow

```
API Response
  │
  ├── monthly_paths[]  ─────────────────────────────────────────────┐
  │   (path_id, month 1-12, monthly_revenue_usd)                   │
  │                                                                 │
  │   ┌──── computeQuarterlyPercentiles() ──── quarterlyRevPcts    │
  │   │     (stats.ts:163)                     PercentileMap[4]     │
  │   │     Groups by quarter, computes P10-P90 per quarter         │
  │   │                                                             │
  │   └──── computeMonthlyPercentiles() ────── monthlyRevPcts      │
  │         (stats.ts:127)                     PercentileMap[12]    │
  │         P10-P90 per calendar month                              │
  │                                                                 │
  ├── revenue_paths[]  ── simulated segment ── computeFinancials()  │
  │   (annual_revenue_usd)                     (finance.ts:143)     │
  │                                            │                    │
  │                                            ├── pctCfads (annual)│
  │                                            ├── loanSchedule     │
  │                                            │                    │
  │                    ┌───────────────────────-┤                    │
  │                    │                        │                    │
  │          computeQuarterlyData()    computeMonthlyViewData()     │
  │          (finance.ts:192)          (finance.ts:273)             │
  │                    │                        │                    │
  │              QuarterlyPoint[]      MonthlyViewPoint[] +         │
  │              with .ltmDscr         ForwardQuarterBlock[]        │
  │                    │               with .dscr                   │
  │                    │                        │                    │
  │            3-Year & Lifecycle         Forward 12M               │
  │            chart views               chart view                 │
  └─────────────────────────────────────────────────────────────────┘
```

### Key code snippets

**LTM DSCR** (used by 3-Year and Lifecycle):
```typescript
// finance.ts:208-215 — inside computeQuarterlyData()
// annualCfadsPcts is pre-computed from the full annual simulation
const ltmDscr: PercentileMap = {} as PercentileMap;
for (const k of keys) {
  ltmDscr[k] = row.debtService > 0
    ? annualCfadsPcts[k] / row.debtService
    : 0;
}
// Same ltmDscr assigned to all 4 quarters in this year
```

**Quarterly DSCR** (used by Forward 12M):
```typescript
// finance.ts:331-346 — inside computeMonthlyViewData()
// Sum monthly CFADS across months in this calendar quarter block
for (const k of keys) {
  let sum = 0;
  for (let m = blockStart; m <= blockEnd; m++) {
    sum += monthlyPoints[m].cfads[k];
  }
  qCfads[k] = sum;
}
// DS scales with month count (handles partial quarters)
const blockDS = monthlyDS * monthCount;
dscr[k] = blockDS > 0 ? qCfads[k] / blockDS : 0;
```

### Why two different approaches?

The Forward 12M view uses **monthly percentiles** → sum to quarter blocks,
because we need month-level granularity for the short-term view.

The Lifecycle/3-Year views use **annual CFADS percentiles** directly for
LTM DSCR, because summing quarterly percentiles would be statistically
incorrect (percentiles don't add linearly — see Section 3).

---

*This document uses simplified numbers for clarity. Actual dashboard values
come from Monte Carlo simulation paths and may differ. The calculation
methodology is identical.*
