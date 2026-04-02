---
title: "Default Loan Sizing — How the Dashboard Picks Starting Parameters"
type: learning / explanation
domain: project-finance / dashboard
created: 2026-04-01
relates-to:
  - ./project-finance-basics.md
  - ./explain_model_granularity_and_payment_frequency.md
  - ./examples/dscr-calculations-by-view.md
  - ../../scripts/dashboard/lib/finance.ts
---

# Default Loan Sizing

> **Purpose:** Explain how the dashboard computes initial loan parameters
> (principal, rate, tenor) for each site, why the heuristics were chosen,
> and what they mean in industry context. After reading this, you should
> be able to explain why Gemini Solar Hybrid opens with a $621M principal
> at 5.75% for 18 years — and why a 50 MW wind farm would get something
> very different.

---

## 1. The Problem

Every site in the dashboard needs a starting loan configuration. Without
smart defaults, the user sees the same $50M / 6% / 18yr for every site —
whether it's a 1 MW rooftop or a 690 MW utility-scale plant. That makes
the initial DSCR and KPI numbers meaningless until the user manually
adjusts everything.

What we want: **when you select a site, the loan parameters should
approximate what a real lender might offer that project**, so the
dashboard shows realistic financial metrics from the first click.

---

## 2. What We Know About Each Site

From the asset registry, we have:

```
asset_slug:       gemini_solar_hybrid
asset_type:       solar
state:            NV
ac_capacity_mw:   690.0
```

That's it. We don't have term sheets, credit ratings, or lender quotes.
So we derive defaults from these three signals: **capacity**, **asset
type**, and **industry benchmarks**.

---

## 3. The Heuristics

### A. Principal — "How much debt can this project support?"

The principal is the **minimum** of two constraints — just like in a
real term sheet where the lender applies multiple tests and the most
restrictive one wins:

```
Principal = min(CapEx Constraint, Revenue Constraint)
```

#### Constraint 1: CapEx-based ceiling

```
CapEx Principal = Capacity (MW) x CapEx per MW x Leverage Ratio
```

**CapEx per MW** — estimated total installed cost (NREL ATB 2024 Moderate):

| Asset Type | CapEx / MW | Source |
|------------|-----------|--------|
| Solar PV | $1.2M | NREL ATB 2024, utility-scale |
| Onshore Wind | $1.5M | NREL ATB 2024 |
| Battery (4hr) | $1.8M | NREL ATB 2024, Li-ion BESS |

**Leverage Ratio** — what fraction of total project cost is financed
with debt (the rest is equity):

| Asset Type | Leverage | Why |
|------------|----------|-----|
| Solar | 75% | Most predictable generation profile. Typical range: 70-80%. |
| Wind | 70% | Higher resource variability. Typical range: 65-75%. |
| Battery | 60% | Newer technology, merchant revenue risk. Typical range: 50-65%. |

#### Constraint 2: Revenue-based ceiling (DSCR-constrained)

Even if a project costs $828M to build and 75% leverage is "normal,"
the actual revenue may not support that much debt. A lender would check:
"at this loan size, does the P50 DSCR meet our sizing target?"

**Sizing DSCR targets** (higher than covenant minimums — the headroom
ensures the project can withstand some downside before breaching):

| Asset Type | Sizing Target | Covenant Min | Headroom |
|------------|--------------|-------------|----------|
| Solar | 1.40x | 1.25x | +0.15x |
| Wind | 1.45x | 1.35x | +0.10x |
| Battery | 2.20x | 2.00x | +0.20x |

**The formula** (for level_principal amortization):

```
Year 1 DS = Principal/Tenor + Principal × Rate
          = Principal × (1/Tenor + Rate)

We want:  P50_CFADS / Year1_DS >= sizing_target
So:       Year1_DS <= P50_CFADS / sizing_target
And:      Principal <= (P50_CFADS / sizing_target) / (1/Tenor + Rate)
```

#### Why the binding constraint matters

```
                     CapEx says:         Revenue says:
                     "You could borrow   "You can only SERVICE
                      up to $621M"        $213M of debt"
                          │                     │
                          ▼                     ▼
                     ┌─────────┐          ┌─────────┐
                     │  $621M  │          │  $213M  │
                     └─────────┘          └─────────┘
                                 │
                            min( , ) = $213M  ← BINDING
```

Without the revenue check, the dashboard would show a $621M loan with
0.36x DSCR and 90 covenant breaches — a project that can't pay its
bills. With the revenue check, it shows ~$213M with ~1.40x DSCR — a
properly sized deal.

### Worked Example — Gemini Solar Hybrid (690 MW Solar, NV)

