"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import type { PercentileMap } from "@/types";
import { gaussianKDE, scaleKdeToCounts } from "@/lib/stats";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface RevenueDistChartProps {
  revenuePaths: number[];
  pctRevenue: PercentileMap;
  annualOpex: number;
}

const P_COLORS_DARK: Record<string, string> = {
  P10: "#f85149", P25: "#d29922", P50: "#58a6ff", P75: "#2ea043", P90: "#8b949e",
};
const P_COLORS_LIGHT: Record<string, string> = {
  P10: "#cf222e", P25: "#9a6700", P50: "#0969da", P75: "#1a7f37", P90: "#656d76",
};

export function RevenueDistChart({ revenuePaths, pctRevenue, annualOpex }: RevenueDistChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const colors = isDark ? P_COLORS_DARK : P_COLORS_LIGHT;
  const paperBg = isDark ? "#161b22" : "#ffffff";
  const plotBg = isDark ? "#0d1117" : "#fafbfc";
  const fontColor = isDark ? "#e6edf3" : "#1f2328";
  const gridColor = isDark ? "#21262d" : "#e8eaed";
  const axisColor = isDark ? "#8b949e" : "#656d76";
  const barColor = isDark ? "#1f6feb" : "#0969da";
  const opexColor = isDark ? "#8b949e" : "#656d76";

  const inMillions = useMemo(
    () => revenuePaths.map((v) => v / 1e6),
    [revenuePaths]
  );

  const { x: kdeX, y: kdeY } = useMemo(
    () => gaussianKDE(inMillions),
    [inMillions]
  );

  const min = Math.min(...inMillions);
  const max = Math.max(...inMillions);
  const binWidth = (max - min) / 40;

  const kdeYScaled = useMemo(
    () => scaleKdeToCounts(kdeY, revenuePaths.length, binWidth),
    [kdeY, revenuePaths.length, binWidth]
  );

  if (!mounted || revenuePaths.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        Loading chart…
      </div>
    );
  }

  // Only histogram + KDE as traces (clean legend)
  const traces: object[] = [
    {
      x: inMillions,
      name: "Paths",
      type: "histogram",
      nbinsx: 40,
      marker: { color: barColor, opacity: 0.65, line: { color: barColor, width: 0.3 } },
      hovertemplate: "$%{x:.1f}M · %{y} paths<extra></extra>",
    },
    {
      x: kdeX,
      y: kdeYScaled,
      name: "KDE",
      type: "scatter",
      mode: "lines",
      line: { color: isDark ? "#58a6ff" : "#0969da", width: 2.5 },
      hoverinfo: "skip",
    },
  ];

  // P-value markers + OpEx as layout shapes (don't pollute the legend)
  const shapes: object[] = [];
  const annotations: object[] = [];

  (["P10", "P25", "P50", "P75", "P90"] as const).forEach((k) => {
    const v = pctRevenue[k] / 1e6;
    shapes.push({
      type: "line",
      x0: v, x1: v,
      y0: 0, y1: 1,
      yref: "paper",
      line: { color: colors[k], width: 1.5, dash: "dot" },
    });
    annotations.push({
      x: v,
      y: 1.02,
      yref: "paper",
      text: `<b>${k}</b>`,
      showarrow: false,
      font: { size: 8, color: colors[k], family: "JetBrains Mono, monospace" },
    });
  });

  // OpEx line
  const opexM = annualOpex / 1e6;
  shapes.push({
    type: "line",
    x0: opexM, x1: opexM,
    y0: 0, y1: 1,
    yref: "paper",
    line: { color: opexColor, width: 1.5, dash: "longdash" },
  });
  annotations.push({
    x: opexM,
    y: -0.08,
    yref: "paper",
    text: `OpEx $${opexM.toFixed(1)}M`,
    showarrow: false,
    font: { size: 7, color: opexColor, family: "JetBrains Mono, monospace" },
  });

  const layout = {
    paper_bgcolor: paperBg,
    plot_bgcolor: plotBg,
    margin: { t: 18, b: 48, l: 45, r: 12 },
    height: 260,
    font: { color: fontColor, family: "JetBrains Mono, Menlo, monospace", size: 10 },
    xaxis: {
      title: { text: "Annual Revenue ($M)", font: { size: 10, color: axisColor }, standoff: 6 },
      tickprefix: "$",
      ticksuffix: "M",
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 9 },
      zeroline: false,
    },
    yaxis: {
      title: { text: "Paths", font: { size: 10, color: axisColor } },
      gridcolor: gridColor,
      linecolor: gridColor,
      tickfont: { color: axisColor, size: 9 },
      zeroline: false,
    },
    legend: {
      orientation: "h" as const,
      x: 0.5,
      xanchor: "center" as const,
      y: -0.20,
      font: { size: 9, color: fontColor },
      bgcolor: "transparent",
    },
    bargap: 0.05,
    shapes,
    annotations,
    hoverlabel: { bgcolor: paperBg, bordercolor: gridColor, font: { color: fontColor, size: 10 } },
    showlegend: true,
  };

  return (
    <div className="plotly-chart w-full">
      <Plot
        data={traces as never}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "260px" }}
        useResizeHandler
      />
    </div>
  );
}
