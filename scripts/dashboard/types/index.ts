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
  showP10: boolean;
  showP25: boolean;
  showP50: boolean;
  showP75: boolean;
  showP90: boolean;
  selectedPercentile: SculptPercentile; // for Zone D bar chart
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
  // KPI summary
  minDscrValue: number;
  minDscrYear: number;
  minDscrPercentile: PercentileKey;
  bindingDscr: number;
  debtCfadsRatio: number; // principal / P50 CFADS Year 1
  covenantStatus: "pass" | "breach";
  breachCount: number;
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