```
Step 1: CapEx constraint
  Asset Value  = 690 MW × $1.2M/MW      = $828,000,000
  CapEx limit  = $828M × 75%            = $621,000,000

Step 2: Revenue constraint
  P50 Revenue  ≈ $49.7M/yr   (from 1,000 simulated paths)
  OpEx         = $15.87M/yr   (690 MW × $23k/MW)
  P50 CFADS    = $49.7M - $15.87M       = $33.8M/yr

  Sizing target = 1.40x (solar)
  Max Year 1 DS = $33.8M / 1.40         = $24.14M
  Revenue limit = $24.14M / (1/18 + 0.0575)
                = $24.14M / 0.1131      = $213,000,000

Step 3: Binding constraint
  Principal = min($621M, $213M) = $213,000,000  ← revenue-constrained

Check:
  Y1 principal repayment = $213M / 18   = $11,833,333
  Y1 interest            = $213M × 5.75%= $12,247,500
  Y1 total DS                           = $24,080,833
  P50 DSCR (Y1) = $33.8M / $24.1M      = 1.40x  ✓
  LTV           = $213M / $828M         = 25.7%
```

The revenue constraint wins here — 690 MW is a very large plant, but
its actual cashflow (driven by NV market prices) doesn't support the
full CapEx-based leverage.

### Worked Example — Small Solar (50 MW Solar, TX)

For a smaller plant where revenue per MW is higher (e.g., ERCOT market):

```
CapEx limit    = 50 × $1.2M × 75%       = $45,000,000
Revenue limit  = (say P50 CFADS = $5.2M)
               = ($5.2M / 1.40) / (1/18 + 0.0575)
               = $3.71M / 0.1131        = $32,828,000

Binding: $33M (revenue-constrained, if CFADS is low)
   — or $45M (CapEx-constrained, if CFADS is high enough)
```

Which constraint binds depends on the site's actual revenue data.

### Why rounding?

Real term sheets say "$213M" not "$213,438,721." The code rounds to
the nearest $1M:

```typescript
Math.round(principal / 1_000_000) * 1_000_000
```

---

### B. Interest Rate — "What rate does this asset type command?"

| Asset Type | Default Rate | Rationale |
|------------|-------------|-----------|
| Solar | 5.75% | Most predictable generation. Strong track record of PPA-backed solar deals. Lenders price lower risk = lower spread. |
| Wind | 6.25% | Higher resource variability means higher risk premium. Wind speed forecast error (~10-15%) exceeds solar irradiance error (~5-8%). |
| Battery | 7.00% | Technology risk (degradation uncertainty), merchant revenue exposure (arbitrage margins fluctuate), shorter operating history as an asset class. |

**Context — US project finance rates (2024-25):**

```
Base rate (SOFR/Treasury):     ~4.5-5.0%
Credit spread (solar):         +1.0-1.5%
Credit spread (wind):          +1.5-2.0%
Credit spread (battery):       +2.0-2.5%
                               ─────────
All-in rate range:             5.5% - 7.5%
```

Our defaults sit in the middle of each range — not aggressive, not
conservative.

**What we don't model:** Rate varies with leverage (higher leverage =
higher spread), tenor (longer = higher), market timing (spreads compress
in competitive markets), and credit quality of the offtaker (investment-
grade PPA buyer = lower spread). These are deal-specific and beyond what
we can derive from asset metadata alone.

---

### C. Tenor — "How long is the loan?"

| Asset Type | Default Tenor | Rationale |
|------------|--------------|-----------|
| Solar | 18 years | Industry standard for utility-scale solar. PV panels have 25-30 year warranties; 18yr debt gives ~7-12 years of tail beyond maturity. |
| Wind | 15 years | Shorter due to mechanical wear on gearboxes, blades. Turbine useful life ~25 years but maintenance costs rise sharply after year 15. |
| Battery | 12 years | Li-ion degradation (capacity fades ~2-3%/year). After 10-12 years, round-trip efficiency and capacity may not support original revenue assumptions. |

**The "tail" concept:**

```
Solar:   |──── 18yr debt ────|─── 7-12yr tail ───|
         COD                 Maturity             End of asset life (25-30yr)

Wind:    |──── 15yr debt ────|──── 10yr tail ────|
         COD                 Maturity             End of asset life (25yr)

Battery: |──── 12yr debt ────|── 8yr tail ──|
         COD                 Maturity        End of asset life (20yr)
```

Lenders want a "tail" — years of remaining asset life after the loan
matures. This provides a refinancing/sale exit if the project needs to
be restructured. Longer tail = more comfortable lender.

---

## 4. What Happens on Site Change

When the user selects a different site, the dashboard:

1. Fetches new site data (revenue paths, asset metadata)
2. Calls `resolveDefaultLoan(asset)` to compute new defaults
3. **Resets all loan parameters** to the computed values
4. **Clears OpEx and MinDscr overrides** (these are already per-site)
5. Recomputes all financial metrics with the fresh configuration

This means switching from Gemini Solar (690 MW) to a 50 MW wind farm
instantly updates principal from $621M to $52M, rate from 5.75% to
6.25%, and tenor from 18yr to 15yr.

**The user can still override everything.** These are starting points,
not constraints.

---

## 5. How Defaults Interact with Other Per-Site Parameters

The dashboard already had two per-site-derived parameters before this
change. Now there are five:

