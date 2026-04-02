import type {
  LoanConfig,
  LoanScheduleRow,
  DscrRow,
  ComputedFinancials,
  PercentileMap,
  PercentileKey,
  AssetMeta,
  QuarterlyPoint,
  MonthlyViewPoint,
  ForwardQuarterBlock,
} from "@/types";
import { computePercentiles } from "@/lib/stats";

// ── OpEx defaults (NREL ATB 2024) ────────────────────────────────────────────

const OPEX_PER_MW: Record<string, number> = {
  solar: 23_000,   // $23k/MW-yr
  wind: 45_000,    // $45k/MW-yr
  battery: 40_000, // $/MW-yr
};

// ── CapEx defaults (NREL ATB 2024 moderate) ──────────────────────────────────

const CAPEX_PER_MW: Record<string, number> = {
  solar:   1_200_000, // $1.2M/MW — utility-scale PV
  wind:    1_500_000, // $1.5M/MW — onshore wind
  battery: 1_800_000, // $1.8M/MW — 4hr Li-ion BESS
};

const MIN_DSCR_BY_TYPE: Record<string, number> = {
  solar: 1.25,
  wind: 1.35,
  battery: 2.0,
};

// ── Loan defaults by asset type ─────────────────────────────────────────────

const LEVERAGE_BY_TYPE: Record<string, number> = {
  solar: 0.75,   // predictable CF, strong bankability
  wind: 0.70,    // higher variability
  battery: 0.60, // newer tech, higher merchant risk
};

const RATE_BY_TYPE: Record<string, number> = {
  solar: 0.0575,  // most predictable generation
  wind: 0.0625,   // higher resource variability
  battery: 0.07,  // technology/merchant risk premium
};

const TENOR_BY_TYPE: Record<string, number> = {
  solar: 18,   // industry standard (Norton Rose 2024)
  wind: 15,    // mechanical wear, shorter useful life
  battery: 12, // degradation limits economic life
};

export function resolveDefaultLoan(asset: AssetMeta): LoanConfig {
  const type = asset.asset_type;
  const capex = CAPEX_PER_MW[type] ?? 1_200_000;
  const leverage = LEVERAGE_BY_TYPE[type] ?? 0.75;
  const capacity = asset.ac_capacity_mw ?? 100;

  // Round to nearest $1M
  const principal =
    Math.round((capacity * capex * leverage) / 1_000_000) * 1_000_000;

  return {
    principal,
    annualRate: RATE_BY_TYPE[type] ?? 0.06,
    tenorYears: TENOR_BY_TYPE[type] ?? 18,
    amortType: "level_principal",
    targetDscrSculpt: 1.40,
    sculptPercentile: "P50",
  };
}

export function resolveOpex(
  asset: AssetMeta,
  override: number | null
): { value: number; source: string } {
  if (override !== null && override > 0) {
    return { value: override, source: "manual override" };
  }
  if (asset.ac_capacity_mw && asset.asset_type in OPEX_PER_MW) {
    const val = asset.ac_capacity_mw * OPEX_PER_MW[asset.asset_type];
    const rate = OPEX_PER_MW[asset.asset_type];
    return {
      value: val,
      source: `${asset.ac_capacity_mw.toFixed(1)} MW × $${(rate / 1000).toFixed(0)}k/MW-yr — NREL ATB 2024`,
    };
  }
  return { value: 4_000_000, source: "fallback default" };
}

export function resolveMinDscr(
  asset: AssetMeta,
  override: number | null
): { value: number; source: string } {
  if (override !== null && override > 0) {
    return { value: override, source: "manual override" };
  }
  const val = MIN_DSCR_BY_TYPE[asset.asset_type] ?? 1.25;
  return {
    value: val,
    source: `${asset.asset_type} default — Norton Rose Fulbright 2024`,
  };
}

// ── LTV (Loan-to-Value) ──────────────────────────────────────────────────────

export function resolveAssetValue(
  asset: AssetMeta,
  principal: number
): { ltv: number | null; assetValue: number | null; source: string } {
  if (!asset.ac_capacity_mw || !(asset.asset_type in CAPEX_PER_MW)) {
    return { ltv: null, assetValue: null, source: "capacity/type unknown" };
  }
  const assetValue = asset.ac_capacity_mw * CAPEX_PER_MW[asset.asset_type];
  const ltv = principal / assetValue;
  const rate = CAPEX_PER_MW[asset.asset_type] / 1e6;
  return {
    ltv,
    assetValue,
    source: `${asset.ac_capacity_mw.toFixed(0)}MW × $${rate.toFixed(1)}M/MW — NREL ATB 2024`,
  };
}

