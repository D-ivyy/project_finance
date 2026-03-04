import type { MonthlyRevenuePath, MonthlyStats, PercentileMap } from "@/types";

/**
 * Compute the p-th percentile of a sorted or unsorted array.
 * Uses linear interpolation (same as numpy default).
 */
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const frac = index - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

/** Compute P10/P25/P50/P75/P90 from an array of revenue values */
export function computePercentiles(values: number[]): PercentileMap {
  return {
    P10: percentile(values, 10),
    P25: percentile(values, 25),
    P50: percentile(values, 50),
    P75: percentile(values, 75),
    P90: percentile(values, 90),
  };
}

/**
 * Simple Gaussian KDE for histogram overlay.
 * Returns {x, y} arrays for the density curve.
 * Bandwidth: Silverman's rule.
 */
export function gaussianKDE(
  values: number[],
  numPoints = 200
): { x: number[]; y: number[] } {
  if (values.length < 2) return { x: [], y: [] };

  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  );

  // Silverman's bandwidth
  const h = 1.06 * std * Math.pow(n, -0.2);

  const min = Math.min(...values) - 2 * h;
  const max = Math.max(...values) + 2 * h;
  const step = (max - min) / numPoints;

  const xArr: number[] = [];
  const yArr: number[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const xi = min + i * step;
    let density = 0;
    for (const v of values) {
      const u = (xi - v) / h;
      density += Math.exp(-0.5 * u * u) / (Math.sqrt(2 * Math.PI) * h);
    }
    density /= n;
    xArr.push(xi);
    yArr.push(density);
  }

  return { x: xArr, y: yArr };
}

/** Scale KDE density to match histogram bin counts */
export function scaleKdeToCounts(
  kdeY: number[],
  totalPaths: number,
  binWidth: number
): number[] {
  return kdeY.map((d) => d * totalPaths * binWidth);
}

/** Compute monthly box plot statistics from monthly revenue paths */
export function computeMonthlyStats(
  monthlyPaths: MonthlyRevenuePath[]
): MonthlyStats[] {
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const byMonth: Record<number, number[]> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = [];

  for (const row of monthlyPaths) {
    if (row.month >= 1 && row.month <= 12) {
      byMonth[row.month].push(row.monthly_revenue_usd);
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const vals = byMonth[m];
    if (vals.length === 0) {
      return {
        month: m,
        monthName: MONTH_NAMES[i],
        q1: 0, median: 0, q3: 0, p10: 0, p90: 0, mean: 0,
      };
    }
    return {
      month: m,
      monthName: MONTH_NAMES[i],
      q1: percentile(vals, 25),
      median: percentile(vals, 50),
      q3: percentile(vals, 75),
      p10: percentile(vals, 10),
      p90: percentile(vals, 90),
      mean: vals.reduce((s, v) => s + v, 0) / vals.length,
    };
  });
}

/**
 * Compute quarterly revenue percentiles from monthly paths.
 *
 * The monthly data contains one year of 12 months across N simulated paths.
 * Each path has monthly_revenue_usd for months 1–12.
 *
 * For each path, quarters are summed:
 *   Q1 = months 1+2+3, Q2 = 4+5+6, Q3 = 7+8+9, Q4 = 10+11+12
 *
 * Returns an array of 4 PercentileMaps (index 0 = Q1, ..., 3 = Q4).
 * Returns null if monthly data is missing (hero chart falls back to annual).
 */
export function computeQuarterlyPercentiles(
  monthlyPaths: MonthlyRevenuePath[]
): PercentileMap[] | null {
  if (monthlyPaths.length === 0) return null;

  // Group by path_id → map of month → revenue
  const byPath = new Map<number, Map<number, number>>();
  for (const row of monthlyPaths) {
    if (!byPath.has(row.path_id)) byPath.set(row.path_id, new Map());
    byPath.get(row.path_id)!.set(row.month, row.monthly_revenue_usd);
  }

  // Quarter definitions: Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12
  const quarterMonths = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
  ];

  // For each quarter, collect summed revenue across all paths
  const quarterValues: number[][] = [[], [], [], []];

  for (const [, monthMap] of byPath) {
    for (let q = 0; q < 4; q++) {
      const months = quarterMonths[q];
      // Only include paths that have all 3 months for this quarter
      const vals = months.map((m) => monthMap.get(m) ?? 0);
      quarterValues[q].push(vals[0] + vals[1] + vals[2]);
    }
  }

  // Check we have enough data
  if (quarterValues[0].length === 0) return null;

  return quarterValues.map((vals) => computePercentiles(vals));
}
