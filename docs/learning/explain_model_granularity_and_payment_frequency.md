# Model Granularity & Payment Frequency

**The Gen 1 model computes everything annually and divides down for display — but real project finance debt has sub-annual payment schedules that change how interest accrues, covenants are tested, and cash sweeps trigger.**

---

## The Simple Version

Think of debt service like rent. Our model calculates **yearly rent** and then says "your monthly share is yearly ÷ 12." But a real landlord charges monthly — and if you're late on one month, interest accrues on that specific month, not as 1/12th of the annual penalty. The difference matters when cash flows are seasonal (solar earns most in summer, least in winter).

---

## How It Works Today (Gen 1)

```
                        Gen 1 Pipeline
                        ═════════════

  Annual Layer (source of truth)
  ┌─────────────────────────────────────────────┐
  │  buildAmortization()  →  LoanScheduleRow[]  │
  │  Year 1: DS = $3.61M                        │
  │  Year 2: DS = $3.44M                        │
  │  ...                                        │
  │  Revenue P50 = $8.2M   OpEx = $2.3M         │
  │  CFADS P50  = $5.9M    DSCR = 1.63x         │
  └──────────┬────────────────────┬─────────────┘
             │                    │
        ÷ 4  │               ÷ 12│
             ▼                    ▼
  ┌──────────────────┐  ┌──────────────────┐
  │  Quarterly View  │  │  Monthly View    │
  │  DS = $0.903M/Q  │  │  DS = $0.301M/mo │
  │  OpEx = $0.575M  │  │  OpEx = $0.192M  │
  │  LTM DSCR = 1.63x│  │  Block DSCR varies│
  └──────────────────┘  └──────────────────┘

  Key: every sub-annual number is annual ÷ N
  No compounding, no day-count, no actual payment dates
```

---

## Granularity Table: Gen 1 vs Industry Standard

| Component | Gen 1 Granularity | How Sub-Annual Is Derived | Industry Standard | Where We Might Get It Wrong |
|-----------|-------------------|---------------------------|-------------------|-----------------------------|
| **Debt service** | Annual | ÷4 (quarterly), ÷12 (monthly) | **Quarterly or semi-annual** payments with actual compounding per period | DS timing matters: a Q3 payment due in summer aligns with high solar revenue; our flat ÷4 misses this cash flow matching |
| **Interest accrual** | Annual (applied to opening balance once/year) | Not sub-divided — same annual interest regardless of view | **Quarterly or monthly** compounding on actual period balances; day-count conventions (30/360, ACT/365) | Annual compounding underestimates total interest cost. At 6% on $50M: annual = $3.0M vs quarterly = $3.05M vs monthly = $3.08M in Year 1 |
| **Principal repayment** | Annual | Same as DS division | **Quarterly or semi-annual** amortization; balance reduces intra-year after each payment | We show a flat balance all year, but in reality it steps down after each payment — affects interest calc for next period |
| **Revenue** | Annual totals + 12-month seasonal profile | Monthly from API data; quarterly = sum of 3 months | **Monthly or hourly** metered revenue; annual varies with degradation, PPA escalators, merchant price forecasts | Seasonal profile repeats identically every year — no degradation (0.5%/yr solar), no PPA escalator, no merchant curve shape changes |
| **OpEx** | Annual, flat | ÷4 (quarterly), ÷12 (monthly) | **Monthly with seasonality** — scheduled maintenance windows (spring/fall), insurance payments (annual lump), land lease (quarterly) | A $2.3M annual OpEx isn't $192k/month — a $400k maintenance outage in April means $600k that month but ~$150k in others |
| **DSCR covenant test** | Annual (implicit) | LTM DSCR = annual DSCR in Gen 1 | **Quarterly or semi-annual** covenant test dates; trailing 12-month DSCR calculated at each test | If Q1 has weak revenue and Q3 is strong, annual DSCR might pass (1.30x) but Q1 trailing test could breach (1.05x) — we'd miss that |
| **Cash sweep** | Not modeled | — | **Semi-annual or annual** excess cash sweep after DS, maintenance reserve, and distribution lock-up test | Sweep timing changes effective yield and average life; lenders model this explicitly |
| **Reserve accounts** | Not modeled | — | **6-month DS reserve** (DSRA) funded at close or over time; maintenance reserve; revenue lock-up | Reserve draws/replenishments affect available cash and can trigger technical defaults even when DSCR looks fine |

