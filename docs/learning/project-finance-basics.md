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

| Type | Definition | When used | Dashboard context |
|------|-----------|-----------|-------------------|
| **Annual DSCR** | Full-year CFADS ÷ full-year DS | Term sheet covenants, annual reviews | Lifecycle view — one value per year |
| **LTM DSCR** | Trailing 12-month CFADS ÷ trailing 12-month DS | Operational monitoring, semi-annual testing | 3-Year view — computed quarterly but uses 12-month lookback |
| **Quarterly DSCR** | Single-quarter CFADS ÷ single-quarter DS | Short-term monitoring, cash trap tests | Forward 12M view — per-quarter snapshot |

**Common mistake:** Mixing these without labelling. An analyst seeing "DSCR: 1.25x" will assume
Annual DSCR unless told otherwise. If you're showing quarterly DSCR, label it explicitly:
"Quarterly DSCR" or "Q2 2026 DSCR."

### Covenant thresholds

Typical term sheet language:

| Level | Typical threshold | Consequence |
|-------|-------------------|-------------|
| **Lock-up** | 1.10x – 1.20x | Cash distributions to equity holders are blocked; cash is trapped in reserve account |
| **Default** | 1.00x – 1.05x | Event of default; lender can accelerate the loan |

Our dashboard uses a single `minDscr` threshold (typically 1.25x) for covenant testing. In practice,
lenders define two thresholds. A future enhancement could distinguish lock-up from default.

---

## 2. Calendar Quarters — The Only Standard

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

## 3. Concrete Dates — Why They're Non-Negotiable

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

## 4. LTV (Loan-to-Value) — What It Tells You

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

## 5. Debt / CFADS Ratio — Leverage at a Glance

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

## 6. Common Pitfalls in Financial Dashboards

### 6.1 Floating quarters

**Mistake:** Grouping months into "quarters" based on forecast position instead of calendar.
If forecast starts March: Q1 = Mar–May.

**Why it's wrong:** No financial professional defines Q1 as Mar–May. This makes the dashboard
look unprofessional and creates confusion when cross-referencing with other reports.

**Fix:** Always use calendar quarters. Accept partial quarters at the edges.

### 6.2 Abstract year labels

**Mistake:** Labelling the x-axis "Y1, Y2, Y3" instead of "'26, '27, '28."

**Why it's wrong:** The viewer can't determine what calendar period "Y3 Q2" refers to without
counting from an unstated start date. This forces mental arithmetic and introduces errors.

**Fix:** Show real calendar years. The forecast start year is available from the data.

### 6.3 Mixing DSCR types without labelling

**Mistake:** Showing quarterly DSCR in one view and annual DSCR in another, both labelled "DSCR."

**Why it's wrong:** Quarterly DSCR is more volatile than annual DSCR (seasonal effects aren't
smoothed out). An analyst may compare Q3 DSCR (low solar output quarter) against the annual
DSCR threshold and conclude there's a covenant breach when there isn't one on an annual basis.

**Fix:** Always specify the DSCR type in the label or tooltip. "Quarterly DSCR: 1.15x" vs
"Annual DSCR: 1.35x" vs "LTM DSCR: 1.28x."

### 6.4 Ignoring seasonality in quarterly views

**Mistake:** Using the same revenue for all quarters in a year.

**Why it matters:** Solar generation is 2–3x higher in summer than winter. Wind has different
seasonal patterns. Quarterly DSCR will naturally be lower in low-generation quarters — this is
expected, not a problem. But if the dashboard averages away seasonality, it hides real cash
flow timing risks.

**Our approach:** We use monthly revenue percentiles that capture seasonal variation, then
aggregate to quarters. This preserves the seasonal signal.

### 6.5 Not showing uncertainty

**Mistake:** Showing only the P50 (median) projection.

**Why it's wrong:** P50 means there's a 50% chance of underperforming this number. Lenders
care about downside scenarios — P90 (only 10% chance of doing worse) is typically the
covenant test case.

**Our approach:** We show P10–P90 bands and P25–P75 bands around the P50 line, giving
a visual sense of revenue uncertainty. The DSCR heatmap uses the P50 DSCR for coloring,
but the tooltip shows the full percentile range.

### 6.6 Comparing partial and full quarters

**Mistake:** Showing a 1-month "quarter" DSCR next to a 3-month quarter DSCR at the same
visual scale, without indicating the difference.

**Why it matters:** A single month's DSCR can be much more extreme than a full quarter's
(less smoothing). The visual comparison is misleading.

**Fix:** Clearly indicate partial quarters in the UI (narrower block, tooltip note).
Don't annualize — just show what you have and let the analyst interpret.

---

## 7. How Our Dashboard Maps to These Conventions

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

## 8. Glossary

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
