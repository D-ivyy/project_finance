"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type {
  DscrRow,
  LoanScheduleRow,
  PercentileMap,
  QuarterlyPoint,
} from "@/types";
import { fmtDscr, fmtMillion } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface HeroChartProps {
  dscrTable: DscrRow[];
  loanSchedule: LoanScheduleRow[];
  pctCfads: PercentileMap;
  annualOpex: number;
  minDscr: number;
  quarterlyData?: QuarterlyPoint[]; // optional — falls back to annual if missing
}

// ── Risk color helpers (by P10 LTM DSCR vs covenant) ─────────────────────────

function riskColor(p10Dscr: number, minDscr: number, isDark: boolean): string {
  if (p10Dscr < minDscr)
    return isDark ? "#f85149" : "#cf222e";
  if (p10Dscr < minDscr + 0.25)
    return isDark ? "#d29922" : "#bf8700";
  if (p10Dscr < minDscr + 0.75)
    return isDark ? "#3fb950" : "#1a7f37";
  return isDark ? "#3fb950" : "#1a7f37";
}

function riskOpacity(p10Dscr: number, minDscr: number): number {
  if (p10Dscr < minDscr) return 0.13;
  if (p10Dscr < minDscr + 0.25) return 0.10;
  if (p10Dscr < minDscr + 0.75) return 0.07;
  return 0.04;
}

// ── Annual fallback (when no monthly data) ────────────────────────────────────