### Code References

| Division | File | Line | Code |
|----------|------|------|------|
| Quarterly DS | `lib/finance.ts` | 205 | `row.debtService / 4` |
| Monthly DS | `lib/finance.ts` | 283 | `annualDS / 12` |
| Quarterly OpEx | `lib/finance.ts` | 201 | `annualOpex / 4` |
| Monthly OpEx | `lib/finance.ts` | 282 | `annualOpex / 12` |

---

## The Five Terms That Shape Debt Service

Before diving into worked examples, it's worth understanding the five
terms that determine how debt service is calculated. Each one has a
Gen 1 value and a Gen 2 target — and together they explain why
"annual ÷ 4" is not the same as true quarterly DS.

### 1. Interest rate: nominal vs periodic vs effective

The term sheet states a **nominal annual rate** (e.g., 5.75%). But when
payments happen sub-annually, the rate applied per period is different
from the annual rate, and the total cost depends on how you convert:

```
Nominal annual rate:  5.75%  (what the term sheet says)

Simple conversion (Gen 1):
  Quarterly:  5.75% / 4   = 1.4375%  per quarter
  Monthly:    5.75% / 12  = 0.4792%  per month
  This is what we use — divide the annual rate by N.

Effective annual rate (what you actually pay with quarterly compounding):
  (1 + 0.014375)^4 - 1 = 5.875%
  The compounding makes the true cost higher than the nominal rate.
```

**What this means concretely ($213M at 5.75%):**

| Compounding | Year 1 interest | Effective rate |
|-------------|----------------|----------------|
| Annual (Gen 1) | $12,247,500 | 5.750% |
| Quarterly | $12,162,946 | 5.875% effective, but less total interest because balance reduces intra-year |
| Monthly | $12,128,417 | 5.904% effective, even less total interest |

The paradox: quarterly compounding has a **higher effective rate** but
produces **less total interest** because each payment reduces the balance
sooner. The balance reduction effect dominates.

**Gen 1:** Uses nominal annual rate applied once per year. No conversion.
**Gen 2:** Will use periodic rate (nominal ÷ N) applied each period.

### 2. Compounding frequency: when interest accrues

Compounding frequency determines how often the interest is calculated and
applied to the balance:

```
$213M loan, 5.75% nominal, Year 1:

Annual compounding (Gen 1):
  Interest calculated ONCE:
  Jan ──────────────────────────────────────── Dec
  │           $213M × 5.75% = $12.25M          │
  └─────────────────────────────────────────────┘
  One calculation, one number, applied at year-end.

Quarterly compounding (Gen 2 target):
  Interest calculated FOUR TIMES on declining balance:
  Jan─── Mar   Apr─── Jun   Jul─── Sep   Oct─── Dec
  │ $3.06M │   │ $3.02M │   │ $2.98M │   │ $2.93M │
  └────────┘   └────────┘   └────────┘   └────────┘
  $213.0M       $210.0M       $207.1M       $204.1M
  (opening)    (after Q1     (after Q2     (after Q3
                payment)      payment)      payment)
```

The declining interest across quarters is the key difference — Gen 1
shows flat $3.06M per quarter (annual $12.25M ÷ 4), Gen 2 would show
$3.06M → $3.02M → $2.98M → $2.93M as the balance steps down.

### 3. Payment frequency: when cash actually leaves

Payment frequency is a **contractual term** — it's set in the credit
agreement and determines when the borrower must make debt service payments:

| Frequency | Periods/year | Common in | Balance updates |
|-----------|-------------|-----------|-----------------|
| **Annual** | 1 | Some international deals | Once per year — balance sits high all year |
| **Semi-annual** | 2 | Many US project finance loans | Twice per year — common in infrastructure |
| **Quarterly** | 4 | Most global project finance | Four times — the standard for covenant testing |
| **Monthly** | 12 | Corporate/mortgage, rare in PF | Twelve times — finest granularity |

**Why more frequent payments = less total interest:**

