"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { MonthlyStats } from "@/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface MonthlyChartProps {
  stats: MonthlyStats[];
}

export function MonthlyChart({ stats }: MonthlyChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="w-full h-56 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        Loading chart…
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="w-full h-56 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        Monthly data not available for this site. The revenue.duckdb may not contain a <code>monthly</code> table.
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";
  const paperBg = isDark ? "#161b22" : "#ffffff";
  const plotBg = isDark ? "#0d1117" : "#fafbfc";
  const fontColor = isDark ? "#e6edf3" : "#1f2328";
  const gridColor = isDark ? "#21262d" : "#e8eaed";
  const axisColor = isDark ? "#8b949e" : "#656d76";
  const boxColor = isDark ? "#1f6feb" : "#0969da";
  const medianColor = isDark ? "#58a6ff" : "#0969da";

  const months = stats.map((s) => s.monthName);
  const inM = (v: number) => v / 1e6;

  const traces = [
    // IQR box (Q1 to Q3)
    {
      x: months,
      y: stats.map((s) => inM(s.q3)),
      base: stats.map((s) => inM(s.q1)),
      name: "IQR (P25–P75)",
      type: "bar" as const,
      marker: { color: boxColor, opacity: 0.4 },
      hovertemplate: "%{x}: P25–P75 = $%{base:.2f}M – $%{y:.2f}M<extra></extra>",
    },
    // P10 line
    {
      x: months,
      y: stats.map((s) => inM(s.p10)),
      name: "P10",
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: isDark ? "#f85149" : "#cf222e", width: 1.5, dash: "dot" as const },
      marker: { size: 4 },
      hovertemplate: "%{x} P10: $%{y:.2f}M<extra></extra>",
    },
    // P50 (median)
    {
      x: months,
      y: stats.map((s) => inM(s.median)),
      name: "P50",
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: medianColor, width: 2 },
      marker: { size: 5, color: medianColor },
      hovertemplate: "%{x} P50: $%{y:.2f}M<extra></extra>",
    },
    // P90 line
    {
      x: months,
      y: stats.map((s) => inM(s.p90)),
      name: "P90",
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: isDark ? "#3fb950" : "#1a7f37", width: 1.5, dash: "dot" as const },
      marker: { size: 4 },
      hovertemplate: "%{x} P90: $%{y:.2f}M<extra></extra>",
    },
    // Mean line
    {
      x: months,
      y: stats.map((s) => inM(s.mean)),
      name: "Mean",
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: isDark ? "#d29922" : "#9a6700", width: 1.8, dash: "dashdot" as const },
      marker: { size: 4, symbol: "diamond" as const },
      hovertemplate: "%{x} Mean: $%{y:.2f}M<extra></extra>",
    },
  ];

  const layout = {
    paper_bgcolor: paperBg,
    plot_bgcolor: plotBg,
    margin: { t: 8, b: 40, l: 50, r: 10 },
    height: 230,
    font: { color: fontColor, family: "JetBrains Mono, Menlo, monospace", size: 10 },
    barmode: "relative" as const,
    xaxis: {
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 9 },
      zeroline: false,
    },
    yaxis: {
      title: { text: "$M / month", font: { size: 10, color: axisColor } },
      tickprefix: "$",
      ticksuffix: "M",
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 9 },
      zeroline: false,
    },
    legend: {
      orientation: "h" as const,
      x: 0, y: -0.22,
      font: { size: 9, color: fontColor },
      bgcolor: "transparent",
    },
    hoverlabel: { bgcolor: paperBg, bordercolor: gridColor, font: { color: fontColor, size: 10 } },
    showlegend: true,
  };

  return (
    <div className="plotly-chart w-full">
      <Plot
        data={traces}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "230px" }}
        useResizeHandler
      />
    </div>
  );
}
