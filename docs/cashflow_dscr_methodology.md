---
title: From 12-Month Forecast to Full Cash Flow and DSCR
type: methodological-note
domain: project-finance
created: 2026-02-27
status: draft-v2
relates-to:
  - foundations/accounting/accounting.md
  - foundations/accounting/debt_structures.md
  - risk/Project_Finance_Risk_Guide.md
  - risk/discussion_scaling_1yr_to_multiyear.md
  - risk/renewable_yield_assessment_reference.md
---

# From Monthly Generation/Revenue Forecast to Full Cash Flow and DSCR

> How to extend a 12‑month probabilistic generation/revenue forecast (P5, P10, P50, P90, etc.) into a full project cash flow, add a simple loan model, and compute DSCR covenant. Caveats and things to be careful about.

---

## 0. The Formula — Quick Reference

### DSCR

```
DSCR (Year t) = CFADS(t) ÷ Debt Service(t)
```

### Expanding each term

```
CFADS(t)        = Revenue(t) − OpEx(t)
                  (simplified; full: Revenue − OpEx − Taxes − Reserve top-ups)

Debt Service(t) = Principal(t) + Interest(t)

Interest(t)     = Interest Rate × Opening Principal Balance(t)

Principal(t)    = depends on amortization type:
                    Level Principal  → same $ each period (declining DS over time)
                    Level Payment    → same total DS each period (growing principal share)
                    Sculpted         → set so CFADS / DS = target DSCR each period
```

### What the number means

| DSCR | Interpretation |
|------|---------------|
| > 1.25x (typical covenant) | Comfortable — project has headroom above minimum |
| = 1.25x | At the covenant limit — any downside triggers a breach warning |
| 1.0x – 1.25x | Covenant breach — lender can enforce; project still cash-flow positive |
| < 1.0x | Hard default — project cannot pay its debt service from operations |

### In one line

> **DSCR tells you: for every $1 of debt service owed, how many dollars of operating cash flow does the project generate?**
> A DSCR of 1.30x means the project earns $1.30 for every $1.00 it owes — 30 cents of headroom.

---

## 1. What You Have vs What You Need

| You have | You need for full cash flow + DSCR |
|----------|-------------------------------------|
| Monthly generation (MWh) and revenue ($) for next 12 months | **CFADS** in each period (revenue − OpEx − reserves/taxes as applicable) |
| Distribution of scenarios (e.g. P5, P10, P50, P90) | Same distribution **extended** to loan life (e.g. 15–20 years) or at least to covenant test dates |
| 12 months | **Loan amortization schedule** (principal + interest by period) for same periodicity |