function buildAnnualTraces(
  dscrTable: DscrRow[],
  loanSchedule: LoanScheduleRow[],
  pctCfads: PercentileMap,
  annualOpex: number,
  minDscr: number,
  isDark: boolean,
  accent: string,
  accentMuted: string,
  warningColor: string,
  mutedLine: string,
  paperBg: string,
  gridColor: string,
  fontColor: string
) {
  const years = dscrTable.map((r) => r.year);
  const toM = (v: number) => v / 1e6;

  const heatmapShapes = dscrTable.map((row) => ({
    type: "rect" as const,
    xref: "x" as const,
    yref: "paper" as const,
    x0: row.year - 0.5,
    x1: row.year + 0.5,
    y0: 0,
    y1: 1,
    fillcolor: riskColor(row.dscr.P10, minDscr, isDark),
    opacity: riskOpacity(row.dscr.P10, minDscr),
    line: { width: 0 },
    layer: "below" as const,
  }));

  const cfadsP10 = years.map(() => toM(pctCfads.P10));
  const cfadsP25 = years.map(() => toM(pctCfads.P25));
  const cfadsP50 = years.map(() => toM(pctCfads.P50));
  const cfadsP75 = years.map(() => toM(pctCfads.P75));
  const cfadsP90 = years.map(() => toM(pctCfads.P90));
  const dsArr = loanSchedule.map((r) => toM(r.debtService));

  const cfadsHover = dscrTable.map((row) =>
    `<b>Year ${row.year}</b><br>` +
    `Revenue (P50): $${toM(pctCfads.P50 + annualOpex).toFixed(2)}M<br>` +
    `OpEx: $${toM(annualOpex).toFixed(2)}M<br>` +
    `CFADS (P50): $${toM(pctCfads.P50).toFixed(2)}M`
  );

  const dsHover = loanSchedule.map((r) =>
    `<b>Year ${r.year}</b><br>` +
    `Debt Service: ${fmtMillion(r.debtService)}<br>` +
    `Interest: ${fmtMillion(r.interest)}<br>` +
    `Principal: ${fmtMillion(r.principal)}`
  );

  const bgHoverText = dscrTable.map((row) => {
    const pass = row.dscr.P10 >= minDscr;
    return (
      `<b>Year ${row.year} — LTM DSCR</b><br>` +
      `P10: ${fmtDscr(row.dscr.P10)} ${row.dscr.P10 >= minDscr ? "✓" : "✗"}<br>` +
      `P25: ${fmtDscr(row.dscr.P25)} ✓<br>` +
      `P50: ${fmtDscr(row.dscr.P50)} ✓<br>` +
      `P75: ${fmtDscr(row.dscr.P75)} ✓<br>` +
      `P90: ${fmtDscr(row.dscr.P90)} ✓<br>` +
      `DS: ${fmtMillion(row.debtService)} · CFADS: ${fmtMillion(row.cfads.P50)}<br>` +
      `Covenant (${minDscr.toFixed(2)}x): <b>${pass ? "PASS" : "BREACH"}</b>`
    );
  });

  const bgHoverY = years.map(() => toM(pctCfads.P90) * 0.12);

  const traces = [
    { x: years, y: cfadsP10, type: "scatter" as const, mode: "lines" as const,
      line: { width: 0, color: "transparent" }, showlegend: false, hoverinfo: "skip" as const, name: "_p10" },
    { x: years, y: cfadsP90, type: "scatter" as const, mode: "lines" as const,
      fill: "tonexty" as const, fillcolor: `${accentMuted}0.10)`,
      line: { width: 1, dash: "dot" as const, color: mutedLine }, name: "CFADS P10–P90", hoverinfo: "skip" as const },
    { x: years, y: cfadsP25, type: "scatter" as const, mode: "lines" as const,
      line: { width: 0, color: "transparent" }, showlegend: false, hoverinfo: "skip" as const, name: "_p25" },
    { x: years, y: cfadsP75, type: "scatter" as const, mode: "lines" as const,
      fill: "tonexty" as const, fillcolor: `${accentMuted}0.22)`,
      line: { width: 1, dash: "dot" as const, color: mutedLine }, name: "CFADS IQR", hoverinfo: "skip" as const },
    { x: years, y: cfadsP50, type: "scatter" as const, mode: "lines+markers" as const,
      line: { width: 2.5, color: accent }, marker: { size: 5, color: accent },
      name: "CFADS P50", text: cfadsHover, hovertemplate: "%{text}<extra></extra>" },
    { x: years, y: dsArr, type: "scatter" as const, mode: "lines+markers" as const,
      line: { width: 2.2, color: warningColor },
      marker: { size: 5, color: warningColor, symbol: "diamond" as const },
      name: "Debt Service", text: dsHover, hovertemplate: "%{text}<extra></extra>" },
    { x: years, y: bgHoverY, type: "scatter" as const, mode: "markers" as const,
      marker: { size: 20, color: "rgba(0,0,0,0)", line: { width: 0 } },
      name: "LTM DSCR Detail", showlegend: false,
      text: bgHoverText, hovertemplate: "%{text}<extra></extra>",
      hoverlabel: { bgcolor: paperBg, bordercolor: gridColor, font: { color: fontColor, size: 11 } } },
  ];

  return { traces, heatmapShapes, xaxis: { tickmode: "linear" as const, dtick: 2, range: [years[0] - 0.5, years[years.length - 1] + 0.5] } };
}

// ── Quarterly chart builder ────────────────────────────────────────────────────

