import type {
  LoanConfig,
  LoanScheduleRow,
  DscrRow,
  ComputedFinancials,
  PercentileMap,
  PercentileKey,
  AssetMeta,
  QuarterlyPoint,
} from "@/types";
import { computePercentiles } from "@/lib/stats";

// ── OpEx defaults (NREL ATB 2024) ────────────────────────────────────────────

const OPEX_PER_MW: Record<string, number> = {
  solar: 23_000,   // $23k/MW-yr
  wind: 45_000,    // $45k/MW-yr
  battery: 40_000, // $/MW-yr
};

const MIN_DSCR_BY_TYPE: Record<string, number> = {
  solar: 1.25,
  wind: 1.35,
  battery: 2.0,
};

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
  minDscr: number
): QuarterlyPoint[] {
  const keys: PercentileKey[] = ["P10", "P25", "P50", "P75", "P90"];
  const quarterlyOpex = annualOpex / 4;
  const points: QuarterlyPoint[] = [];

  for (const row of loanSchedule) {
    const quarterlyDS = row.debtService / 4;

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

      points.push({
        year: row.year,
        quarter: q + 1,
        label: `Q${q + 1}-Y${row.year}`,
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

export function computeFinancials(
  revenueValues: number[], // simulated paths only
  asset: AssetMeta,
  loanConfig: LoanConfig,
  opexOverride: number | null,
  minDscrOverride: number | null,
  quarterlyRevPcts?: PercentileMap[] | null // optional: from computeQuarterlyPercentiles
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
      ? computeQuarterlyData(quarterlyRevPcts, annualOpex, pctCfads, loanSchedule, minDscr)
      : [];

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
  };
}
