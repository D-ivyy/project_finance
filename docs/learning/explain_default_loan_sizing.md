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

## 3. The Three Heuristics

### A. Principal — "How much debt can this project support?"

```
Principal = Capacity (MW) x CapEx per MW x Leverage Ratio
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
| Solar | 75% | Most predictable generation profile. Lenders comfortable with higher leverage because solar resource uncertainty is lower than wind. Typical range: 70-80%. |
| Wind | 70% | Higher resource variability (wind speed uncertainty, wake effects). Lenders require more equity cushion. Typical range: 65-75%. |
| Battery | 60% | Newer technology, merchant revenue risk (arbitrage/ancillary services less predictable than PPA-backed solar/wind). Typical range: 50-65%. |

**The formula produces the estimated asset value and then applies
leverage:**

```
Asset Value = Capacity x CapEx/MW
Debt        = Asset Value x Leverage
Equity      = Asset Value - Debt
```

### Worked Example — Gemini Solar Hybrid (690 MW Solar, NV)

```
Asset Value  = 690 MW x $1,200,000/MW  = $828,000,000
Debt (75%)   = $828,000,000 x 0.75     = $621,000,000
Equity (25%) = $828,000,000 x 0.25     = $207,000,000

                     ┌──────────────────────────┐
                     │    $828M Asset Value      │
                     │                           │
                     │  ┌───────────────────┐    │
                     │  │  $621M Debt (75%) │    │
                     │  │  (our principal)  │    │
                     │  └───────────────────┘    │
                     │  ┌───────────┐            │
                     │  │$207M Eq.  │            │
                     │  │  (25%)    │            │
                     │  └───────────┘            │
                     └──────────────────────────┘

Default principal → $621,000,000 (rounded to nearest $1M)
```

### Worked Example — Small Wind Farm (50 MW Wind, PA)

```
Asset Value  = 50 MW x $1,500,000/MW   = $75,000,000
Debt (70%)   = $75,000,000 x 0.70      = $52,500,000
Equity (30%) = $75,000,000 x 0.30      = $22,500,000

Default principal → $52,000,000 (rounded to nearest $1M)
```

### Worked Example — Battery Storage (200 MW Battery, TX)

```
Asset Value  = 200 MW x $1,800,000/MW  = $360,000,000
Debt (60%)   = $360,000,000 x 0.60     = $216,000,000
Equity (40%) = $360,000,000 x 0.40     = $144,000,000

Default principal → $216,000,000
```

### Why rounding?

Real term sheets don't say "$621,000,000." They say "$620M" or "$625M."
The code rounds to the nearest $1M to look realistic:

```typescript
Math.round((capacity * capex * leverage) / 1_000_000) * 1_000_000
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
| **Principal** | capacity x CapEx x leverage | `resolveDefaultLoan()` | No (was $50M fixed) |
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

Loan:
  Principal:     $621,000,000   (690 x $1.2M x 75%)
  Rate:          5.75%          (solar default)
  Tenor:         18 years       (solar default)
  Amortization:  level principal

Operating:
  OpEx:          $15,870,000/yr (690 MW x $23,000/MW-yr — NREL ATB 2024)

Covenant:
  Min DSCR:      1.25x          (solar default — Norton Rose Fulbright 2024)

Derived:
  Asset Value:   $828,000,000   (690 MW x $1.2M/MW)
  LTV:           75.0%          ($621M / $828M)

Year 1 Debt Service (level principal):
  Principal:     $621M / 18     = $34,500,000
  Interest:      $621M x 5.75%  = $35,707,500
  Total DS:                     = $70,207,500

If P50 CFADS ≈ $X (depends on revenue data):
  DSCR (P50, Y1) = P50 CFADS / $70.2M
```

---

## 7. Limitations and What This Is NOT

This heuristic is a **starting point for exploration**, not a credit
analysis or term sheet.

| What we do | What we don't do |
|------------|-----------------|
| Size debt from capacity and asset type | Account for PPA vs merchant revenue structure |
| Use industry-average leverage ratios | Adjust for sponsor credit quality or track record |
| Apply type-based interest rates | Reflect current market conditions (SOFR moves daily) |
| Set tenor by asset technology | Account for specific equipment warranties or degradation curves |
| Round to nearest $1M | Model construction financing, bridge loans, or tax equity |

**For a real deal**, the principal would be sized from a target DSCR
applied to projected CFADS (a "sculpted" or "DSCR-constrained" approach),
not from CapEx × leverage. Our heuristic approximates the outcome of
that process without needing the revenue data first — which is the
chicken-and-egg problem: you need a loan to compute DSCR, but you need
DSCR to size the loan.

---

## 8. Future Enhancement: Revenue-Based Sizing

A more sophisticated approach (possible future work):

```
1. Load revenue data for the site
2. Compute P50 CFADS (annual revenue P50 - OpEx)
3. Set target DSCR (e.g., 1.40x at P50)
4. Max annual DS = P50 CFADS / 1.40
5. Back-solve for principal:
     Principal = PV(rate, tenor, max_annual_DS)
```

This is how real lenders size debt. It produces a loan that the project
can actually service at the target coverage ratio. The challenge is that
it requires revenue data to be loaded first, creating a dependency on the
API call completing before we can show any loan parameters.

---

## 9. Code Reference

| Component | File | Function |
|-----------|------|----------|
| Default loan computation | `lib/finance.ts` | `resolveDefaultLoan(asset)` |
| Leverage ratios | `lib/finance.ts` | `LEVERAGE_BY_TYPE` constant |
| Interest rates by type | `lib/finance.ts` | `RATE_BY_TYPE` constant |
| Tenor by type | `lib/finance.ts` | `TENOR_BY_TYPE` constant |
| CapEx per MW | `lib/finance.ts` | `CAPEX_PER_MW` constant (shared with LTV calc) |
| Called on site change | `app/page.tsx` | inside `loadSiteData()` callback |
| Tooltip derivation | `components/ConfigSidebar.tsx` | uses `resolveDefaultLoan()` for tooltip text |

**Related docs:**
- `docs/learning/project-finance-basics.md` — DSCR conventions and terminology
- `docs/learning/explain_model_granularity_and_payment_frequency.md` — Gen 1 simplifications
- `docs/learning/examples/dscr-calculations-by-view.md` — worked DSCR math across views
- `docs/cashflow_dscr_methodology.md` — full methodology reference
