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