**[[_GLOSSARY#D|DSCR]]** = [[_GLOSSARY#C|CFADS]] ÷ Debt Service (tested per period). So you need **CFADS** and **Debt Service** in the same periodicity (e.g. quarterly or semi-annual, as in real deals).

---

## 2. Extending 12-Month Forecast to Full Cash Flow — Caveats

### 2.1 Periodicity and Covenant Test Frequency

- **Covenants are usually tested quarterly or semi-annually**, not monthly. So:
  - Either **aggregate** your monthly revenue/CFADS to quarterly (or semi-annual) for DSCR, or
  - Keep monthly for internal detail but **define DSCR on the same frequency as the loan** (e.g. quarterly DS and quarterly CFADS).
- **Caveat:** Don’t test DSCR monthly if the loan pays quarterly; debt service and covenant tests must align.

### 2.2 From Revenue to CFADS

**CFADS** = cash flow *available for debt service* — i.e. **before** paying debt:

```
CFADS = Revenue
        − Operating Expenses (O&M, insurance, land lease, property tax, grid, G&A)
        − Taxes (cash tax, if material)
        − Reserve funding that is paid BEFORE debt in the waterfall (e.g. DSRA top-up if drawn)
```

Simplified (no tax, no DSRA draw) for a first pass:

```
CFADS = Revenue − Operating Expenses
```

**What you need first:** For the full cash flow you need **revenue** (the main forecast) and **OpEx**. Revenue drives the upside and stress (generation × price; degradation; PPA terms). OpEx is often mostly constant in real terms, but **inflation** matters when you extend to multi-year — see below.

**Inflation — why it matters (caveat):** Inflation is something we should care about, especially when extending 12 months to 18 years. For **Gen1** you can keep it simple (e.g. flat nominal OpEx), but state it as a caveat and add escalation when you move to full-life or lender-ready models.
- **OpEx:** There is usually **no contract link** to inflation. O&M, insurance, land lease, etc. are typically modelled with an **explicit escalator** when you go multi-year (e.g. CPI or 2–3%/year), otherwise real costs are understated and CFADS is overstated in later years. So **inflation matters most directly for OpEx** in the model.
- **Revenue:** This is **contract-dependent**. Many PPAs have a **price escalator** (fixed % per year or CPI-linked), so revenue already tracks inflation over the contract life. If the PPA is **flat** (no escalator), real revenue declines over time. So for revenue, inflation is “in the contract” when an escalator exists; you don’t add a separate inflation assumption unless the PPA is flat or you’re modelling merchant/post-PPA.

**Caveats:**

- **OpEx is often not proportional to generation.** Fixed O&M (e.g. $/kW-year) + variable (e.g. $/MWh). Don’t assume revenue and OpEx move 1:1 when you stress generation.
- **Reserves:** If you model DSRA/MRA top-up before debt, subtract them from “available” cash to get a conservative CFADS. For a **simple** first model, many use **CFADS = Revenue − OpEx** and ignore reserve top-ups in the ratio.
- **Revenue lag:** If PPA settles with a 1–2 month lag, revenue in month *t* may reflect generation in *t−1*. Align timing when you go from generation → revenue.

### 2.3 Extending 12 Months to Multi-Year

You only have **12 months** of forecast. To get CFADS for the full loan life you need **revenue** (and then OpEx) for each period. Revenue is the main driver; OpEx is often modelled as largely constant with an inflation escalator (see §2.2). Then CFADS = Revenue − OpEx for each period. Multiple ways to extend:

- **Option A — Repeat 12-month profile:** Use the same 12-month seasonal pattern each year, scaled by:
  - **Degradation** (e.g. −0.5%/year for solar), and
  - **Escalator** on price (if PPA has one).
- **Option B — Long-term P50/P90 from IE:** Replace or blend with an Independent Engineer (IE) style long-term P50/P90 **annual** curve (e.g. 20 years), then:
  - Apply your 12-month **seasonality** (monthly factors) to each year’s annual number to get monthly generation/revenue, then aggregate to quarterly for DSCR.
- **Caveat:** **Don’t assume 12 months of data represents the full distribution for 20 years.** Year‑1 could be above P50; bad years (P90) matter for covenant stress. Use P50 for “base” and P90 (or P75) for **debt sizing / stress** (see [[#4. Simple Loan Calc — What You Need]]).

### 2.4 P5 / P10 / P50 / P90 — How to Use the Distribution

- **P50** = median (50% exceedance). Use for **base-case** cash flow and “typical” DSCR.
- **P90** = conservative (90% exceedance). Lenders often **size debt** so that DSCR stays above minimum even at **P90** (or P75) generation. So:
  - Run **DSCR on P90** (or P75) to check that the loan is bankable.
  - Run **DSCR on P50** to show “expected” headroom.
- **P5 / P10** = downside tail. Use for **stress testing** (how often could DSCR breach, or how low could it go).

### 2.5 1-Year P90 vs 10-Year P90 — Why It Matters for Debt Sizing and DSCR

This is important: **P90** can be defined over a **single year** or over a **rolling multi-year average**. The choice changes how conservative your debt sizing and DSCR stress tests are.

| Definition | What it means | Typical use |
|------------|----------------|-------------|
| **1-year P90** | In **any single** year, there is a 90% probability that actual production will be **at or above** this level. Only 10% of years are expected to be worse. | **Lender underwriting / debt sizing.** Single-year weather and resource variability are fully reflected, so 1-year P90 is **lower** (stricter). |
| **10-year P90** | Over a **10-year average**, there is a 90% probability that the **average** annual production over those 10 years will be at or above this level. Good and bad years average out. | **Long-term resource assessment.** Variability averages out over time, so 10-year P90 is **higher** (less strict) than 1-year P90. |

**Why they differ:** In any **single** year, production can be well below average (e.g. bad weather, low irradiance). So the distribution of **single-year** output is wide → 1-year P90 is low. Over **10 years**, those bad years are averaged with good years → the distribution of **10-year average** output is narrower → 10-year P90 is higher.

**Numerical example** (from [[risk/Project_Finance_Risk_Guide]] — 200 MW solar, annual generation in GWh):

| Exceedance | Annual generation (GWh) | Revenue at $45/MWh ($M) | vs P50 |
|------------|-------------------------|-------------------------|--------|
| P50        | 420                     | 18.9                    | —      |
| **P90 (1-yr)**  | **378**             | **17.0**                | **−10.0%** |
| **P90 (10-yr)** | **395**             | **17.8**                | **−5.9%**  |

So 1-year P90 is ~10% below P50; 10-year P90 is ~6% below P50. If you **size debt** using 10-year P90, you allow more debt (higher CFADS assumption) than if you size to 1-year P90. In a single bad year, DSCR would then be **tighter** — or could breach — if the loan was sized to 10-year P90.

**What to do in your model:**

1. **Know which P90 you have.** If your 12-month forecast gives you percentile curves (P5, P10, P50, P90), clarify with the source: is it **1-year** (single-year exceedance) or **multi-year average**? Many energy-yield reports and IE reports state this explicitly.
2. **For debt sizing and covenant stress:** Use **1-year P90** (or the stricter of the two) so that the project can still service debt in a single bad year. Sizing to 10-year P90 alone can understate risk in any given year.
3. **Don’t mix them.** If you compare your DSCR to someone else’s, check whether they used 1-year or 10-year P90 — otherwise you’re comparing different levels of conservatism.

**Summary:** 1-year P90 is stricter and is the standard for conservative debt sizing; 10-year P90 is higher and less conservative. Document which one you use when you extend your forecast to full cash flow and run DSCR.

---

## 3. Loan Basics — Principal, Interest, Maturity, Amortization

**Construction loan vs term loan:** In project finance there are two main debt instruments, used **one after the other**. The **[[_GLOSSARY#C|construction loan]]** funds building (drawn as costs are incurred, 12–36 months); at **[[_GLOSSARY#C|COD]]** it converts to the **[[_GLOSSARY#T|term loan]]** (amortizing, 15–22 years). The schedule and DSCR work in this note are for the **term loan** only. For the full comparison (purpose, drawdown, tenor, rate, IDC, conversion), see [[foundations/accounting/debt_structures#Construction Loan vs Term Loan]].

*(If you already know principal, interest, maturity, amortization, skip to [[#4. Simple Loan Calc — What You Need]].)*

When you borrow money, the loan is described by a few core ideas. These are the same in project finance as in a home loan or car loan; the difference is the *source* of repayment (project cash flow only) and the *terms* (long tenor, covenant tests).

| Term | Meaning | Example |
|------|--------|--------|
| **Principal** | The amount of money you borrowed (the debt balance). It goes **down** as you repay. | $50M at closing → $48M after first year’s principal payment |
| **Interest** | The cost of borrowing. You pay it each period as **interest = interest rate × (outstanding principal)**. | 6% per year on $50M → $3M interest in year 1 (if paid annually) |
| **Maturity** (or **tenor**) | How long the loan lasts until it must be fully repaid. | 18 years from COD → last payment in year 18 |
| **Amortization** | The **schedule** of how you pay back principal over time (how much principal in each period). “Amortizing” = you pay principal gradually, not all at the end. | Level principal: same $ of principal each period. Level payment: same total $ each period (principal share grows). |
| **Debt service** | The **total cash** you pay the lender in a period: **Interest + Principal**. This is what CFADS must cover for DSCR. | Quarter 1: $1.2M interest + $0.8M principal = $2.0M debt service |

**In one sentence:** You borrow **principal**; each period you pay **interest** (on the remaining balance) plus **principal** (to reduce the balance); **debt service** is that total payment; **maturity** is when the last payment is due; **amortization** is the rule that decides how much principal you pay in each period.

**Why amortization matters for your model:** The amortization schedule gives you **principal** and **interest** for every period. From that you get **debt service** = principal + interest. Then DSCR = CFADS ÷ debt service in that same period. So you need the loan schedule (principal + interest by period) to compute DSCR.

**Where this is in the repo:** Term loan features (tenor, rate, amortization types) are in [[foundations/accounting/debt_structures#Term Loan (Perm Debt)]]; no separate “loan 101” — this section is that primer.

### When Does the Loan Tenor Start and End?

For the **term loan** (the one you're building the schedule for), the tenure has a clear **start** and **end**. Don't mix this up with the construction phase.

| Point | When | What happens |
|-------|------|----------------|
| **Start of tenor** | **COD** ([[_GLOSSARY#C|Commercial Operation Date]]) | The construction loan converts to the term loan. The **term loan is drawn** (or the conversion happens). So "18 years from COD" means the **clock starts at COD**. |
| **First debt service** | Often **6 months after COD** (or first quarter/half-year per contract) | First **interest + principal** payment is due. Revenue (and CFADS) from COD onward must cover this. Your amortization schedule and DSCR tests should align with this **first payment date** — don't assume debt service starts in the same period as COD. |
| **End of tenor (maturity)** | **COD + tenor** (e.g. COD + 18 years) | **Last** principal + interest payment. After that, debt is fully repaid; no more debt service; CFADS goes to reserves and equity only. |

**For your model:** Define "Period 1" for the loan as the **first period in which debt service is paid** (e.g. first quarter or first semi-annual date after COD). Build CFADS over the same periods. Tenor length (e.g. 18 years) then means 18 years from **start of term loan** (at COD), with the last payment at maturity. So: **start = COD (term loan conversion), first payment = often 6 months after COD, end = COD + tenor.**

**Where this is in the repo:** Phase milestones (COD, conversion) in [[foundations/phases/phases#Sub-Milestones: Inside the Construction → COD Gate]].

---

## 4. Simple Loan Calc — What You Need

Inputs:

| Input | Typical / note |
|-------|------------------|
| **Loan amount** | $ (or % of capex) |
| **Maturity** | Years (e.g. 18 from COD) |
| **Amortization** | Profile: level principal, level payment (annuity), or sculpted |
| **Interest rate** | % per year (fixed or SOFR + spread); if floating, need rate per period |
| **Payment frequency** | Quarterly or semi-annual (match covenant frequency) |

**Amortization:**

- **Level principal:** Same principal each period; interest = rate × opening balance. Simple and transparent.
- **Level payment (annuity):** Same total payment each period; principal share grows over time. Standard for many term loans.
- **Sculpted:** Principal set so that **CFADS / DS = target DSCR** each period (lenders do this in practice). For a “simple” loan calc, start with **level principal** or **level payment**; add sculpting later if needed.

**Output:** For each period: **Interest**, **Principal**, **Debt Service** (= I + P), **Closing balance**.

---

### 4a. Amortization Deep Dive: Level Payment vs Sculpted

Understanding which structure is used — and why — is essential for correctly modeling DSCR and debt sizing. The three types produce meaningfully different DSCR profiles.

#### Three-way comparison

| | Level Principal | Level Payment (Annuity) | Sculpted |
|---|---|---|---|
| **How DS is set** | Same principal each period; interest declines | Same total payment each period | DS shaped to CFADS / target DSCR each period |
| **DSCR over time (flat CFADS)** | Improves — DS declines as balance amortizes | Flat — DS constant, CFADS constant | Constant by construction |
| **DSCR over time (declining CFADS)** | Improves slower; late years squeezed | Falls — same DS, less cash | Constant — DS tracks CFADS down |
| **Leverage implication** | Mid-range | Lower (must survive worst year) | Highest — maximizes safe debt |
| **Complexity** | Simple | Simple | Requires base CFADS forecast |
| **Typical use** | Simple/transparent deals, modelling default | Regulated assets, bonds, diversified portfolios | Modern utility-scale renewable project finance |

#### Key intuition

> **Level payment:** Debt structure is fixed; DSCR absorbs all the risk. In good years DSCR is high, in bad years it falls.
>
> **Sculpted:** DSCR is fixed at the target; debt structure absorbs the risk. DS is set each year to exactly match projected CFADS / target DSCR.

This is the deepest difference. It changes how you think about default probability, leverage, and risk timing.

#### Worked numerical example

Consider a solar project with degrading output (CFADS declines ~2% per year) and a 5-year, $30M loan at 6%.

**Case 1 — Level payment (constant DS = $7.12M/yr):**

| Year | CFADS ($M) | Debt Service ($M) | DSCR |
|------|-----------|-------------------|------|
| 1 | 10.00 | 7.12 | 1.40 |
| 2 | 9.80 | 7.12 | 1.38 |
| 3 | 9.60 | 7.12 | 1.35 |
| 4 | 9.40 | 7.12 | 1.32 |
| 5 | 9.20 | 7.12 | 1.29 |

DSCR falls because CFADS declines but DS stays flat. The binding year is Year 5. The lender must size debt so that even the worst year clears the covenant — this reduces leverage.

**Case 2 — Sculpted (target DSCR = 1.40x, DS = CFADS / 1.40):**

| Year | CFADS ($M) | Debt Service ($M) | DSCR |
|------|-----------|-------------------|------|
| 1 | 10.00 | 7.14 | 1.40 |
| 2 | 9.80 | 7.00 | 1.40 |
| 3 | 9.60 | 6.86 | 1.40 |
| 4 | 9.40 | 6.71 | 1.40 |
| 5 | 9.20 | 6.57 | 1.40 |

DS declines to match CFADS. DSCR is constant at the target. There is no weak late year. This allows more debt because no single year is structurally disadvantaged.

**Note for Gen 1 (flat CFADS):** When CFADS is constant every year (no degradation, no escalation), sculpted and level payment produce identical numbers: `DS = flat_CFADS / target_DSCR` is the same value each year. The distinction becomes meaningful in Gen 2 when degradation and price escalation make CFADS vary year-by-year.

#### Why sculpting dominates modern renewable project finance

Renewables have degradation, merchant exposure, and curtailment risk — CFADS is not flat over 18–20 years. Level payment structures create mismatches: DS is too high in late years when CFADS has declined. Sculpting removes this mismatch and allows:

1. **Higher leverage** — more debt for the same risk tolerance
2. **Even DSCR coverage** — no single year is structurally the weak point
3. **Better risk alignment** — debt service tracks the asset's actual cash generation capacity

Level payment remains common in: regulated infrastructure, portfolio financing, capital markets bonds, and simpler deals where modeling sophistication is limited.

#### Why this matters for InfraSure

Amortization structure changes default probability, optimal leverage, and insurance structuring. With level payment, tail risk concentrates in late years; with sculpting, risk is distributed evenly. A persistent bad-weather sequence hits level payment deals much harder in late years than sculpted deals. The InfraSure model supports all three structures to quantify these differences.

---

## 5. DSCR Covenant — What to Implement First

**Formula:**

```
DSCR(t) = CFADS(t) / Debt_Service(t)
```

**Periodicity:** If you calculate **quarterly**, DSCR is **quarterly** — one DSCR per quarter, using that quarter’s CFADS and that quarter’s debt service. Same for semi-annual: semi-annual CFADS and semi-annual debt service → one DSCR per semi-annual period. The test frequency in the loan agreement (e.g. “DSCR tested quarterly”) must match the period you use for both CFADS and debt service.

**How the industry does it (quarterly vs semi-annual vs annual):** It depends on **lender type** and **deal type**, not strictly on asset class. In practice:
- **Bank term loans (project finance):** **Semi-annual** is very common in the US and many markets — both debt service payments and DSCR covenant tests are every six months. Some bank deals are **quarterly**. Your repo’s [[foundations/accounting/debt_structures#Term Loan (Perm Debt)|term loan]] note says DSCR is typically tested **semi-annually or annually**.
- **Project bonds (rated, capital markets):** Covenant testing is often **annual** (and sometimes “incurrence” — tested only when the issuer takes a defined action). Debt service can still be semi-annual or annual.
- **Asset type:** Renewables (solar, wind) are usually **bank** term loans → often **semi-annual**; larger or bond-financed projects may be **annual**. So the majority of *bank*-financed project finance is **semi-annual**; bonds lean **annual**. For your model, use the **period in the actual (or target) loan agreement** — and if you don’t have one, **semi-annual** is a safe default for bank-style term debt.

**Covenant tested annually but debt service semi-annual — how and why:** **Mostly the two match** — in bank term loans, covenant test frequency is usually the **same** as debt service frequency (both semi-annual, or both quarterly). The case where they *differ* (annual test, semi-annual payments) is **less common** and shows up mainly in **project bonds** and some structured deals. So for gen1 / bank-style modelling, assume **same** period for both unless the document says otherwise. When they do differ, it typically looks like this: some deals (especially project bonds) say the **covenant is tested once per year** even though **debt is paid semi-annually**. You still have semi-annual cash flows (and can compute semi-annual DSCR for internal use), but the **contractual test** is annual. How to do it:
- **Option A — Annual DSCR for the test:** Roll up to **annual** numbers for the covenant. Use **annual CFADS** (sum of the two half-years) and **annual debt service** (sum of the two semi-annual payments). Then DSCR = annual CFADS ÷ annual debt service. You get **one DSCR per year**; that’s the number you compare to the minimum. Your model can still build semi-annual CFADS and semi-annual DS (for the waterfall and for reporting); for the covenant you just sum each to annual and do one test per year.
- **Option B — Worst semi-annual in the year:** The document might instead say “DSCR tested annually, being the minimum of the two semi-annual DSCRs in that year.” Then you **calculate** semi-annual DSCR (two per year) and the **test** is: take the lower of the two; if that’s below the minimum, you breach. So calculation is semi-annual, test *timing* is annual.
- **Why:** Annual covenant testing reduces admin and ties to **annual** financials and audits. Debt service can stay semi-annual to match cash flows (e.g. revenue and OpEx). So: **payments** = semi-annual (cash flows); **covenant test** = annual (one number per year, either from annual CFADS/DS or from worst semi-annual DSCR). Check the loan or bond document for which definition applies.

- **Minimum DSCR** (e.g. 1.25x): covenant breach if DSCR &lt; 1.25x → [[foundations/accounting/debt_structures#5.3 Lock-Up (Distribution Restriction)|lock-up]], then [[foundations/accounting/debt_structures#5.2 Cash Sweep|cash sweep]] or default if worse.
- Test **every period** (quarterly or semi-annual) over the loan life.

**Suggestions:**

1. **Start with DSCR only** (as you said). Add LLCR/PLCR later if needed.
2. **Same periodicity:** CFADS and Debt Service in the **same** period (quarterly with quarterly DS).
3. **Which CFADS:**  
   - For **covenant compliance** (does the project pass each test?): use your **scenario** CFADS (P50, P90, or path from your distribution).  
   - For **stress:** run DSCR on **P90** (and optionally P75) to ensure min DSCR is satisfied in bad years.
4. **Reserves in CFADS:** If [[_GLOSSARY#D|DSRA]] top-up is paid *before* debt in the [[foundations/accounting/debt_structures#6. Cash Flow Waterfall|waterfall]], one convention is to subtract it from CFADS so that “cash available for debt” is after refilling the reserve. For a simple first pass, **CFADS = Revenue − OpEx** is acceptable; document the assumption.

### 5.1 Worked example — semi-annual DSCR (bank-style)

Many bank term loans test **semi-annually**. Assume **semi-annual** debt service and **semi-annual** CFADS (e.g. you summed monthly revenue and OpEx over each half-year). Then you get **one DSCR per half-year**:

| Period | CFADS ($M) | Debt service ($M) | DSCR | Covenant (min 1.25x) |
|--------|------------|-------------------|------|----------------------|
| H1     | 6.7        | 4.0               | 1.68 | ✓ Pass               |
| H2     | 5.2        | 4.0               | 1.30 | ✓ Pass               |

- **CFADS** each period = that half-year’s (Revenue − OpEx). No debt service in the CFADS formula — CFADS is *before* paying debt.
- **Debt service** each period = that half-year’s (Interest + Principal) from your loan schedule.
- **DSCR** = CFADS ÷ Debt service for the **same** period. Here H2 DSCR = 5.2 ÷ 4.0 = 1.30x; if the covenant were min 1.25x, H2 passes. If H2 CFADS dropped to 4.8, DSCR would be 1.20x → breach.
- **Quarterly** works the same way: four periods per year, quarterly CFADS and quarterly debt service → one DSCR per quarter. Match the periodicity to your (or target) loan agreement.

### 5.2 Worked example — annual DSCR (Gen1 default)

For **Gen1**, using **annual** keeps things simple: **one DSCR per year**, **one covenant test per year**, no roll-up or roll-down — so DSCR and covenant frequency match and there’s no confusion. Assume **annual** debt service and **annual** CFADS (e.g. you summed monthly revenue and OpEx over the year, or used an annual revenue forecast and annual OpEx). Example over three years:

| Year | CFADS ($M) | Debt service ($M) | DSCR | Covenant (min 1.25x) |
|------|------------|-------------------|------|----------------------|
| 1    | 12.0       | 8.0               | 1.50 | ✓ Pass               |
| 2    | 11.5       | 7.8               | 1.47 | ✓ Pass               |
| 3    | 10.8       | 7.6               | 1.42 | ✓ Pass               |

- **CFADS** each year = that year’s (Revenue − OpEx). Revenue can include degradation and PPA escalator; OpEx can include inflation (e.g. 2%/yr). No debt service inside CFADS.
- **Debt service** each year = that year’s (Interest + Principal) from your **annual** loan schedule (two semi-annual payments summed, or an annual amortization if the deal is annual).
- **DSCR** = CFADS ÷ Debt service for the **same** year. Covenant is tested once per year against the same number. No need to aggregate or take minimums across sub-periods.
- **When to use annual for Gen1:** Simplest path: build annual revenue (and annual OpEx with inflation), annual debt service, annual DSCR. When you move to bank-style modelling or a deal that is semi-annual, switch to semi-annual (or keep both: annual for high-level, semi-annual for covenant accuracy).

### 5.3 Gen 1 Implementation — What We're Actually Building

Gen 1 is the **simplest thing that produces a meaningful DSCR profile across project life.** Here is exactly what it does.

**Inputs:**

| Input | Source | Example |
|-------|--------|---------|
| Annual revenue at 5 percentiles | Our 1-year engine output (P10, P25, P50, P75, P90) | P50 = $12.0M, P90 = $10.2M |
| Annual OpEx | User input — flat $/year | $4.0M/yr |
| Loan terms | User input — principal, rate, tenor, amortization type | $50M, 6%, 18yr, level payment |

**Computation:**

```
GEN 1 — CONSTANT-DISTRIBUTION MULTI-YEAR DSCR

  For each percentile case p ∈ {P10, P25, P50, P75, P90}:
    For each year t ∈ {1, 2, ..., loan_tenor}:

      Revenue(p, t) = Revenue(p, Year 1)       ← HELD CONSTANT (same every year)
      OpEx(t)       = OpEx_base                 ← HELD CONSTANT (no inflation)
      CFADS(p, t)   = Revenue(p, t) − OpEx(t)
      DSCR(p, t)    = CFADS(p, t) / DS(t)      ← DS from amortization schedule

  Output: 5 columns × N rows table
```

**What happens to DSCR over time:** Revenue is flat. OpEx is flat. So CFADS is flat. But debt service **declines** as principal amortizes → **DSCR improves monotonically.** Year 1 is always the tightest year. This is conservative for later years — lenders will see improving coverage.

```
GEN 1 DSCR SHAPE — WHY IT IMPROVES

  DSCR
  2.80 ┤                                          ○ P90 (upside)
       │                                     ○
  2.40 ┤                                ○
       │                           ○
  2.00 ┤                      ○             ◆ P50
       │                 ○  ◆
  1.60 ┤            ○  ◆
       │       ○  ◆
  1.25 ┤──○──◆──▪──────────────────────── covenant minimum
       │◆  ▪
  1.10 ┤▪ △                              △ P10 (downside)
       │△
  1.00 ┤
       └──┬──┬──┬──┬──┬──┬──┬──┬──┬──▶
          1  3  5  7  9 11 13 15 17 18
                       Year

  CFADS is FLAT → DSCR improves purely from debt amortization.
  Year 1 is ALWAYS the binding constraint.
  Key question: does P25 (or P10) clear 1.25x in Year 1?
```

**What Gen 1 tells you (and what it doesn't):**

| Gen 1 Tells You | Gen 1 Does NOT Tell You |
|-----------------|------------------------|
| Whether the project can service debt under each weather scenario | Probability of covenant breach in any given year |
| Which percentile is the binding constraint in Year 1 | Whether consecutive bad years could cause breach |
| How much DSCR headroom improves with amortization | How degradation + cost inflation erode late-year CFADS |
| Whether the loan is roughly bankable at this sizing | Exact DSCR under realistic PPA escalation / merchant curves |

---

### 5.3a Quarterly CFADS and LTM DSCR — Full Worked Example

Gen 1 tests DSCR annually (§5.3), but the dashboard also shows a **quarterly view** with **LTM (Last Twelve Months) DSCR**. This section explains why quarterly matters, walks through every step of the calculation with consistent numbers, proves why a common shortcut is statistically wrong, and maps the result to what the dashboard displays.

#### Running example parameters

All numbers below use this single project:

| Parameter | Value |
|-----------|-------|
| Asset | 100 MW DC solar, West Texas |
| PPA price | $45/MWh (flat, no escalator) |
| Capacity factor | ~25% (annual average) |
| Annual generation P50 | ~219,000 MWh |
| Annual revenue P50 | **$9.86M** |
| Annual OpEx | **$2.00M** ($20/kW-yr, flat) |
| Annual CFADS P50 | $9.86M − $2.00M = **$7.86M** |
| Loan | $60M principal, 6.0% fixed, 18-year tenor, level payment |
| Annual debt service (Y1) | **$5.50M** (constant in level payment) |
| DSCR covenant minimum | **1.25x** |

Revenue percentiles (annual, from 1,000 Monte Carlo paths):

| Percentile | Annual Revenue | Annual CFADS | Annual DSCR (Y1) |
|------------|---------------|-------------|-------------------|
| P10 | $8.38M | $6.38M | 1.16x |
| P25 | $9.12M | $7.12M | 1.29x |
| P50 | $9.86M | $7.86M | 1.43x |
| P75 | $10.61M | $8.61M | 1.57x |
| P90 | $11.34M | $9.34M | 1.70x |

At P10, DSCR = 1.16x — below the 1.25x covenant. At P25, DSCR = 1.29x — just above. This is a realistic tight-but-bankable deal.

---

#### Why quarterly matters — seasonality

Solar revenue concentrates in summer. The annual view shows one flat $9.86M bar. The quarterly view reveals *when* cash is abundant and when it is scarce — crucial for understanding whether the project can meet scheduled payments, fund reserves in the right quarter, and avoid short-term liquidity stress.

---

#### Step 1: Monthly simulation paths → quarterly revenue percentiles

**1a. Raw monthly paths.** We have ~1,000 Monte Carlo paths, each with 12 monthly revenues. Here are 3 illustrative paths for context (all values in $K):

| Month | Path 42 | Path 317 | Path 891 | Seasonal pattern |
|-------|---------|----------|----------|-----------------|
| Jan | $490 | $455 | $520 | Low (winter) |
| Feb | $520 | $485 | $550 | Low |
| Mar | $710 | $665 | $750 | Rising |
| Apr | $950 | $890 | $1,000 | Rising |
| May | $1,120 | $1,050 | $1,180 | High |
| Jun | $1,200 | $1,125 | $1,265 | Peak |
| Jul | $1,250 | $1,170 | $1,315 | Peak |
| Aug | $1,180 | $1,105 | $1,240 | High |
| Sep | $860 | $805 | $905 | Declining |
| Oct | $680 | $635 | $715 | Declining |
| Nov | $490 | $460 | $520 | Low |
| Dec | $410 | $385 | $435 | Low (winter) |
| **Annual** | **$9,860** | **$9,230** | **$10,395** | |

Note: Path 317 is a lower-resource year (below P50); Path 891 is above P50. The seasonal shape is similar across all paths — summer is always the peak — but the absolute level varies.

**1b. Aggregate to quarters within each path.** For each of the 1,000 paths, sum the 3 months in each quarter:

| Quarter | Months | Path 42 | Path 317 | Path 891 |
|---------|--------|---------|----------|----------|
| Q1 | Jan + Feb + Mar | $1,720K | $1,605K | $1,820K |
| Q2 | Apr + May + Jun | $3,270K | $3,065K | $3,445K |
| Q3 | Jul + Aug + Sep | $3,290K | $3,080K | $3,460K |
| Q4 | Oct + Nov + Dec | $1,580K | $1,480K | $1,670K |
| **Annual** | | **$9,860K** | **$9,230K** | **$10,395K** |

**1c. Compute percentiles per quarter across all 1,000 paths.** Sort the 1,000 Q1 values, find the 10th percentile, 25th, etc. Repeat for Q2, Q3, Q4:

| Quarter | P10 | P25 | P50 | P75 | P90 |
|---------|-----|-----|-----|-----|-----|
| Q1 | $1,460K | $1,590K | $1,720K | $1,855K | $1,980K |
| Q2 | $2,780K | $3,020K | $3,270K | $3,525K | $3,770K |
| Q3 | $2,795K | $3,040K | $3,290K | $3,545K | $3,790K |
| Q4 | $1,345K | $1,460K | $1,580K | $1,705K | $1,820K |
| **Sum of quarterly P-values** | **$8,380K** | **$9,110K** | **$9,860K** | **$10,630K** | **$11,360K** |

Notice: the sum of quarterly P50s ($9,860K) matches the annual P50 ($9.86M). This is expected because P50 (median) of symmetric distributions is approximately additive. But as we will show in Step 6, this does **not** hold for tail percentiles (P10, P90).

**Implementation:** `computeQuarterlyPercentiles()` in `lib/stats.ts` does steps 1b and 1c.

---

#### Step 2: Quarterly CFADS (all 5 percentiles)

CFADS = Revenue − OpEx. Annual OpEx is split evenly:

```
Quarterly OpEx  = $2.00M / 4 = $500K
Quarterly CFADS = Quarterly Revenue − $500K
```

Full quarterly CFADS table:

| Quarter | Rev P10 | Rev P50 | Rev P90 | OpEx | CFADS P10 | CFADS P25 | CFADS P50 | CFADS P75 | CFADS P90 |
|---------|---------|---------|---------|------|-----------|-----------|-----------|-----------|-----------|
| Q1 | $1,460K | $1,720K | $1,980K | $500K | **$960K** | **$1,090K** | **$1,220K** | **$1,355K** | **$1,480K** |
| Q2 | $2,780K | $3,270K | $3,770K | $500K | **$2,280K** | **$2,520K** | **$2,770K** | **$3,025K** | **$3,270K** |
| Q3 | $2,795K | $3,290K | $3,790K | $500K | **$2,295K** | **$2,540K** | **$2,790K** | **$3,045K** | **$3,290K** |
| Q4 | $1,345K | $1,580K | $1,820K | $500K | **$845K** | **$960K** | **$1,080K** | **$1,205K** | **$1,320K** |

**What the hero chart plots:** 72 points (4 quarters × 18 years). For each quarter, the P50 line shows the median CFADS, with the P10–P90 shaded band showing the uncertainty range. The seasonal curve — Q3 peak, Q1/Q4 trough — is immediately visible.

**Key visual insight:** Even at P10 (worst case), Q2 and Q3 CFADS ($2.28M, $2.30M) are well above quarterly debt service ($1.375M). But Q1 and Q4 at P10 ($0.96M, $0.85M) are below quarterly DS. This is the **seasonality risk** — within-year cash timing doesn't match debt timing.

---

#### Step 3: Why naive quarterly DSCR is misleading

Annual DS = $5.50M, so quarterly DS = $5.50M / 4 = **$1,375K**. If you naively compute DSCR per quarter:

| Quarter | CFADS P10 | CFADS P50 | CFADS P90 | DS (qtr) | DSCR P10 | DSCR P50 | DSCR P90 |
|---------|-----------|-----------|-----------|----------|----------|----------|----------|
| Q1 | $960K | $1,220K | $1,480K | $1,375K | **0.70x** | **0.89x** | **1.08x** |
| Q2 | $2,280K | $2,770K | $3,270K | $1,375K | **1.66x** | **2.01x** | **2.38x** |
| Q3 | $2,295K | $2,790K | $3,290K | $1,375K | **1.67x** | **2.03x** | **2.39x** |
| Q4 | $845K | $1,080K | $1,320K | $1,375K | **0.61x** | **0.79x** | **0.96x** |

**The problem is stark:**
- Q1 at P50: DSCR = 0.89x → would trigger covenant breach even though the project is healthy
- Q4 at P90: DSCR = 0.96x → even the *best weather scenario* shows breach in winter
- Q2 at P10: DSCR = 1.66x → the *worst weather scenario* in summer looks excellent

This is entirely an artifact of **seasonal revenue timing vs. evenly-spaced debt payments**. The project earns enough over the full year — it just doesn't earn evenly. Using quarterly DSCR directly would make every solar project in the northern hemisphere look unbankable in Q4, which is absurd.

---

#### Step 4: LTM DSCR — the industry-standard fix

**LTM = Last Twelve Months.** Real-world project finance tests covenants on a **trailing 12-month** basis, not per quarter. The bank cares whether the project covered its annual debt obligation over any rolling 12-month window — not whether January's cash covered January's payment.

**Formula:**

```
LTM DSCR (tested at quarter Q of year Y)
  = (sum of CFADS over trailing 4 quarters) / (sum of DS over trailing 4 quarters)
  = Annual CFADS / Annual DS
```

**Worked example at P50 — tested at each quarter of Year 1:**

```
Tested at Q1-Y1:
  Trailing 4Q CFADS  = Q2-Y0 + Q3-Y0 + Q4-Y0 + Q1-Y1
                     = (no prior year in Gen 1 → use Q1+Q2+Q3+Q4 of current year)
                     = $1,220K + $2,770K + $2,790K + $1,080K = $7,860K
  Trailing 4Q DS     = $1,375K × 4 = $5,500K
  LTM DSCR           = $7,860K / $5,500K = 1.43x  ✓

Tested at Q2-Y1:
  Same trailing 4Q (Gen 1: same year) → 1.43x  ✓

Tested at Q3-Y1:
  Same → 1.43x  ✓

Tested at Q4-Y1:
  Same → 1.43x  ✓
```

**All 4 quarters show the same 1.43x** because in Gen 1, the trailing 12 months always lands on the same annual period. Compare this to the naive quarterly approach: Q1 showed 0.89x (breach) and Q4 showed 0.79x (breach). LTM correctly shows 1.43x (comfortable pass) for all quarters.

**Full LTM DSCR by percentile — Year 1:**

| Percentile | Annual CFADS | Annual DS | LTM DSCR | Covenant (1.25x) |
|------------|-------------|-----------|----------|------------------|
| P10 | $6,380K | $5,500K | **1.16x** | BREACH |
| P25 | $7,120K | $5,500K | **1.29x** | Pass |
| P50 | $7,860K | $5,500K | **1.43x** | Pass |
| P75 | $8,610K | $5,500K | **1.57x** | Pass |
| P90 | $9,340K | $5,500K | **1.70x** | Pass |

P10 breaches (1.16x < 1.25x), P25 through P90 pass. This matches the annual DSCR from §5.3 — as it should, because LTM over a full year equals the annual figure.

---

#### Step 4a: Cold-start behavior — Gen 1 vs Gen 2

**The question:** When computing LTM DSCR at Q1 of Year 1, there are no prior quarters. What does the trailing 12-month window use?

**Gen 1 answer: no cold-start problem.**

Because of Assumption A1 (revenue constant across all years), Year 0 and Year 1 have identical seasonal patterns. The trailing 4-quarter window from Q1-Y1:

```
LTM window at Q1-Y1 = Q2-Y0 + Q3-Y0 + Q4-Y0 + Q1-Y1
                     = (Year 0 = Year 1 by A1)
                     = same total as Q1-Y1 + Q2-Y1 + Q3-Y1 + Q4-Y1
                     = full Year 1 annual CFADS
```

All 4 quarters within any year Y therefore share the same LTM DSCR:

```
LTM DSCR[Y, any quarter] = annualCFADS[p] / annualDS[Y]
```

**Implementation** (`lib/finance.ts → computeQuarterlyData`): The code short-circuits the rolling window entirely — it computes `annualCfadsPcts[k] / row.debtService` once per year and assigns it to all 4 quarters of that year. No prior-year data is needed, no bootstrap assumption is required. This is correct under A1 and intentional: the implementation comment reads *"In Gen 1 LTM = annual for every quarter within the same year"*.

**Gen 2 bootstrap problem (future):**

When degradation + PPA escalation make Y1 ≠ Y2, the trailing window for Q1-Y1 genuinely spans a year that hasn't been modeled (Y0, pre-COD). Two options:

| Option | Approach | When to use |
|--------|----------|-------------|
| **Bootstrap Y0 = Y1** | Treat Year 0 seasonal pattern as identical to Year 1 | Conservative default; applies to first year of operation only |
| **Deferred LTM start** | Report LTM DSCR from Q4-Y1 onward (first full 4-quarter window available) | Cleaner but delays the first covenant test point by 9 months |

Gen 2 `computeQuarterlyData` will also need to sum across year boundaries for mid-year LTM windows:

```
Q1-Y2 LTM = Q2-Y1_cfads + Q3-Y1_cfads + Q4-Y1_cfads + Q1-Y2_cfads
```

Since Y1 and Y2 will have different CFADS levels (degradation, escalation), each of the 4 quarters within a year will produce a *different* LTM DSCR — unlike Gen 1 where all 4 are identical.

**Summary:** Gen 1 has no cold-start issue — it is a consequence of A1, not a deliberate design decision. When A1 is relaxed in Gen 2, explicitly document which bootstrap option is used for Q1-Y1.

---

#### Step 5: Why LTM DSCR varies across years

Revenue and OpEx are constant in Gen 1 (assumption A1), so annual CFADS is the same every year. But **debt service declines** as principal amortizes (level payment: interest portion shrinks as balance decreases). LTM DSCR improves purely from this mechanical effect:

**Full multi-year LTM DSCR table (all 5 percentiles):**

| Year | Annual DS | LTM DSCR P10 | P25 | P50 | P75 | P90 | P10 Status |
|------|-----------|-------------|-----|-----|-----|-----|-----------|
| Y1 | $5.50M | **1.16x** | 1.29x | 1.43x | 1.57x | 1.70x | BREACH |
| Y2 | $5.38M | **1.19x** | 1.32x | 1.46x | 1.60x | 1.74x | BREACH |
| Y3 | $5.25M | **1.22x** | 1.36x | 1.50x | 1.64x | 1.78x | BREACH |
| Y4 | $5.12M | **1.25x** | 1.39x | 1.53x | 1.68x | 1.82x | PASS (exactly at threshold) |
| Y5 | $4.98M | **1.28x** | 1.43x | 1.58x | 1.73x | 1.88x | Pass |
| Y6 | $4.83M | **1.32x** | 1.47x | 1.63x | 1.78x | 1.93x | Pass |
| Y8 | $4.52M | **1.41x** | 1.58x | 1.74x | 1.90x | 2.07x | Pass |
| Y10 | $4.17M | **1.53x** | 1.71x | 1.89x | 2.07x | 2.24x | Pass |
| Y12 | $3.78M | **1.69x** | 1.88x | 2.08x | 2.28x | 2.47x | Pass |
| Y15 | $3.15M | **2.03x** | 2.26x | 2.49x | 2.73x | 2.96x | Pass |
| Y18 | $2.38M | **2.68x** | 2.99x | 3.30x | 3.62x | 3.93x | Pass |

**Reading this table:**
- **Horizontally (across percentiles):** The spread P10→P90 in any given year shows weather uncertainty. In Y1, the range is 1.16x–1.70x — a 0.54x spread. This spread is constant (in ratio terms) because CFADS percentiles are constant and only the denominator changes.
- **Vertically (across years):** Every percentile improves over time because DS declines. P10 crosses the 1.25x covenant threshold between Y3 and Y4. After Y4, the project passes even at P10.
- **The binding constraint** is Y1 at P10 (1.16x). This is always the case in Gen 1 — CFADS flat, DS declining.

**What the hero chart heatmap shows:** Each year has 4 quarterly columns (all identical in Gen 1). Each column has 5 vertical bands colored by the LTM DSCR at that percentile:
- Bottom band (P10): red in Y1–Y3 (breach), amber in Y4, green from Y5+
- Middle band (P50): green from Y1 onward (1.43x passes comfortably)
- Top band (P90): deep green throughout (1.70x+ is very safe)

The visual effect: early years show a vertical gradient (red at bottom, green at top — high uncertainty, P10 at risk). Later years are uniformly green (even P10 is safe). This two-dimensional gradient — horizontal (time) and vertical (percentile risk) — is the core insight of the hero chart.

---

#### Step 6: The percentile addition trap — with proof

**Critical statistical note:** You cannot compute LTM CFADS by summing quarterly percentile values.

**The wrong formula:**
```
LTM CFADS at P10 ≟ P10(Q1) + P10(Q2) + P10(Q3) + P10(Q4)
                  = $960K + $2,280K + $2,295K + $845K
                  = $6,380K
```

**In this example, the sum happens to match** the annual P10 ($6,380K) because our running example has near-perfect correlation across quarters (all paths scale up/down together). This is a coincidence of the example, not a general rule.

**Why it fails in general — a concrete counterexample:**

Consider 5 simulation paths with quarterly CFADS (simplified):

| Path | Q1 | Q2 | Q3 | Q4 | Annual |
|------|-----|-----|-----|-----|--------|
| A | $800 | $2,500 | $2,600 | $700 | **$6,600** |
| B | $1,100 | $2,000 | $2,800 | $900 | **$6,800** |
| C | $1,000 | $2,400 | $2,200 | $1,100 | **$6,700** |
| D | $900 | $2,700 | $2,100 | $1,000 | **$6,700** |
| E | $1,200 | $2,100 | $2,500 | $800 | **$6,600** |

**Per-quarter P10 (lowest value in each column):**

| | Q1 | Q2 | Q3 | Q4 | Sum |
|--|-----|-----|-----|-----|------|
| P10 | $800 (Path A) | $2,000 (Path B) | $2,100 (Path D) | $700 (Path A) | **$5,600** |

**Annual P10 (lowest annual total):**

Sorted annual: $6,600 (A), $6,600 (E), $6,700 (C), $6,700 (D), $6,800 (B) → P10 = **$6,600**

**The discrepancy:** Sum of quarterly P10s = $5,600 vs. actual annual P10 = $6,600. That's a **$1,000 difference** (15% lower). The sum method combines the worst Q1 (Path A), worst Q2 (Path B), worst Q3 (Path D), and worst Q4 (Path A) — but these come from **different paths**. No single path actually experienced $5,600. The sum method creates an imaginary worst-case that is unrealistically pessimistic.

**Why this happens:** The path with the worst Q1 (Path A: low winter) compensates with decent Q2/Q3. The path with the worst Q2 (Path B: low spring) compensates with the best Q3. Seasonal variability washes out at the annual level. Summing per-quarter worst cases ignores this natural diversification and overstates risk.

**The larger the seasonal variation and the lower the inter-quarter correlation, the bigger this gap.** For solar (extreme seasonality), it can be 10–20%. For wind (more evenly distributed), it's smaller but still meaningful.

**The correct formula (what our implementation uses):**

```
1. For each path:  annual_CFADS = sum(Q1 + Q2 + Q3 + Q4)
2. Across all paths: P10(annual_CFADS) = 10th percentile of the annual totals
3. LTM DSCR(P10, Year t) = P10(annual_CFADS) / annual_DS(t)
```

The quarterly chart shows per-quarter CFADS for seasonal insight; the LTM DSCR uses the proper annual percentiles for the covenant test. Two different computations serving two different purposes.

**Implementation:** `computeQuarterlyData()` in `lib/finance.ts` takes `annualCfadsPcts` (correctly computed annual percentiles from `computeFinancials`) and uses them directly for LTM DSCR — never summing quarterly percentiles.

---

#### Step 7: What the dashboard shows — mapping computation to UI

| Dashboard element | Computation | Section |
|-------------------|-------------|---------|
| Hero chart — CFADS P50 line (blue) | 72 points: `quarterlyRevPcts[q].P50 − quarterlyOpex` for each quarter | Step 2 |
| Hero chart — CFADS P10–P90 band (shaded) | Same as above for P10, P25, P75, P90 | Step 2 |
| Hero chart — Debt Service line (gold) | `annualDS / 4` repeated per quarter, stepping down each year | Step 3 |
| Hero chart — Background heatmap (vertical gradient) | 5 bands per column, each colored by `riskColor(ltmDscr[Pxx])` | Step 5 |
| Hero chart — Hover tooltip | Per-percentile LTM DSCR with ✓/✗ vs covenant | Step 4 |
| Ledger table — Min DSCR column | P10 of annual DSCR = `annualCfadsPcts.P10 / annualDS` | Step 5 |
| Ledger table — Expanded DSCR row | All 5 percentiles of annual DSCR | Step 5 |
| KPI card — Min DSCR | Minimum of `annualCfadsPcts.P10 / annualDS` across all years (always Y1 in Gen 1) | Step 5 |

---

#### Gen 1 vs Gen 2 behavior

| Aspect | Gen 1 (current) | Gen 2 (future) |
|--------|-----------------|----------------|
| Quarterly revenue pattern | Same 4-quarter shape every year (seasonal pattern from 12-month forecast repeated) | Varies by year — degradation reduces summer peaks, PPA escalator increases revenue, OpEx inflation increases quarterly deductions |
| LTM DSCR within a year | Same for all 4 quarters (trailing 12m = full year of constant revenue) | Can differ — Q3-Y5 trailing window spans Q4-Y4 through Q3-Y5, mixing two years with different generation levels |
| What drives year-to-year LTM variation | Only debt service amortization (CFADS flat, DS declining) | DS amortization + degradation + escalation + OpEx inflation — CFADS itself changes year to year |
| Seasonal insight | Shows the fixed seasonal shape (Q3 peak, Q1/Q4 trough) — useful for understanding cash timing risk | Shows how seasonality evolves (e.g., degradation flattening summer peaks over 18 years) |
| Percentile addition trap | Not a practical issue because quarterly percentiles are only used for the chart display, not for LTM calculation | Becomes more complex: true rolling LTM requires summing across year boundaries with different annual CFADS levels |
| Heatmap gradient | All 4 quarters per year are identical (same year → same LTM DSCR) — year-level coloring | Per-quarter variation visible — Q4-Y5 and Q1-Y6 may show different colors because their trailing windows include different proportions of Y5 vs Y6 revenue |

**Gen 2 readiness:** The framework is built to handle Gen 2 seamlessly. `computeQuarterlyPercentiles()` will receive per-year monthly data (with degradation and escalation baked in). `computeQuarterlyData()` will compute true trailing 12-month sums that cross year boundaries, producing 72 potentially unique LTM DSCR values instead of 18 repeated ones.

---

### 5.4 Gen 1 Assumptions — Explicit List

These assumptions are **large and deliberate.** They must be documented clearly because the shift from Gen 1 to Gen 2 is primarily about relaxing them.

| # | Assumption | What It Means | Direction of Error | Severity |
|---|-----------|--------------|-------------------|----------|
| **A1** | **Revenue held constant across project life** | Year 1 P10–P90 distribution repeats every year unchanged | Ignores both positive (PPA escalation) and negative (degradation) trends | ⭐⭐⭐⭐⭐ |
| **A2** | **No generation degradation** | Solar panels / turbines produce same MWh in Year 18 as Year 1 | 📈 Overestimates late-year generation (solar ~0.5%/yr, wind ~0.1–0.3%/yr) | ⭐⭐⭐⭐ |
| **A3** | **No price escalation** | $/MWh stays flat; PPA escalators not modeled | 📉 Underestimates late-year revenue for CPI-linked PPAs (~2%/yr typical) | ⭐⭐⭐⭐ |
| **A4** | **Flat OpEx (no inflation, no component structure, no uncertainty)** | O&M, insurance, land lease costs don't increase; single deterministic value | 📈 Overestimates late-year CFADS (OpEx typically escalates 2–3%/yr); single value hides tail risk from shocks (insurance jump, major maintenance event) | ⭐⭐⭐ |
| **A5** | **Years are independent** | Each year's percentile is a fixed case, not a draw; no consecutive-year dynamics | Cannot show breach probability, only "which case breaches" | ⭐⭐⭐ |
| **A6** | **Stationarity** | Weather and price distributions don't change over 18 years | Ignores climate trends and market structural shifts | ⭐⭐⭐ |
| **A7** | **No reserve mechanics** | No DSRA drawdown/top-up, simplified waterfall (CFADS = Rev − OpEx) | 📈 Overestimates available cash (reserves reduce it) | ⭐⭐ |
| **A8** | **~~Annual covenant testing~~** *(partially relaxed)* | Dashboard now shows quarterly CFADS with LTM DSCR (see §5.3a). Covenant test still uses annual percentiles for statistical accuracy; quarterly view provides seasonal insight. Full relaxation in Gen 2 with true rolling LTM across year boundaries. | ⭐ (was ⭐⭐) |

**Net effect of A2 + A3 + A4 on late-year DSCR accuracy:**

| Factor | Direction | Typical Annual Magnitude | Cumulative by Year 18 |
|--------|-----------|------------------------|----------------------|
| No degradation (A2) | 📈 Overestimates CFADS | +0.5%/yr (solar) | +~9% |
| No price escalation (A3) | 📉 Underestimates CFADS | −2.0%/yr (typical PPA) | −~30% |
| No OpEx inflation (A4) | 📈 Overestimates CFADS | +2.5%/yr (typical O&M) | +~40% |

- **If PPA has escalator:** A3 dominates → Gen 1 is **conservative** (understates late-year DSCR). Lender-friendly.
- **If PPA is flat:** A2 + A4 dominate → Gen 1 is **aggressive** (overstates late-year DSCR). Must caveat.
- **For merchant:** Price evolution dominates everything. Gen 1 is only meaningful for the first few years.

> **Bottom line:** Gen 1 is most accurate for Year 1 DSCR (where all these cancel out) and becomes less accurate as you extend further. This is acceptable because Year 1 is the binding constraint in Gen 1 anyway.

---

### 5.5 Gen 1 → Gen 2 Shift — What Changes and Why

| # | Gen 1 (Now) | Gen 2 (Next) | Impact on DSCR | Effort |
|---|------------|-------------|----------------|--------|
| 1 | Revenue constant every year | + **Degradation** applied (user input: %/yr) | 📉 Late-year DSCR decreases | Low |
| 2 | Revenue constant every year | + **PPA price escalation** (user input: %/yr or CPI) | 📈 Late-year DSCR increases | Low |
| 3a | Flat OpEx, zero escalation | + **OpEx inflation** (user input: %/yr, default 2.5%) | 📉 Late-year CFADS decreases; DSCR improves less than Gen 1 suggests | Low — `OPEX_ESCALATION_RATE` param already in notebook config |
| 3b | Single deterministic OpEx | + **Component-structured OpEx** (O&M, insurance, land, property tax, maintenance reserve) | Each component has its own escalator and uncertainty range; `docs/extra/discussions/project_finance_opex.md` has the benchmarks | Medium |
| 3c | No OpEx uncertainty | + **Probabilistic OpEx** (shock events: insurance jump, major maintenance, BESS augmentation) | Tail DSCR distribution; worst-case DSCR from bad OpEx year visible in covenant matrix | High |
| 3d | No correlation modeling | + **OpEx–revenue correlation** (hail → insurance spike AND generation loss simultaneously) | True tail DSCR captures co-movement; critical for insurance structuring and InfraSure risk transfer | Very high |
| 4 | 5 fixed percentile cases | **Monte Carlo** (1,000+ paths drawing from distribution each year) | Enables **breach probability** per year, not just "which case breaches" | Medium |
| 5 | i.i.d. implicit | **Regime-aware sampling** (HMM) | 📉 Increases consecutive bad year probability | High |
| 6 | No reserves | **DSRA/MRA** in waterfall | 📉 Reduces CFADS; but provides buffer | Medium |
| 7 | Annual DSCR | **Quarterly or semi-annual** DSCR matching real covenant test frequency | More realistic — catches seasonal weakness | Low | ✅ *Partially done:* quarterly CFADS + LTM DSCR implemented in Gen 1 dashboard (§5.3a). Gen 2 adds true rolling LTM across year boundaries. |

**The single biggest shift** is #4: going from "5 deterministic percentile lines" to "1,000+ simulated paths." This unlocks the output lenders actually want — not "P90 DSCR is 1.25x in Year 3" but "**there's a 4.2% chance of breaching 1.25x in any given year**."

**Priority order for Gen 2 improvements:**

```
EFFORT vs VALUE FOR GEN 2 IMPROVEMENTS

  High value │  ④ Monte Carlo       ① Degradation
             │                      ② PPA escalation
             │  ⑤ Regime (HMM)      ③ OpEx inflation
             │
  Med value  │  ⑥ Reserves          ⑦ Quarterly DSCR
             │
             └──────────────────────────────────────▶
              Low effort                    High effort

  Start from bottom-left: ①②③ are trivial adds.
  ④ is the game-changer. ⑤⑥ are structural upgrades.
```

For the full multi-year extension roadmap (Stages 1–4) including regime modeling, climate adjustment, stress testing, and EVT tail risk, see the companion document: *Discussion — Scaling 1-Year Forecast to Multi-Year Project Life* (discussion_scaling_1yr_to_multiyear.md, Section 6).

---

## 6. Things to Be Careful About (Checklist)

| Area | Risk | Suggestion |
|------|------|------------|
| **Timing** | Monthly rev vs payment period | Use same periodicity for DSCR (e.g. semi-annual CFADS + semi-annual DS for bank default; or quarterly if the deal is quarterly). |
| **OpEx** | Treating OpEx as % of revenue | Use fixed + variable; in stress, revenue can drop but OpEx doesn’t proportionally. |
| **Single year** | 12 months ≠ long-term distribution | Extend with degradation + escalator; use P90 (and P75) for stress, not only P50. |
| **Definition of CFADS** | Inconsistent vs loan agreement | Stick to one: e.g. Revenue − OpEx (− taxes, − reserve top-up if before debt). Document it. |
| **Debt sizing** | Loan amount too high for P90 | Size debt so min DSCR (e.g. 1.25x) holds at P90 (or P75) in the tightest period. |
| **First period** | COD timing vs first payment | First debt service date often 6 months after COD; align first CFADS period with first DS date. |
| **Currency / real vs nominal** | Mixing real revenue with nominal rate | Keep revenue and interest rate in same (nominal) terms unless you explicitly model real. |
| **Inflation** | OpEx flat over 18 years overstates CFADS | Escalate OpEx (e.g. CPI or 2–3%/yr) when extending to multi-year. Revenue is PPA-dependent (escalator or flat); Gen1 can stay simple but note the caveat. |

---

## 7. Dashboard UI — Reading the Charts and KPIs

> This section maps every element of the Gen 1 dashboard to the formulas above.
> Open the dashboard alongside this guide as a companion reference.

---

### 7.1 KPI Cards (top strip)

Four cards give the headline answer in under 5 seconds.

#### Min DSCR
```
Value:  lowest DSCR across all percentiles × all years
Sub:    which percentile and year it occurs in (e.g. "P10, Year 1")
Detail: headroom above or below the covenant minimum
```
**How to read it:** This is the single binding number. If Min DSCR > covenant (e.g. 1.25x), the project services debt in every scenario. If it is below, at least one percentile/year pair breaches. A headroom of +0.10x is tight; +0.50x is comfortable.

**Gen 1 note:** Because CFADS is flat and debt service declines, Min DSCR will always be in Year 1 at the lowest percentile (P10). If you change amortization to level payment, Year 1 and later years have the same debt service, so the minimum is still Year 1 P10.

---

#### Binding Case
```
Value:  DSCR in the single worst (percentile, year) cell
Sub:    same location as Min DSCR
Detail: "Clears 1.25x covenant" or "BREACH"
```
**How to read it:** The binding case is the minimum DSCR restated as a pass/fail against the covenant. It answers the lender's core question: *does the project service debt even in its worst scenario?* If this card is red, the loan is not bankable as structured.

---

#### Debt / CFADS
```
Value:  Principal ÷ Year 1 P50 CFADS  (leverage ratio, in "x")
Sub:    "Year 1 P50 (leverage)"
Detail: Year 1 annual debt service ($M)
```
**How to read it:** This is a rough leverage metric — how many years of median operating cash flow does it take to repay the full principal? A ratio of 6x means the loan equals 6 years of P50 CFADS. Lenders typically accept 5–8x for well-contracted solar; higher ratios imply more leverage. It is **not** the same as DSCR — DSCR uses annual debt service (principal + interest for that year), whereas Debt/CFADS uses total principal vs one year of cash flow.

---

#### Covenant Status
```
Value:  "ALL PASS ✓" or "[N] BREACHES"
Sub:    total cells tested (years × 5 percentiles) or covenant threshold
Detail: count of cells below the minimum DSCR
```
**How to read it:** This scans the entire DSCR table — every year, every percentile — and counts violations. "ALL PASS" across 18 years × 5 percentiles (90 cells) is the full coverage confirmation. A breach count of 5 typically means one year's P10 and P25 both fail — not a catastrophic result but worth understanding which year and why.

---

### 7.2 Zone B — DSCR Lifetime Profile

**What it shows:** DSCR = CFADS(p) ÷ DS(t) for each percentile p and each loan year t. Every line (or the band) is a different weather scenario; the dashed horizontal line is the covenant minimum.

**Lines view:** Five lines — P10 (worst weather) at the bottom, P90 (best weather) at the top. The gap between them is the uncertainty range from weather variability. All lines should stay above the covenant min for the loan to be bankable.

**Band view:** The shaded area spans P10 to P90; P50 is the bold centre line. Cleaner for presentations — shows the probability range at a glance without five separate traces.

**Why lines slope upward in Gen 1:** Debt service declines each year (amortization reduces the balance → lower interest) while CFADS stays flat. So DSCR = CFADS / DS mechanically improves. In Gen 2, degradation will compress CFADS and flatten or invert this slope.

**What to look for:**
- Year 1 is almost always the tightest. If P10 Year 1 clears 1.25x, the deal is structurally sound under Gen 1 assumptions.
- The widening band (or spread between P10 and P90 lines) reflects that weather uncertainty applies equally each year, but the absolute DSCR level rises — so even P10 becomes comfortable by Year 10+.
- If the covenant min line crosses any percentile line → breach in that scenario.

---

### 7.3 Zone C — Revenue Distribution

**What it shows:** The distribution of annual revenue across all simulated paths (histogram bars = path frequency; KDE curve = smoothed distribution). Vertical dashed lines mark P10, P25, P50, P75, P90. The leftmost dashed line is the OpEx level.

**How to read it:**
- Width of the distribution = revenue uncertainty from weather variability.
- P10 is the left tail — only 10% of scenarios produce less. It is the stress case for debt sizing.
- P50 is the median — equally likely to be above or below.
- OpEx line shows the break-even revenue below which the project cannot cover operating costs (CFADS goes negative). If P10 is far to the right of the OpEx line, operational risk is low.
- The shape is approximately normal (bell curve) for a diversified generation portfolio; it may skew slightly depending on weather tail risk.

**What to look for:** How much revenue headroom is there between P10 and OpEx? A P10/OpEx ratio of 1.5x or higher means even the worst weather year comfortably covers costs.

---

### 7.4 Zone D — Annual CFADS vs Debt Service

**What it shows:** For the selected percentile (P50 by default), the revenue, CFADS, and OpEx bars alongside the declining debt service line, year by year.

**Standard view:**
- Tall blue bars = Revenue
- Shorter blue bars = CFADS (Revenue − OpEx). The gap between Revenue and CFADS is OpEx.
- Gray bars = OpEx (constant in Gen 1)
- Gold line = Debt Service (principal + interest). Marker dots are green when CFADS > DS, red when CFADS < DS.

**Risk Map view:** Only CFADS bars are shown, colour-coded by DSCR for that year:
- **Green** → DSCR ≥ covenant + 0.30x (comfortable headroom)
- **Amber** → DSCR between covenant and covenant + 0.30x (approaching limit)
- **Red** → DSCR < covenant (breach)
- Tooltip shows exact DSCR and status.

**How to read it:** The gap between the CFADS bar top and the debt service line **in each year** is the absolute cash cushion ($M). Years where this gap is small are the years to stress-test. In Gen 1, the gap widens every year because DS declines while CFADS is flat.

---

### 7.5 Zone E — Monthly Forecast Distribution

**What it shows:** The within-year seasonal revenue pattern. One box per month (Jan–Dec) showing the distribution across all simulated paths. P10/P50/P90 percentile lines overlay the boxes. A mean line (amber, diamond markers) shows the average revenue per month.

**How to read it:**
- Box height per month = within-month spread from weather variability.
- The seasonal curve (high in summer for solar, higher in spring/autumn for wind) is immediately visible.
- P10 line shows the worst-month pattern across all paths — useful for checking whether any single month's revenue is at risk of falling below OpEx.
- Mean vs P50: if the mean is above P50, the distribution is right-skewed (a few very good months pull the average up); if below, it is left-skewed.

**Gen 1 note:** This chart uses the actual 12-month forecast from GCS. It is the only Gen 1 chart that uses real monthly data. The other charts repeat this single year's annual total across the full loan life.

---

### 7.6 Right Sidebar — Covenant Scorecard

**What it shows:** The full DSCR matrix — every year × every percentile as a colour-coded table. Green = passes covenant; red = breach; the exact DSCR value is in each cell.

**How to read it:** Scan the first row (Year 1) — this is the tightest year. If any Year 1 cell is red, the deal breaches in that weather scenario. Move right across years — all cells should turn progressively greener as debt amortizes.

The P-value reference table below the matrix shows the actual dollar revenue at each percentile, giving context for what P10 or P90 means in absolute terms for this specific asset.

---

## 8. Minimal Build Order — Gen 1

**What you need to ship Gen 1:**

| Step | What | Input | Output | Notes |
|------|------|-------|--------|-------|
| 1 | **Get annual revenue at 5 percentiles** | Engine 1-year output | P10, P25, P50, P75, P90 annual revenue ($) | Already have this from engine |
| 2 | **Set flat OpEx** | User input ($/kW-yr or $/yr) | Annual OpEx ($) — same every year | Typical: $15–25/kW-yr solar, $25–50/kW-yr wind |
| 3 | **Compute annual CFADS** | Revenue(p) − OpEx for each percentile | 5 CFADS values — same every year | CFADS is constant because both inputs are constant |
| 4 | **Build loan amortization schedule** | Principal, rate, tenor, amort type | Annual DS(t) for t = 1..tenor | Level payment or level principal |
| 5 | **Compute DSCR table** | CFADS(p) / DS(t) for each p, each t | 5 × N table (see §5.3) | Year 1 is the binding row |
| 6 | **Flag covenant breach** | DSCR < 1.25x (or user-defined threshold) | Pass/fail per cell | Focus on Year 1 P10 and P25 |

**That's it.** Six steps, no Monte Carlo, no degradation, no escalation. The output is a clean DSCR table that shows whether the project services debt under each weather scenario, with improving coverage over time from amortization.

**What you defer to Gen 2:** Degradation, price escalation, OpEx inflation, Monte Carlo paths, breach probability, reserve mechanics, sub-annual DSCR. See §5.5 for the full shift table.

---

## 9. References in This Repo

- **Construction loan vs term loan, conversion, IDC:** [[foundations/accounting/debt_structures#Construction Loan vs Term Loan]].
- **CFADS / DSCR definition:** [[foundations/accounting/accounting#NOI → CFADS → CAFD]], [[risk/Project_Finance_Risk_Guide#5. DSCR and Coverage Ratio Mechanics]].
- **Covenant thresholds, cash sweep, lock-up:** [[foundations/accounting/debt_structures#5. Covenants]] (§5.1 DSCR, §5.2 Cash Sweep, §5.3 Lock-Up, §5.4 Distribution Tests).
- **Waterfall (order of cash):** [[risk/Project_Finance_Risk_Guide#4. Cash Flow Waterfall]], [[foundations/accounting/debt_structures#6. Cash Flow Waterfall]].
- **Debt sizing (sculpting, P90):** [[risk/Project_Finance_Risk_Guide#5.4 Debt Sizing: How Lenders Determine How Much to Lend]]; [[foundations/accounting/debt_structures#Term Loan (Perm Debt)]].
- **P50/P90 meaning:** [[_GLOSSARY]] (P50, P90); [[risk/Project_Finance_Risk_Guide#7.3 Resource Risk (Solar Irradiance / Wind Speed Variability)]] (P90 debt sizing).

---

**Companion documents (same folder):**
- **Multi-year extension methodology:** discussion_scaling_1yr_to_multiyear.md — full staged roadmap (Extension Stages 1–4), stress testing framework (Section 4), regime modeling, climate adjustment, EVT tail risk.
- **Industry reference:** renewable_yield_assessment_reference.md — IE methodologies (DNV, UL, Vaisala), rating agency DSCR thresholds (Fitch, S&P, Moody's), IEC/MEASNET standards, serial correlation evidence, published uncertainty budgets.