```
$213M at 5.75%, level principal, Year 1:

Annual (1 payment):
  Balance stays at $213M for 12 months
  Interest = $213M × 5.75% = $12,247,500

Quarterly (4 payments):
  Balance: $213M → $210M → $207M → $204M
  Interest = $3.06M + $3.02M + $2.98M + $2.93M = $11,992,944

Difference: $254,556 less interest in Year 1 alone.
Over 18 years: ~$2.3M less total interest with quarterly payments.
```

The borrower benefits from paying down principal sooner. The lender
receives cash sooner. Both sides typically prefer sub-annual payments.

**Gen 1:** No payment frequency concept — annual computation, ÷ N display.
**Gen 2:** `paymentFrequency` field on `LoanConfig` (quarterly, semi-annual,
or annual). `buildAmortization()` would produce one row per payment period.

### 4. Day count convention: how "days" are measured

When computing interest for a specific period, you need to know how many
"days" that period contains. Different conventions give different answers:

| Convention | Year basis | Day counting | Example: Q1 (Jan-Mar) interest on $213M at 5.75% |
|-----------|-----------|-------------|--------------------------------------------------|
| **30/360** | 360 days | Each month = 30 days | $213M × 5.75% × 90/360 = $3,061,875 |
| **ACT/365** | 365 days | Actual calendar days (90 in Q1) | $213M × 5.75% × 90/365 = $3,019,110 |
| **ACT/360** | 360 days | Actual calendar days, 360-day year | $213M × 5.75% × 90/360 = $3,061,875 |

The differences are small per quarter (~$43K between 30/360 and ACT/365)
but accumulate over 18 years and matter in loan documentation.

**Why conventions vary:**
- **30/360** — simplest; every quarter is exactly 90 "days." Favoured in
  US fixed-rate project finance because it's predictable.
- **ACT/365** — used in UK, Australia, and floating-rate deals. Q1 (90 days)
  and Q3 (92 days) produce different interest amounts.
- **ACT/360** — common for SOFR/LIBOR-based floating rate. Slightly
  inflates interest (365 actual days but only 360 in the denominator).

**Gen 1:** No day count — we use `balance × annualRate` (implicitly 30/360
at annual level, which is the same as no convention at all).
**Gen 2:** `dayCount` field on `LoanConfig`. The amortization loop would
use period days / year basis to compute interest per period.

### 5. Outstanding balance: the declining denominator

Interest is always `balance × rate × time`. The balance is what makes
sub-annual computation non-trivial — it changes after every payment:

```
Gen 1 — balance is flat within each year:

$213M ████████████████████████████████████████ Year 1
$201M ██████████████████████████████████████   Year 2
$189M ████████████████████████████████████     Year 3
      ↑                                       ↑
  one step-down                          one step-down
  per year                               per year

Gen 2 — balance steps down after each quarterly payment:

$213M ████████████
$210M ██████████                           4 step-downs
$207M ████████         Year 1              per year
$204M ██████
$201M ████████████
$198M ██████████                           4 step-downs
$195M ████████         Year 2              per year
$192M ██████
```

In Gen 1, interest is calculated on the **Year 1 opening balance**
($213M) for the entire year. In Gen 2, interest after Q1 is calculated
on $210M (lower), after Q2 on $207M (lower still). Each step-down
reduces the interest in the next period.

This is the root cause of the ÷4 ≠ true quarterly gap: Gen 1 doesn't
know the balance changed mid-year, so it overcharges interest in Q2–Q4.

### How these five terms interact

```
Term sheet says:     $213M, 5.75%, 18yr, quarterly payments, 30/360

For each quarter:
  1. Day count:        How many days in this quarter? (30/360 → 90 days)
  2. Periodic rate:    5.75% × 90/360 = 1.4375%
  3. Opening balance:  Start of period balance (changes after each payment)
  4. Interest:         Balance × periodic rate
  5. Principal:        Scheduled repayment for this period
  6. DS:               Interest + principal
  7. New balance:      Old balance − principal → feeds step 3 of next period

Gen 1 skips steps 1-3 by using annual rate × annual balance once per year,
then dividing the result. Gen 2 would execute all 7 steps for each period.
```

---

## What "True Payment Frequency Modeling" Means

### Example: $50M loan, 6% rate, 18-year tenor, level payment

