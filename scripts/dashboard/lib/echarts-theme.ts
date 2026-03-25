import type { PercentileKey } from "@/types";

// ── Continuous risk gradient (DSCR vs covenant threshold) ──────────────────────

export interface ColorStop {
  t: number;
  r: number;
  g: number;
  b: number;
}

export const DARK_STOPS: ColorStop[] = [
  { t: 0.0, r: 248, g: 81, b: 73 }, // #f85149  severe breach
  { t: 0.2, r: 235, g: 130, b: 50 }, // orange   moderate breach
  { t: 0.35, r: 210, g: 153, b: 34 }, // #d29922  amber — near threshold
  { t: 0.6, r: 63, g: 185, b: 80 }, // #3fb950  comfortable
  { t: 1.0, r: 35, g: 134, b: 54 }, // #238636  very safe
];

export const LIGHT_STOPS: ColorStop[] = [
  { t: 0.0, r: 207, g: 34, b: 46 }, // #cf222e  severe breach
  { t: 0.2, r: 217, g: 119, b: 6 }, // #d97706  orange
  { t: 0.35, r: 191, g: 135, b: 0 }, // #bf8700  amber
  { t: 0.6, r: 45, g: 164, b: 78 }, // #2da44e  comfortable
  { t: 1.0, r: 26, g: 127, b: 55 }, // #1a7f37  very safe
];

export function lerpStops(stops: ColorStop[], t: number): string {
  const tc = Math.max(0, Math.min(1, t));
  let lo = stops[0],
    hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (tc >= stops[i].t && tc <= stops[i + 1].t) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const s = hi.t === lo.t ? 0 : (tc - lo.t) / (hi.t - lo.t);
  const r = Math.round(lo.r + (hi.r - lo.r) * s);
  const g = Math.round(lo.g + (hi.g - lo.g) * s);
  const b = Math.round(lo.b + (hi.b - lo.b) * s);
  return `rgb(${r},${g},${b})`;
}

export function dscrToT(dscr: number, minDscr: number): number {
  const floor = minDscr - 0.3;
  const ceiling = minDscr + 0.75;
  return (dscr - floor) / (ceiling - floor);
}

export function riskColor(
  dscr: number,
  minDscr: number,
  isDark: boolean
): string {
  return lerpStops(isDark ? DARK_STOPS : LIGHT_STOPS, dscrToT(dscr, minDscr));
}

export function riskOpacity(dscr: number, minDscr: number): number {
  const t = Math.max(0, Math.min(1, dscrToT(dscr, minDscr)));
  return 0.22 - t * 0.17; // breach → 0.22, very safe → 0.05
}

export function dscrMark(dscr: number, minDscr: number): string {
  return dscr >= minDscr ? "✓" : "✗";
}

export const RISK_BANDS: { y0: number; y1: number; key: PercentileKey }[] = [
  { y0: 0.0, y1: 0.2, key: "P10" },
  { y0: 0.2, y1: 0.4, key: "P25" },
  { y0: 0.4, y1: 0.6, key: "P50" },
  { y0: 0.6, y1: 0.8, key: "P75" },
  { y0: 0.8, y1: 1.0, key: "P90" },
];

// ── Chart palette ──────────────────────────────────────────────────────────────

export interface ChartPalette {
  paperBg: string;
  plotBg: string;
  fontColor: string;
  gridColor: string;
  axisColor: string;
  accent: string;
  accentFill10: string; // P10-P90 band fill
  accentFill22: string; // P25-P75 IQR fill
  warningColor: string;
  mutedLine: string;
}

export function getChartPalette(isDark: boolean): ChartPalette {
  return isDark
    ? {
        paperBg: "#161b22",
        plotBg: "#0d1117",
        fontColor: "#e6edf3",
        gridColor: "#21262d",
        axisColor: "#8b949e",
        accent: "#58a6ff",
        accentFill10: "rgba(88,166,255,0.10)",
        accentFill22: "rgba(88,166,255,0.22)",
        warningColor: "#d29922",
        mutedLine: "#6e7681",
      }
    : {
        paperBg: "#ffffff",
        plotBg: "#fafbfc",
        fontColor: "#1f2328",
        gridColor: "#e8eaed",
        axisColor: "#656d76",
        accent: "#0969da",
        accentFill10: "rgba(9,105,218,0.10)",
        accentFill22: "rgba(9,105,218,0.22)",
        warningColor: "#9a6700",
        mutedLine: "#9da3ab",
      };
}
