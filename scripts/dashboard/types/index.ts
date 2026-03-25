// ── Asset & Revenue Data ──────────────────────────────────────────────────────

export interface AssetMeta {
  asset_slug: string;
  asset_type: "solar" | "wind" | "battery" | string;
  state: string;
  ac_capacity_mw: number | null;
}

export interface RevenuePath {
  path_id: number;
  segment: "simulated" | "historical";
  source_year: number | null;
  annual_revenue_usd: number;
  price_per_mwh_gen_weighted: number;
  revenue_coverage_pct: number;
}

export interface MonthlyRevenuePath {
  path_id: number;
  segment: string;
  month: number; // 1-12
  monthly_revenue_usd: number;
}

export interface SiteData {
  asset: AssetMeta;
  revenue_paths: RevenuePath[];
  monthly_paths: MonthlyRevenuePath[];
  available_sites: { asset_slug: string; asset_type: string; state: string }[];
  kind: string;
  market: string;
  forecast_start_month: number; // 1-12, calendar month the 12-month window begins
  forecast_start_year: number;  // 4-digit calendar year (e.g. 2026)
}

// ── Loan Configuration ───────────────────────────────────────────────────────

export type AmortType = "level_payment" | "level_principal" | "sculpted";
export type SculptPercentile = "P10" | "P25" | "P50" | "P75" | "P90";

export interface LoanConfig {
  principal: number;         // $
  annualRate: number;        // decimal e.g. 0.06
  tenorYears: number;        // integer
  amortType: AmortType;
  targetDscrSculpt: number;  // e.g. 1.40
  sculptPercentile: SculptPercentile;
}

export interface DisplayConfig {
  selectedPercentile: SculptPercentile; // controls Revenue/CFADS columns in ledger table
}

export interface FilterConfig {
  kind: "hub" | "node";
  market: "da" | "rt";
}

// ── Computed Results ─────────────────────────────────────────────────────────

export interface LoanScheduleRow {
  year: number;
  openingBalance: number;
  interest: number;
  principal: number;
  debtService: number;
  closingBalance: number;
}

export type PercentileKey = "P10" | "P25" | "P50" | "P75" | "P90";

export type PercentileMap<T = number> = Record<PercentileKey, T>;

export interface DscrRow {
  year: number;
  debtService: number;
  cfads: PercentileMap;
  dscr: PercentileMap;
}

export interface ComputedFinancials {
  // Input
  annualOpex: number;
  minDscr: number;
  // Revenue percentiles from simulated paths
  pctRevenue: PercentileMap;
  // CFADS = Revenue - OpEx
  pctCfads: PercentileMap;
  // Loan schedule
  loanSchedule: LoanScheduleRow[];
  // DSCR by year and percentile
  dscrTable: DscrRow[];
  // Quarterly CFADS + LTM DSCR (from monthly paths)
  quarterlyData: QuarterlyPoint[];
  // KPI summary
  minDscrValue: number;
  minDscrYear: number;
  minDscrPercentile: PercentileKey;
  bindingDscr: number;
  debtCfadsRatio: number; // principal / P50 CFADS Year 1
  covenantStatus: "pass" | "breach";
  breachCount: number;
  // LTV (Loan-to-Value)
  ltv: number | null;        // principal / estimated asset value (null if capacity unknown)
  assetValue: number | null;  // estimated from NREL ATB 2024 CapEx × capacity
}

// ── Validation ───────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationMessage {
  severity: ValidationSeverity;
  field: string;
  message: string;
}

// ── Monthly box plot stats (computed client-side) ────────────────────────────

export interface MonthlyStats {
  month: number;          // 1-12
  monthName: string;      // "Jan"
  q1: number;
  median: number;
  q3: number;
  p10: number;
  p90: number;
  mean: number;
}

// ── Quarterly CFADS + LTM DSCR (computed client-side) ────────────────────────

export interface QuarterlyPoint {
  year: number;             // 1 to tenorYears (loan year)
  quarter: number;          // 1-4 (calendar quarter: Q1=Jan-Mar, Q2=Apr-Jun, ...)
  calYear: number;          // concrete calendar year (e.g. 2026, 2027, ...)
  label: string;            // "Q1 '26", "Q2 '26", ...
  revenue: PercentileMap;   // quarterly revenue percentiles ($)
  cfads: PercentileMap;     // quarterly CFADS percentiles ($ = revenue - opex/4)
  debtService: number;      // quarterly DS (annual DS / 4)
  ltmDscr: PercentileMap;   // LTM DSCR at this test date (trailing 12-month)
}

// ── Monthly forward-looking view (12-month, computed client-side) ─────────────

export interface MonthlyViewPoint {
  monthIndex: number;       // 0-11 (position in the 12-month forward window)
  calMonth: number;         // 1-12 (calendar month: 1=Jan, ..., 12=Dec)
  monthName: string;        // "Jan", "Feb", etc.
  revenue: PercentileMap;   // monthly revenue percentiles ($)
  cfads: PercentileMap;     // monthly CFADS percentiles (revenue - opex/12)
  debtService: number;      // monthly DS (annual DS Y1 / 12)
}

// One block per calendar quarter within the 12-month window
export interface ForwardQuarterBlock {
  quarterIndex: number;     // 0-based position in the 12-month window
  calQuarter: number;       // 1-4 (calendar quarter: Q1=Jan-Mar, Q2=Apr-Jun, ...)
  calYear: number;          // concrete calendar year (e.g. 2026)
  label: string;            // e.g. "Q1 '26" or "Q2 '26"
  monthCount: number;       // number of months in this block (1-3, partial at edges)
  startPos: number;         // x-axis start position (0-11)
  endPos: number;           // x-axis end position (0-11)
  dscr: PercentileMap;      // quarterly DSCR at each percentile (using actual months)
}