**Gen 1 (annual)**:
```
Annual payment = $50M × [0.06 × 1.06^18] / [1.06^18 - 1] = $4.615M

Year 1:
  Opening balance:  $50,000,000
  Interest (6%):     $3,000,000
  Principal:         $1,615,000
  Closing balance:  $48,385,000

  → Quarterly display: $4.615M / 4 = $1.154M per quarter
  → Monthly display:   $4.615M / 12 = $384,583 per month
```

**True quarterly payments (Gen 2 target)**:
```
Quarterly rate = 6% / 4 = 1.5% per quarter
Periods = 18 × 4 = 72
Quarterly payment = $50M × [0.015 × 1.015^72] / [1.015^72 - 1] = $1.166M

Quarter 1 (Jan-Mar):
  Opening balance:  $50,000,000
  Interest (1.5%):     $750,000
  Principal:           $416,000
  Closing balance:  $49,584,000

Quarter 2 (Apr-Jun):
  Opening balance:  $49,584,000    ← balance already reduced
  Interest (1.5%):     $743,760    ← less interest because balance dropped
  Principal:           $422,240
  Closing balance:  $49,161,760

Quarter 3 (Jul-Sep):
  Opening balance:  $49,161,760
  Interest:            $737,426
  Principal:           $428,574
  ...
```

**The difference that matters:**

| Metric | Gen 1 (annual ÷ 4) | True Quarterly |
|--------|---------------------|----------------|
| Q1 payment | $1,153,750 | $1,166,000 |
| Q1 interest | $750,000 (annual $3M ÷ 4) | $750,000 |
| Q2 interest | $750,000 (same — no balance update) | $743,760 |
| Year 1 total interest | $3,000,000 | $2,965,549 |
| Year 1 total DS | $4,615,000 | $4,664,000 |
| **Total interest over 18 years** | **$33,075,000** | **$33,960,000** |

Gen 1 underestimates total debt service by ~$885K over the life because it misses intra-year compounding. For a 6% rate this is ~2.7% error. At higher rates (8-10%), the gap grows.

### Why It Matters for DSCR

With **true quarterly** modeling and **seasonal revenue**:

```
                    Revenue     DS         DSCR
                    (quarterly) (quarterly) (quarterly)
  Q1 (Jan-Mar):    $1.2M       $1.166M    1.03x  ← BREACH if min = 1.25x
  Q2 (Apr-Jun):    $1.8M       $1.166M    1.54x  ← comfortable
  Q3 (Jul-Sep):    $2.8M       $1.166M    2.40x  ← very safe
  Q4 (Oct-Dec):    $1.4M       $1.166M    1.20x  ← marginal

  Annual DSCR:     $7.2M / $4.664M = 1.54x ← PASS

Gen 1 sees 1.54x annual DSCR and says PASS.
True quarterly model catches Q1 breach at 1.03x.
```

This is exactly the scenario lenders stress-test — seasonal revenue dips that breach quarterly covenants even when the annual number looks healthy.

---

## Interest → DS Conversion: Tracing the Code Path

The previous section used a $50M level_payment example. This section
traces the **actual code** with our default site (Gemini Solar Hybrid,
$213M, 5.75%, 18yr, level_principal) to show exactly what Gen 1 does
and how Gen 2 would differ.

### Step 1: What the code receives

```typescript
// page.tsx → resolveDefaultLoan() produces:
{
  principal:    213_000_000,   // $213M (revenue-constrained)
  annualRate:   0.0575,        // 5.75% nominal annual
  tenorYears:   18,
  amortType:    "level_principal",
}
```

### Step 2: How Gen 1 computes interest (annual, once per year)

The function `buildAmortization()` in `finance.ts` runs this loop:

```typescript
// level_principal branch (finance.ts:190-205)
const principalPmt = principal / tenorYears;       // $213M / 18 = $11,833,333

for (let t = 1; t <= tenorYears; t++) {
  const interest = balance * annualRate;            // balance × 5.75%
  const debtService = principalPmt + interest;
  balance = balance - principalPmt;
}
```

**Year 1 trace:**