function buildQuarterlyTraces(
  quarterlyData: QuarterlyPoint[],
  minDscr: number,
  isDark: boolean,
  accent: string,
  accentMuted: string,
  warningColor: string,
  mutedLine: string,
  paperBg: string,
  gridColor: string,
  fontColor: string
) {
  const toM = (v: number) => v / 1e6;
  const labels = quarterlyData.map((p) => p.label);

  const heatmapShapes = quarterlyData.map((p, i) => ({
    type: "rect" as const,
    xref: "x" as const,
    yref: "paper" as const,
    x0: i - 0.5,
    x1: i + 0.5,
    y0: 0,
    y1: 1,
    fillcolor: riskColor(p.ltmDscr.P10, minDscr, isDark),
    opacity: riskOpacity(p.ltmDscr.P10, minDscr),
    line: { width: 0 },
    layer: "below" as const,
  }));

  const cfadsP10 = quarterlyData.map((p) => toM(p.cfads.P10));
  const cfadsP25 = quarterlyData.map((p) => toM(p.cfads.P25));
  const cfadsP50 = quarterlyData.map((p) => toM(p.cfads.P50));
  const cfadsP75 = quarterlyData.map((p) => toM(p.cfads.P75));
  const cfadsP90 = quarterlyData.map((p) => toM(p.cfads.P90));
  const dsArr = quarterlyData.map((p) => toM(p.debtService));

  const cfadsHover = quarterlyData.map((p) =>
    `<b>${p.label}</b><br>` +
    `CFADS P50: $${toM(p.cfads.P50).toFixed(2)}M<br>` +
    `CFADS range: $${toM(p.cfads.P10).toFixed(2)}M – $${toM(p.cfads.P90).toFixed(2)}M`
  );

  const dsHover = quarterlyData.map((p) =>
    `<b>${p.label}</b><br>` +
    `Quarterly DS: $${toM(p.debtService).toFixed(2)}M<br>` +
    `Annual DS: $${(toM(p.debtService) * 4).toFixed(2)}M`
  );

  const bgHoverText = quarterlyData.map((p) => {
    const pass = p.ltmDscr.P10 >= minDscr;
    return (
      `<b>${p.label} — LTM DSCR (trailing 12m)</b><br>` +
      `P10: ${fmtDscr(p.ltmDscr.P10)} ${pass ? "✓" : "✗"}<br>` +
      `P25: ${fmtDscr(p.ltmDscr.P25)}<br>` +
      `P50: ${fmtDscr(p.ltmDscr.P50)}<br>` +
      `P75: ${fmtDscr(p.ltmDscr.P75)}<br>` +
      `P90: ${fmtDscr(p.ltmDscr.P90)}<br>` +
      `Covenant (${minDscr.toFixed(2)}x): <b>${pass ? "PASS" : "BREACH"}</b>`
    );
  });

  const bgHoverY = quarterlyData.map((p) => toM(p.cfads.P90) * 0.12);

  // X-axis: show only Q1 labels (year labels) to avoid crowding
  const tickvals: number[] = [];
  const ticktext: string[] = [];
  quarterlyData.forEach((p, i) => {
    if (p.quarter === 1) {
      tickvals.push(i);
      ticktext.push(`Y${p.year}`);
    }
  });

  const xIndices = quarterlyData.map((_, i) => i);

  const spline = "spline" as const;

  const traces = [
    { x: xIndices, y: cfadsP10, type: "scatter" as const, mode: "lines" as const,
      line: { width: 0, color: "transparent", shape: spline, smoothing: 1.0 }, showlegend: false, hoverinfo: "skip" as const, name: "_p10" },
    { x: xIndices, y: cfadsP90, type: "scatter" as const, mode: "lines" as const,
      fill: "tonexty" as const, fillcolor: `${accentMuted}0.10)`,
      line: { width: 1, dash: "dot" as const, color: mutedLine, shape: spline, smoothing: 1.0 }, name: "CFADS P10–P90", hoverinfo: "skip" as const },
    { x: xIndices, y: cfadsP25, type: "scatter" as const, mode: "lines" as const,
      line: { width: 0, color: "transparent", shape: spline, smoothing: 1.0 }, showlegend: false, hoverinfo: "skip" as const, name: "_p25" },
    { x: xIndices, y: cfadsP75, type: "scatter" as const, mode: "lines" as const,
      fill: "tonexty" as const, fillcolor: `${accentMuted}0.22)`,
      line: { width: 1, dash: "dot" as const, color: mutedLine, shape: spline, smoothing: 1.0 }, name: "CFADS IQR", hoverinfo: "skip" as const },
    { x: xIndices, y: cfadsP50, type: "scatter" as const, mode: "lines" as const,
      line: { width: 2.5, color: accent, shape: spline, smoothing: 1.0 },
      name: "CFADS P50", text: cfadsHover, hovertemplate: "%{text}<extra></extra>" },
    { x: xIndices, y: dsArr, type: "scatter" as const, mode: "lines" as const,
      line: { width: 2.2, color: warningColor },
      name: "Debt Service", text: dsHover, hovertemplate: "%{text}<extra></extra>" },
    { x: xIndices, y: bgHoverY, type: "scatter" as const, mode: "markers" as const,
      marker: { size: 20, color: "rgba(0,0,0,0)", line: { width: 0 } },
      name: "LTM DSCR Detail", showlegend: false,
      text: bgHoverText, hovertemplate: "%{text}<extra></extra>",
      hoverlabel: { bgcolor: paperBg, bordercolor: gridColor, font: { color: fontColor, size: 11 } } },
  ];

  void labels; // used only for reference

  return {
    traces,
    heatmapShapes,
    xaxis: {
      tickmode: "array" as const,
      tickvals,
      ticktext,
      range: [-0.5, xIndices.length - 0.5],
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HeroChart({
  dscrTable,
  loanSchedule,
  pctCfads,
  annualOpex,
  minDscr,
  quarterlyData,
}: HeroChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || dscrTable.length === 0) {
    return (
      <div className="w-full h-[380px] flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        Loading chart…
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";
  const paperBg = isDark ? "#161b22" : "#ffffff";
  const plotBg = isDark ? "#0d1117" : "#fafbfc";
  const fontColor = isDark ? "#e6edf3" : "#1f2328";
  const gridColor = isDark ? "#21262d" : "#e8eaed";
  const axisColor = isDark ? "#8b949e" : "#656d76";
  const accent = isDark ? "#58a6ff" : "#0969da";
  const accentMuted = isDark ? "rgba(88,166,255," : "rgba(9,105,218,";
  const warningColor = isDark ? "#d29922" : "#9a6700";
  const mutedLine = isDark ? "#6e7681" : "#9da3ab";

  const useQuarterly = quarterlyData && quarterlyData.length > 0;
  const isQuarterly = useQuarterly;

  const { traces, heatmapShapes, xaxis: xaxisExtra } = useQuarterly
    ? buildQuarterlyTraces(
        quarterlyData!,
        minDscr,
        isDark,
        accent,
        accentMuted,
        warningColor,
        mutedLine,
        paperBg,
        gridColor,
        fontColor
      )
    : buildAnnualTraces(
        dscrTable,
        loanSchedule,
        pctCfads,
        annualOpex,
        minDscr,
        isDark,
        accent,
        accentMuted,
        warningColor,
        mutedLine,
        paperBg,
        gridColor,
        fontColor
      );

  const layout = {
    paper_bgcolor: paperBg,
    plot_bgcolor: plotBg,
    height: 380,
    margin: { t: 16, b: 44, l: 58, r: 20 },
    shapes: heatmapShapes,
    font: {
      family: "JetBrains Mono, Menlo, monospace",
      color: fontColor,
      size: 11,
    },
    xaxis: {
      title: {
        text: isQuarterly ? "Loan Year (quarterly)" : "Loan Year",
        font: { size: 11, color: axisColor },
        standoff: 8,
      },
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 10 },
      zeroline: false,
      ...xaxisExtra,
    },
    yaxis: {
      title: { text: "$M", font: { size: 11, color: axisColor } },
      tickprefix: "$",
      ticksuffix: "M",
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 10 },
      zeroline: false,
      rangemode: "tozero" as const,
    },
    legend: {
      orientation: "h" as const,
      x: 0,
      y: -0.18,
      font: { size: 10, color: fontColor },
      bgcolor: "transparent",
    },
    hoverlabel: {
      bgcolor: paperBg,
      bordercolor: gridColor,
      font: { color: fontColor, size: 11, family: "JetBrains Mono, Menlo, monospace" },
    },
    showlegend: true,
  };

  return (
    <div className="plotly-chart w-full">
      {isQuarterly && (
        <div className="text-xs text-[var(--color-text-muted)] mb-1 text-right">
          Quarterly CFADS · background = LTM DSCR covenant status · hover for detail
        </div>
      )}
      <Plot
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={traces as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layout={layout as any}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "380px" }}
        useResizeHandler
      />
    </div>
  );
}