// ── Amortization schedule ─────────────────────────────────────────────────────

export function buildAmortization(
  config: LoanConfig,
  cfadsSeriesOrScalar?: number | number[]
): LoanScheduleRow[] {
  const { principal, annualRate, tenorYears, amortType, targetDscrSculpt } = config;
  const rows: LoanScheduleRow[] = [];
  let balance = principal;

  if (amortType === "level_payment") {
    const r = annualRate;
    const n = tenorYears;
    const annualPayment = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    for (let t = 1; t <= tenorYears; t++) {
      const interest = balance * annualRate;
      const principalPmt = annualPayment - interest;
      const closing = Math.max(balance - principalPmt, 0);
      rows.push({
        year: t,
        openingBalance: balance,
        interest,
        principal: principalPmt,
        debtService: annualPayment,
        closingBalance: closing,
      });
      balance = closing;
    }
  } else if (amortType === "level_principal") {
    const principalPmt = principal / tenorYears;
    for (let t = 1; t <= tenorYears; t++) {
      const interest = balance * annualRate;
      const debtService = principalPmt + interest;
      const closing = Math.max(balance - principalPmt, 0);
      rows.push({
        year: t,
        openingBalance: balance,
        interest,
        principal: principalPmt,
        debtService,
        closingBalance: closing,
      });
      balance = closing;
    }
  } else if (amortType === "sculpted") {
    // DS(t) = CFADS(t) / target_DSCR
    let cfadsArr: number[];
    if (typeof cfadsSeriesOrScalar === "number") {
      cfadsArr = Array(tenorYears).fill(cfadsSeriesOrScalar);
    } else if (Array.isArray(cfadsSeriesOrScalar)) {
      cfadsArr = cfadsSeriesOrScalar;
    } else {
      cfadsArr = Array(tenorYears).fill(0);
    }

    for (let t = 0; t < tenorYears; t++) {
      const interest = balance * annualRate;
      const ds = cfadsArr[t] / targetDscrSculpt;
      const principalPmt = ds - interest;
      const closing = Math.max(balance - principalPmt, 0);
      rows.push({
        year: t + 1,
        openingBalance: balance,
        interest,
        principal: principalPmt,
        debtService: ds,
        closingBalance: closing,
      });
      balance = closing;
    }
  }

  return rows;
}

// ── DSCR table ────────────────────────────────────────────────────────────────

export function computeDscrTable(
  loanSchedule: LoanScheduleRow[],
  pctCfads: PercentileMap
): DscrRow[] {
  const keys: PercentileKey[] = ["P10", "P25", "P50", "P75", "P90"];
  return loanSchedule.map((row) => {
    const cfads: PercentileMap = {} as PercentileMap;
    const dscr: PercentileMap = {} as PercentileMap;
    for (const k of keys) {
      cfads[k] = pctCfads[k];
      dscr[k] = row.debtService > 0 ? pctCfads[k] / row.debtService : 0;
    }
    return { year: row.year, debtService: row.debtService, cfads, dscr };
  });
}

// ── Quarterly CFADS + LTM DSCR ────────────────────────────────────────────────

/**
 * Build the 72-point quarterly time series (tenorYears × 4 quarters).
 *
 * quarterlyRevPcts: 4-element array of PercentileMaps (Q1-Q4) from monthly data.
 * In Gen 1 the seasonal pattern repeats every year (revenue constant assumption A1).
 * LTM DSCR = annual CFADS / annual DS (always equals annual DSCR in Gen 1, but
 * framework is Gen 2-ready: when quarterly revenue varies per year, LTM will differ
 * between Q1 and Q3 test dates).
 */
