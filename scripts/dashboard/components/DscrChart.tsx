"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { DscrRow, DisplayConfig } from "@/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface DscrChartProps {
  dscrTable: DscrRow[];
  minDscr: number;
  display: DisplayConfig;
}

const PERCENTILE_COLORS_DARK = {
  P10: "#f85149",
  P25: "#d29922",
  P50: "#58a6ff",
  P75: "#2ea043",
  P90: "#8b949e",
};

const PERCENTILE_COLORS_LIGHT = {
  P10: "#cf222e",
  P25: "#9a6700",
  P50: "#0969da",
  P75: "#1a7f37",
  P90: "#656d76",
};

type ViewMode = "lines" | "band";

export function DscrChart({ dscrTable, minDscr, display }: DscrChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("lines");
  useEffect(() => setMounted(true), []);

  if (!mounted || dscrTable.length === 0) {
    return (
      <div className="w-full h-72 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        Loading chart…
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";
  const colors = isDark ? PERCENTILE_COLORS_DARK : PERCENTILE_COLORS_LIGHT;
  const paperBg = isDark ? "#161b22" : "#ffffff";
  const plotBg = isDark ? "#0d1117" : "#fafbfc";
  const fontColor = isDark ? "#e6edf3" : "#1f2328";
  const gridColor = isDark ? "#21262d" : "#e8eaed";
  const axisColor = isDark ? "#8b949e" : "#656d76";
  const covenantColor = isDark ? "#d29922" : "#9a6700";
  const bandFill = isDark ? "rgba(88,166,255,0.12)" : "rgba(9,105,218,0.10)";

  const years = dscrTable.map((r) => r.year);

  // ── Lines mode traces ─────────────────────────────────────────────────────
  const percentiles: { key: keyof typeof display; label: string }[] = [
    { key: "showP10", label: "P10" },
    { key: "showP25", label: "P25" },
    { key: "showP50", label: "P50" },
    { key: "showP75", label: "P75" },
    { key: "showP90", label: "P90" },
  ];

  const lineTraces = percentiles
    .filter(({ key }) => display[key])
    .map(({ label }) => {
      const key = label as keyof typeof colors;
      return {
        x: years,
        y: dscrTable.map((r) => r.dscr[label as "P10"]),
        name: label,
        type: "scatter" as const,
        mode: "lines+markers" as const,
        line: {
          color: colors[key],
          width: label === "P50" ? 2.5 : 1.8,
          dash: "solid" as const,
        },
        marker: { size: 5, color: colors[key] },
        hovertemplate:
          `<b>${label}</b><br>Year %{x}<br>DSCR: %{y:.2f}x<br>` +
          `<extra></extra>`,
      };
    });

  // ── Band mode traces ──────────────────────────────────────────────────────
  // P10 (bottom boundary — invisible line, acts as baseline for fill)
  const bandTraces = [
    {
      x: years,
      y: dscrTable.map((r) => r.dscr["P10"]),
      name: "P10 (floor)",
      type: "scatter" as const,
      mode: "lines" as const,
      line: { color: "transparent", width: 0 },
      showlegend: false,
      hoverinfo: "skip" as const,
    },
    // P90 fills down to P10 — this creates the shaded band
    {
      x: years,
      y: dscrTable.map((r) => r.dscr["P90"]),
      name: "P10 – P90 range",
      type: "scatter" as const,
      mode: "lines" as const,
      fill: "tonexty" as const,
      fillcolor: bandFill,
      line: { color: isDark ? "#8b949e" : "#656d76", width: 1, dash: "dot" as const },
      hovertemplate: "<b>P90</b><br>Year %{x}<br>DSCR: %{y:.2f}x<extra></extra>",
    },
    // P50 center line — the primary signal
    {
      x: years,
      y: dscrTable.map((r) => r.dscr["P50"]),
      name: "P50 (median)",
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: colors["P50"], width: 2.5, dash: "solid" as const },
      marker: { size: 5, color: colors["P50"] },
      hovertemplate: "<b>P50</b><br>Year %{x}<br>DSCR: %{y:.2f}x<extra></extra>",
    },
  ];

  const activeTraces = viewMode === "lines" ? lineTraces : bandTraces;

  // Covenant min line — same in both modes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (activeTraces as any[]).push({
    x: [years[0], years[years.length - 1]],
    y: [minDscr, minDscr],
    name: `Covenant Min (${minDscr.toFixed(2)}x)`,
    type: "scatter",
    mode: "lines",
    line: { color: covenantColor, width: 1.5, dash: "dash" },
    marker: { size: 0, color: covenantColor },
    hovertemplate: `Covenant min: ${minDscr.toFixed(2)}x<extra></extra>`,
  });

  const layout = {
    paper_bgcolor: paperBg,
    plot_bgcolor: plotBg,
    margin: { t: 10, b: 40, l: 55, r: 20 },
    height: 300,
    font: { color: fontColor, family: "JetBrains Mono, Menlo, monospace", size: 11 },
    xaxis: {
      title: { text: "Loan Year", font: { size: 11, color: axisColor } },
      tickmode: "linear" as const,
      dtick: 2,
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 10 },
      zeroline: false,
    },
    yaxis: {
      title: { text: "DSCR", font: { size: 11, color: axisColor } },
      ticksuffix: "x",
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 10 },
      zeroline: false,
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
      font: { color: fontColor, size: 11 },
    },
    showlegend: true,
  };

  return (
    <div className="w-full">
      {/* Toggle */}
      <div className="flex justify-end mb-1">
        <div className="inline-flex rounded overflow-hidden border border-[var(--color-border)] text-xs">
          {(["lines", "band"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-0.5 capitalize transition-colors ${
                viewMode === mode
                  ? "bg-[var(--color-accent)] text-white font-medium"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] bg-transparent"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="plotly-chart w-full">
        <Plot
          data={activeTraces}
          layout={layout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "300px" }}
          useResizeHandler
        />
      </div>
    </div>
  );
}