```
Input:
  balance     = $213,000,000
  annualRate  = 0.0575
  tenorYears  = 18

Calculation:
  principalPmt = $213,000,000 / 18           = $11,833,333
  interest     = $213,000,000 × 0.0575       = $12,247,500
  debtService  = $11,833,333 + $12,247,500   = $24,080,833
  new balance  = $213,000,000 - $11,833,333  = $201,166,667

Output:  LoanScheduleRow {
  year: 1,
  openingBalance:  $213,000,000,
  interest:        $12,247,500,
  principal:       $11,833,333,
  debtService:     $24,080,833,    ← this is the ANNUAL figure
  closingBalance:  $201,166,667,
}
```

**Year 2 trace:**

```
  balance      = $201,166,667     (reduced after Year 1 payment)
  interest     = $201,166,667 × 0.0575 = $11,567,083   ← less (balance lower)
  debtService  = $11,833,333 + $11,567,083 = $23,400,417
```

### Step 3: How Gen 1 converts to sub-annual (÷ N)

For the quarterly view (`computeQuarterlyData()`):

```typescript
const quarterlyDS = row.debtService / 4;   // finance.ts:280
```

For the monthly view (`computeMonthlyViewData()`):

```typescript
const monthlyDS = annualDS / 12;            // finance.ts:358
```

**Year 1 quarterly display:**

```
Q1 2026:  $24,080,833 / 4 = $6,020,208
Q2 2026:  $24,080,833 / 4 = $6,020,208    ← identical
Q3 2026:  $24,080,833 / 4 = $6,020,208    ← identical
Q4 2026:  $24,080,833 / 4 = $6,020,208    ← identical
```

All four quarters show the same DS. The balance doesn't change within the
year. Interest doesn't change within the year. It's one annual computation
spread flat across four display slots.

### Step 4: What Gen 2 would compute (true quarterly)

Same loan, but payments actually happen quarterly:

```
Periodic rate = 5.75% / 4 = 1.4375% per quarter
Annual principal per quarter = $213M / (18 × 4) = $213M / 72 = $2,958,333

Q1 2026:
  Opening balance:  $213,000,000
  Interest:         $213,000,000 × 1.4375% = $3,061,875
  Principal:        $2,958,333
  DS:               $3,061,875 + $2,958,333 = $6,020,208
  Closing balance:  $213,000,000 - $2,958,333 = $210,041,667

Q2 2026:
  Opening balance:  $210,041,667              ← balance dropped by $2.96M
  Interest:         $210,041,667 × 1.4375% = $3,019,349
  Principal:        $2,958,333
  DS:               $3,019,349 + $2,958,333 = $5,977,683   ← $42K less than Q1
  Closing balance:  $207,083,333

Q3 2026:
  Opening balance:  $207,083,333
  Interest:         $207,083,333 × 1.4375% = $2,976,823
  Principal:        $2,958,333
  DS:               $2,976,823 + $2,958,333 = $5,935,157   ← $85K less than Q1
  Closing balance:  $204,125,000

Q4 2026:
  Opening balance:  $204,125,000
  Interest:         $204,125,000 × 1.4375% = $2,934,297
  Principal:        $2,958,333
  DS:               $2,934,297 + $2,958,333 = $5,892,631   ← $128K less than Q1
  Closing balance:  $201,166,667
```

### Step 5: Comparing the two side by side

**Year 1 quarterly DS:**

```
Quarter     Gen 1 (÷4)    Gen 2 (true Q)    Difference
──────      ──────────    ──────────────    ──────────
Q1 2026     $6,020,208     $6,020,208       $0          (identical — same opening balance)
Q2 2026     $6,020,208     $5,977,683      −$42,525     (Gen 2 lower — balance shrank)
Q3 2026     $6,020,208     $5,935,157      −$85,051
Q4 2026     $6,020,208     $5,892,631      −$127,577
──────      ──────────    ──────────────    ──────────
Year total  $24,080,833   $23,825,679      −$255,154
```

**Key observations:**

1. **Q1 is identical** — both start from the same balance, same rate.
   The divergence only appears once the balance changes intra-year.

2. **Gen 1 overcharges later quarters** — flat ÷4 means Q4 pays $128K
   more than it should, because Gen 1 doesn't know the balance dropped
   after Q1-Q3 payments.

3. **Gen 1 overestimates Year 1 total DS by $255K** — because it applies
   interest on the full opening balance for the whole year, instead of on
   the declining quarterly balance.