export function computeQuarterlyData(
  quarterlyRevPcts: PercentileMap[],   // length 4: Q1..Q4 quarterly revenue percentiles
  annualOpex: number,
  annualCfadsPcts: PercentileMap,      // correct annual CFADS percentiles (from computeFinancials)
  loanSchedule: LoanScheduleRow[],
  minDscr: number,
  startYear: number = 2026             // calendar year of Year 1
): QuarterlyPoint[] {
  const keys: PercentileKey[] = ["P10", "P25", "P50", "P75", "P90"];
  const quarterlyOpex = annualOpex / 4;
  const points: QuarterlyPoint[] = [];

  for (const row of loanSchedule) {
    const quarterlyDS = row.debtService / 4;
    const calYear = startYear + row.year - 1; // Year 1 → startYear, Year 2 → startYear+1, ...

    // LTM DSCR uses the correctly-computed annual CFADS percentiles.
    // Sum-of-quarterly-percentiles != percentile-of-annual-sum, so we must
    // use the annual figure directly. In Gen 1 LTM = annual for every quarter
    // within the same year; varies year-to-year as DS changes with amortization.
    const ltmDscr: PercentileMap = {} as PercentileMap;
    for (const k of keys) {
      ltmDscr[k] = row.debtService > 0 ? annualCfadsPcts[k] / row.debtService : 0;
    }

    for (let q = 0; q < 4; q++) {
      const qRevPcts = quarterlyRevPcts[q];
      const qCfads: PercentileMap = {} as PercentileMap;
      for (const k of keys) {
        qCfads[k] = qRevPcts[k] - quarterlyOpex;
      }

      const yr2 = String(calYear).slice(-2); // e.g. "26"
      points.push({
        year: row.year,
        quarter: q + 1,
        calYear,
        label: `Q${q + 1} '${yr2}`,
        revenue: qRevPcts,
        cfads: qCfads,
        debtService: quarterlyDS,
        ltmDscr,
      });
    }
  }

  return points;
}

// ── Full computation ──────────────────────────────────────────────────────────

// Month name lookup
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Build the 12-point forward-looking monthly view.
 *
 * monthlyRevPcts: 12-element array (index 0 = January ... index 11 = December)
 * annualOpex:     annual operating expense ($)
 * annualDS:       annual debt service for Year 1 ($)
 * minDscr:        covenant minimum
 * startMonth:     1-12, calendar month when the forecast window begins (e.g. 2 = Feb)
 * startYear:      4-digit calendar year (e.g. 2026)
 *
 * The x-axis starts at startMonth and wraps around the year.
 * Example: startMonth=2 → x-axis = [Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan]
 *
 * Quarter blocks use STANDARD CALENDAR QUARTERS (Q1=Jan-Mar, Q2=Apr-Jun, etc.).
 * Partial quarters at the edges of the 12-month window are shown with their actual
 * month count and proportional width.
 *
 * Example: startMonth=3 (March), startYear=2026:
 *   Block 0: Q1'26 (Mar only, 1 month, partial)
 *   Block 1: Q2'26 (Apr-Jun, 3 months, full)
 *   Block 2: Q3'26 (Jul-Sep, 3 months, full)
 *   Block 3: Q4'26 (Oct-Dec, 3 months, full)
 *   Block 4: Q1'27 (Jan-Feb, 2 months, partial)
 */
export function computeMonthlyViewData(
  monthlyRevPcts: PercentileMap[],  // length 12, index 0 = Jan
  annualOpex: number,
  annualDS: number,
  minDscr: number,
  startMonth: number,               // 1-12
  startYear: number = 2026          // 4-digit calendar year
): { monthlyPoints: MonthlyViewPoint[]; quarterBlocks: ForwardQuarterBlock[] } {
  const keys: PercentileKey[] = ["P10", "P25", "P50", "P75", "P90"];
  const monthlyOpex = annualOpex / 12;
  const monthlyDS = annualDS / 12;

  // Build 12-point series starting from startMonth, wrapping around year
  const monthlyPoints: MonthlyViewPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const calMonth = ((startMonth - 1 + i) % 12) + 1;  // 1-12
    const revPcts = monthlyRevPcts[calMonth - 1];       // index 0 = Jan
    const cfads: PercentileMap = {} as PercentileMap;
    for (const k of keys) {
      cfads[k] = revPcts[k] - monthlyOpex;
    }
    monthlyPoints.push({
      monthIndex: i,
      calMonth,
      monthName: MONTH_NAMES[calMonth - 1],
      revenue: revPcts,
      cfads,
      debtService: monthlyDS,
    });
  }

  // Build calendar quarter blocks — group months by their actual calendar quarter.
  // Calendar quarter: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
  // Months at the edges may form partial quarters (< 3 months).
  const quarterBlocks: ForwardQuarterBlock[] = [];
  let blockIdx = 0;
  let i = 0;

  while (i < 12) {
    const calMonth = monthlyPoints[i].calMonth;
    const calQ = Math.ceil(calMonth / 3);  // 1-4
    // Determine the calendar year for this month
    const calYear = calMonth >= startMonth
      ? startYear
      : startYear + 1; // months that wrapped into next year

    // Collect all consecutive months in this calendar quarter
    const blockStart = i;
    while (i < 12) {
      const nextCM = monthlyPoints[i].calMonth;
      const nextQ = Math.ceil(nextCM / 3);
      const nextYear = nextCM >= startMonth ? startYear : startYear + 1;
      if (nextQ !== calQ || nextYear !== calYear) break;
      i++;
    }
    const blockEnd = i - 1;
    const monthCount = blockEnd - blockStart + 1;

    // Sum CFADS across months in this block
    const qCfads: PercentileMap = {} as PercentileMap;
    for (const k of keys) {
      let sum = 0;
      for (let m = blockStart; m <= blockEnd; m++) {
        sum += monthlyPoints[m].cfads[k];
      }
      qCfads[k] = sum;
    }

    // DSCR for this block = block CFADS / (monthlyDS × monthCount)
    const blockDS = monthlyDS * monthCount;
    const dscr: PercentileMap = {} as PercentileMap;
    for (const k of keys) {
      dscr[k] = blockDS > 0 ? qCfads[k] / blockDS : 0;
    }

    const yr2 = String(calYear).slice(-2);
    const label = `Q${calQ} '${yr2}`;

    quarterBlocks.push({
      quarterIndex: blockIdx,
      calQuarter: calQ,
      calYear,
      label,
      monthCount,
      startPos: blockStart,
      endPos: blockEnd,
      dscr,
    });
    blockIdx++;
  }

  void minDscr; // available for caller; not used in computation directly

  return { monthlyPoints, quarterBlocks };
}

