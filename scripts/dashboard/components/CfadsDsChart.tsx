"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { DscrRow, LoanScheduleRow, PercentileKey } from "@/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface CfadsDsChartProps {
  dscrTable: DscrRow[];
  loanSchedule: LoanScheduleRow[];
  annualOpex: number;
  selectedPercentile: PercentileKey;
}

export function CfadsDsChart({
  dscrTable,
  loanSchedule,
  annualOpex,
  selectedPercentile,
}: CfadsDsChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || dscrTable.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
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

  const years = dscrTable.map((r) => `Yr ${r.year}`);
  const revenues = dscrTable.map((r) => (r.cfads[selectedPercentile] + annualOpex) / 1e6);
  const opexArr = dscrTable.map(() => annualOpex / 1e6);
  const cfadsArr = dscrTable.map((r) => r.cfads[selectedPercentile] / 1e6);
  const dsArr = dscrTable.map((r) => r.debtService / 1e6);

  const traces = [
    {
      x: years,
      y: revenues,
      name: "Revenue",
      type: "bar" as const,
      marker: { color: isDark ? "#1f6feb" : "#4393e6", opacity: 0.80 },
      hovertemplate: "%{x}<br>Revenue: $%{y:.2f}M<extra></extra>",
    },
    {
      x: years,
      y: cfadsArr,
      name: "CFADS",
      type: "bar" as const,
      marker: { color: isDark ? "#58a6ff" : "#0969da", opacity: 0.90 },
      hovertemplate: "%{x}<br>CFADS: $%{y:.2f}M<extra></extra>",
    },
    {
      x: years,
      y: opexArr,
      name: "OpEx",
      type: "bar" as const,
      marker: { color: isDark ? "#6e7681" : "#8b949e", opacity: 0.65 },
      hovertemplate: "%{x}<br>OpEx: $%{y:.2f}M<extra></extra>",
    },
    {
      x: years,
      y: dsArr,
      name: "Debt Service",
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: isDark ? "#d29922" : "#9a6700", width: 2.5 },
      marker: {
        size: 6,
        color: dsArr.map((ds, i) =>
          cfadsArr[i] >= ds
            ? isDark ? "#3fb950" : "#1a7f37"
            : isDark ? "#f85149" : "#cf222e"
        ),
        line: { color: isDark ? "#d29922" : "#9a6700", width: 1 },
      },
      hovertemplate: "%{x}<br>DS: $%{y:.2f}M<extra></extra>",
    },
  ];

  const layout = {
    paper_bgcolor: paperBg,
    plot_bgcolor: plotBg,
    margin: { t: 8, b: 60, l: 50, r: 12 },
    height: 260,
    barmode: "group" as const,
    bargap: 0.15,
    bargroupgap: 0.06,
    font: { color: fontColor, family: "JetBrains Mono, Menlo, monospace", size: 10 },
    xaxis: {
      tickangle: -45,
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 8 },
      zeroline: false,
    },
    yaxis: {
      title: { text: "$M", font: { size: 10, color: axisColor } },
      tickprefix: "$",
      ticksuffix: "M",
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 9 },
      zeroline: false,
      rangemode: "tozero" as const,
    },
    legend: {
      orientation: "h" as const,
      x: 0.5,
      xanchor: "center" as const,
      y: -0.30,
      font: { size: 9, color: fontColor },
      bgcolor: "transparent",
      itemwidth: 30,
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
        style={{ width: "100%", height: "260px" }}
        useResizeHandler
      />
    </div>
  );
}