4. **Over 18 years, this compounds** — each year's overestimate feeds into
   the next. Total interest over the life of the loan differs by ~2-3%.

### Step 6: Impact on DSCR

Using Gemini Solar Hybrid revenue (P50 CFADS ~$33.8M):

```
                  Gen 1               Gen 2 (true quarterly)
Quarter    DS        DSCR(P50)    DS        DSCR(P50)
──────    ────────  ─────────    ────────  ─────────
Q1 2026   $6.02M    (*)          $6.02M    (*)
Q2 2026   $6.02M    (*)          $5.98M    (*)
Q3 2026   $6.02M    (*)          $5.94M    (*)
Q4 2026   $6.02M    (*)          $5.89M    (*)

Annual    $24.08M   1.40x        $23.83M   1.42x

(*) Quarterly DSCR uses seasonal quarterly CFADS, not annual P50 ÷ 4.
    The annual DSCR is the meaningful comparison here.
```

Gen 2 would show a slightly higher annual DSCR (1.42x vs 1.40x) because
total DS is lower. But more importantly, the **quarterly DSCR profile
changes shape** — Q4 becomes easier to service (lower DS) even though
it's also the lowest revenue quarter (winter). This changes where the
binding constraint appears.

### What would need to change in the code for Gen 2

```
Current (Gen 1):                     Target (Gen 2):
────────────────                     ────────────────
LoanConfig {                         LoanConfig {
  principal                            principal
  annualRate                           annualRate
  tenorYears                           tenorYears
  amortType                            amortType
                                       paymentFrequency  ← NEW (quarterly/semi/annual)
                                       dayCount          ← NEW (30/360, ACT/365)
}                                    }

buildAmortization():                 buildAmortization():
  loop: 1..tenorYears                  periodsPerYear = freq → 4 or 2 or 1
  interest = balance × annualRate      periodicRate = annualRate / periodsPerYear
  principalPmt = P / tenorYears        totalPeriods = tenorYears × periodsPerYear
  balance -= principalPmt              loop: 1..totalPeriods
                                         interest = balance × periodicRate
                                         principalPmt = P / totalPeriods
                                         balance -= principalPmt

Output: 18 annual rows               Output: 72 quarterly rows (or 36 semi-annual)
Then: ÷4 for display                 Then: direct — no division needed
```

The key shift: `buildAmortization()` currently produces **18 annual rows**
that get divided for display. Gen 2 would produce **72 quarterly rows**
(or whatever the payment frequency dictates) that ARE the display — no
division step.

---

## Common Misconceptions

| You might think... | But actually... |
|--------------------|-----------------|
| Annual ÷ 4 = quarterly debt service | Only if payments are truly annual. With quarterly amortization, compounding changes the split — early quarters pay more interest, later quarters pay more principal |
| DSCR is DSCR regardless of frequency | Annual DSCR can mask quarterly breaches. A 1.40x annual DSCR could contain a 0.90x winter quarter for solar |
| OpEx is evenly distributed | Maintenance is seasonal (spring/fall outages), insurance is often annual, land lease may be quarterly. Flat ÷12 misses cash flow lumpiness |
| Monthly view shows real monthly economics | It shows annual economics divided by 12 with seasonal revenue layered on top. The revenue seasonality is real; the cost seasonality is not |
| Interest rate ÷ 4 = quarterly rate | Close but not exact. 6% annual = 1.467% true quarterly (compounded), not 1.5% simple quarterly. The difference is small but compounds over 18 years |

---

## How It Connects

```
This document          Feeds into
──────────────         ──────────────────────────────────
Granularity gaps  →    Gen 2 planning (payment frequency as LoanConfig field)
Seasonal DS       →    Quarterly covenant testing (DSCR at each test date)
OpEx seasonality  →    Monthly cash flow waterfall (not yet built)
Reserve accounts  →    Distribution lock-up logic (not yet built)
True compounding  →    buildAmortization() enhancement (quarterly/semi-annual periods)
```

**Related docs:**
- `docs/learning/project-finance-basics.md` — conventions and terminology
- `docs/learning/examples/dscr-calculations-by-view.md` — worked DSCR examples across views
- `scripts/dashboard/lib/finance.ts` — all computation logic
- `scripts/dashboard/types/index.ts` — `LoanConfig`, `LoanScheduleRow` types