export function computeFinancials(
  revenueValues: number[], // simulated paths only
  asset: AssetMeta,
  loanConfig: LoanConfig,
  opexOverride: number | null,
  minDscrOverride: number | null,
  quarterlyRevPcts?: PercentileMap[] | null, // optional: from computeQuarterlyPercentiles
  startYear: number = 2026                    // calendar year of forecast start
): ComputedFinancials {
  const { value: annualOpex } = resolveOpex(asset, opexOverride);
  const { value: minDscr } = resolveMinDscr(asset, minDscrOverride);

  // Percentile revenues
  const pctRevenue = computePercentiles(revenueValues);

  // CFADS = Revenue - OpEx (flat, Gen 1)
  const keys: PercentileKey[] = ["P10", "P25", "P50", "P75", "P90"];
  const pctCfads: PercentileMap = {} as PercentileMap;
  for (const k of keys) {
    pctCfads[k] = pctRevenue[k] - annualOpex;
  }

  // Build loan schedule
  const sculptCfads =
    loanConfig.amortType === "sculpted"
      ? pctCfads[loanConfig.sculptPercentile]
      : undefined;
  const loanSchedule = buildAmortization(loanConfig, sculptCfads);

  // DSCR table
  const dscrTable = computeDscrTable(loanSchedule, pctCfads);

  // KPI: find minimum DSCR across all years and all percentiles
  let minDscrValue = Infinity;
  let minDscrYear = 1;
  let minDscrPercentile: PercentileKey = "P10";

  for (const row of dscrTable) {
    for (const k of keys) {
      if (row.dscr[k] < minDscrValue) {
        minDscrValue = row.dscr[k];
        minDscrYear = row.year;
        minDscrPercentile = k;
      }
    }
  }

  // Binding case = lowest DSCR (typically P10, Year 1)
  const bindingDscr = minDscrValue;

  // Debt / CFADS ratio (leverage proxy)
  const debtCfadsRatio =
    pctCfads["P50"] > 0 ? loanConfig.principal / pctCfads["P50"] : 0;

  // Covenant status
  let breachCount = 0;
  for (const row of dscrTable) {
    for (const k of keys) {
      if (row.dscr[k] < minDscr) breachCount++;
    }
  }

  // Quarterly data (requires monthly paths; empty array if not available)
  const quarterlyData =
    quarterlyRevPcts && quarterlyRevPcts.length === 4
      ? computeQuarterlyData(quarterlyRevPcts, annualOpex, pctCfads, loanSchedule, minDscr, startYear)
      : [];

  // LTV
  const { ltv, assetValue } = resolveAssetValue(asset, loanConfig.principal);

  return {
    annualOpex,
    minDscr,
    pctRevenue,
    pctCfads,
    loanSchedule,
    dscrTable,
    quarterlyData,
    minDscrValue,
    minDscrYear,
    minDscrPercentile,
    bindingDscr,
    debtCfadsRatio,
    covenantStatus: breachCount === 0 ? "pass" : "breach",
    breachCount,
    ltv,
    assetValue,
  };
}