| Parameter | Derived From | Function | Existed Before? |
|-----------|-------------|----------|-----------------|
| **Principal** | min(CapEx x leverage, DSCR-constrained) | `resolveDefaultLoan()` | No (was $50M fixed) |
| **Rate** | asset type | `resolveDefaultLoan()` | No (was 6.0% fixed) |
| **Tenor** | asset type | `resolveDefaultLoan()` | No (was 18yr fixed) |
| **OpEx** | capacity x NREL rate | `resolveOpex()` | Yes |
| **Min DSCR** | asset type | `resolveMinDscr()` | Yes |

Together, these five parameters mean the dashboard produces a
**site-appropriate financial picture** without any user input.

---

## 6. Example: Full Default Configuration for Gemini Solar Hybrid

```
Asset:       gemini_solar_hybrid (solar, NV, 690 MW)

Sizing:
  CapEx ceiling:   $621M  (690 × $1.2M × 75%)
  Revenue ceiling: $213M  (P50 CFADS $33.8M / 1.40x sizing target)
  Binding:         $213M  ← revenue-constrained

Loan:
  Principal:     $213,000,000   (DSCR-constrained)
  Rate:          5.75%          (solar default)
  Tenor:         18 years       (solar default)
  Amortization:  level principal

Operating:
  OpEx:          $15,870,000/yr (690 MW × $23,000/MW-yr — NREL ATB 2024)

Covenant:
  Min DSCR:      1.25x          (solar default — Norton Rose Fulbright 2024)

Derived:
  Asset Value:   $828,000,000   (690 MW × $1.2M/MW)
  LTV:           25.7%          ($213M / $828M)

Year 1 Debt Service (level principal):
  Principal:     $213M / 18      = $11,833,333
  Interest:      $213M × 5.75%   = $12,247,500
  Total DS:                      = $24,080,833

  DSCR (P50, Y1) = $33.8M / $24.1M = 1.40x  ✓ meets sizing target
  DSCR (P10, Y1) ≈ $25.6M / $24.1M = 1.06x  ← below covenant (expected at P10)
```

Note: P10 DSCR below covenant in Year 1 is realistic — lenders size on
P50 and treat P10 as a stress test. The P10 DSCR improves in later
years as debt service declines with amortization.

---

## 7. Limitations and What This Is NOT

This heuristic is a **starting point for exploration**, not a credit
analysis or term sheet.

| What we do | What we don't do |
|------------|-----------------|
| Size debt from min(CapEx, DSCR-constrained) | Account for PPA vs merchant revenue structure |
| Use P50 CFADS as the revenue signal | Adjust for sponsor credit quality or track record |
| Apply type-based interest rates | Reflect current market conditions (SOFR moves daily) |
| Set tenor by asset technology | Account for specific equipment warranties or degradation curves |
| Round to nearest $1M | Model construction financing, bridge loans, or tax equity |

**What about the CapEx-only approach?** An earlier version sized
principal purely from CapEx × leverage, without checking revenue. For
Gemini Solar Hybrid, this produced $621M — but the project's P50 CFADS
is only ~$33.8M/yr, making Year 1 DS ($70M) impossible to service. The
revenue constraint was added to prevent this.

## 8. Future Enhancement Ideas

The current dual-constraint approach handles most sites well. Possible
refinements:

- **Amortization-aware sizing**: Currently assumes level_principal for
  the back-solve formula. If the default amort type were level_payment,
  the formula would use the annuity factor instead.
- **P10 floor check**: After sizing on P50, verify that P10 DSCR in
  Year 1 is above some minimum (e.g., 1.00x) and reduce principal if
  not.
- **Market-aware rates**: Pull current SOFR + spread from an external
  source instead of hardcoded type-based rates.

---

## 9. Code Reference

| Component | File | Function |
|-----------|------|----------|
| Default loan computation | `lib/finance.ts` | `resolveDefaultLoan(asset, p50Cfads?)` |
| Sizing DSCR targets | `lib/finance.ts` | `SIZING_DSCR_BY_TYPE` constant |
| Leverage ratios | `lib/finance.ts` | `LEVERAGE_BY_TYPE` constant |
| Interest rates by type | `lib/finance.ts` | `RATE_BY_TYPE` constant |
| Tenor by type | `lib/finance.ts` | `TENOR_BY_TYPE` constant |
| CapEx per MW | `lib/finance.ts` | `CAPEX_PER_MW` constant (shared with LTV calc) |
| P50 CFADS computation | `app/page.tsx` | inside `loadSiteData()` — uses `computePercentiles` + `resolveOpex` |
| Tooltip derivation | `components/ConfigSidebar.tsx` | uses `resolveDefaultLoan()` for tooltip text |

**Related docs:**
- `docs/learning/project-finance-basics.md` — DSCR conventions and terminology
- `docs/learning/explain_model_granularity_and_payment_frequency.md` — Gen 1 simplifications
- `docs/learning/examples/dscr-calculations-by-view.md` — worked DSCR math across views
- `docs/cashflow_dscr_methodology.md` — full methodology reference
