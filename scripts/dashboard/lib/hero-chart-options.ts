import type { EChartsOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "echarts";
import type {
  DscrRow,
  LoanScheduleRow,
  PercentileMap,
  PercentileKey,
  QuarterlyPoint,
  MonthlyViewPoint,
  ForwardQuarterBlock,
} from "@/types";
import { fmtDscr, fmtMillion } from "@/lib/api";
import {
  RISK_BANDS,
  riskColor,
  riskOpacity,
  dscrMark,
  type ChartPalette,
} from "@/lib/echarts-theme";

// ── Helpers ────────────────────────────────────────────────────────────────────

const toM = (v: number) => v / 1e6;

const FONT_FAMILY = "JetBrains Mono, Menlo, monospace";

// ECharts axis-trigger tooltip param type (subset we actually use)
interface AxisTooltipParam {
  dataIndex: number;
  axisValue?: string | number;
  seriesType?: string;
}

/** Reliably extract the x-axis category index from tooltip params.
 *  Uses axisValue (the category data value) rather than dataIndex, because
 *  custom series (heatmap) have multiple data entries per category and their
 *  dataIndex doesn't match the category index. */
function axisIdx(params: unknown): number {
  const arr = params as AxisTooltipParam[];
  if (!arr || !arr.length) return -1;
  return Number(arr[0].axisValue);
}

function baseGrid() {
  return { top: 16, bottom: 50, left: 58, right: 20 };
}

function baseYAxis(palette: ChartPalette) {
  return {
    type: "value" as const,
    min: 0,
    name: "$M",
    nameTextStyle: { color: palette.axisColor, fontSize: 11, fontFamily: FONT_FAMILY },
    axisLabel: {
      formatter: (v: number) => `$${v.toFixed(1)}M`,
      color: palette.axisColor,
      fontSize: 10,
      fontFamily: FONT_FAMILY,
    },
    axisLine: { lineStyle: { color: palette.gridColor } },
    splitLine: { lineStyle: { color: palette.gridColor } },
  };
}

function baseLegend(palette: ChartPalette) {
  return {
    data: ["CFADS P10–P90", "CFADS IQR", "CFADS P50", "Debt Service"],
    bottom: 0,
    left: 0,
    orient: "horizontal" as const,
    textStyle: { fontSize: 10, color: palette.fontColor, fontFamily: FONT_FAMILY },
    itemWidth: 16,
    itemHeight: 8,
  };
}

function baseTooltip(palette: ChartPalette) {
  return {
    trigger: "axis" as const,
    backgroundColor: palette.paperBg,
    borderColor: palette.gridColor,
    textStyle: {
      color: palette.fontColor,
      fontSize: 11,
      fontFamily: FONT_FAMILY,
    },
    axisPointer: {
      type: "shadow" as const,
      shadowStyle: { color: "rgba(0,0,0,0.04)" },
    },
  };
}

// ── Heatmap renderItem ─────────────────────────────────────────────────────────
// Each data entry: [xIndex, bandY0_frac, bandY1_frac, dscrValue]
// bandY0/Y1 are fractions of the grid height (0 = bottom, 1 = top)

function makeHeatmapRenderItem(minDscr: number, isDark: boolean, categoryCount: number) {
  // Edge bleed: extend first/last cells a few px past the grid boundary so the
  // heatmap covers any sub-pixel gap between coordSys and the visible chart edge.
  // The heatmap renders at z=-1 (behind axis lines/labels), so the bleed is invisible.
  const EDGE_BLEED = 6;

  return function renderItem(
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ) {
    const xIdx = api.value(0) as number;
    const bandY0 = api.value(1) as number;
    const bandY1 = api.value(2) as number;
    const dscr = api.value(3) as number;

    const coordSys = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
    const cellWidth = coordSys.width / categoryCount;
    let leftPx = coordSys.x + xIdx * cellWidth;
    let rightPx = leftPx + cellWidth;

    // Bleed edge cells past grid boundary
    if (xIdx === 0) leftPx -= EDGE_BLEED;
    if (xIdx === categoryCount - 1) rightPx += EDGE_BLEED;

    const y0Px = coordSys.y + coordSys.height * (1 - bandY1);
    const y1Px = coordSys.y + coordSys.height * (1 - bandY0);

    return {
      type: "rect" as const,
      shape: {
        x: leftPx,
        y: y0Px,
        width: rightPx - leftPx,
        height: y1Px - y0Px,
      },
      style: {
        fill: riskColor(dscr, minDscr, isDark),
        opacity: riskOpacity(dscr, minDscr),
      },
      z2: -1,
    };
  };
}

// Variant for monthly view where heatmap spans multiple x positions per block
// Data format: [startPos, endPos, bandY0, bandY1, dscr] — raw month indices (0-based, inclusive)
function makeMonthlyHeatmapRenderItem(minDscr: number, isDark: boolean, monthCount: number) {
  const EDGE_BLEED = 6;

  return function renderItem(
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ) {
    const startPos = api.value(0) as number;
    const endPos = api.value(1) as number;
    const bandY0 = api.value(2) as number;
    const bandY1 = api.value(3) as number;
    const dscr = api.value(4) as number;

    const coordSys = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
    const cellWidth = coordSys.width / monthCount;
    let leftPx = coordSys.x + startPos * cellWidth;
    let rightPx = coordSys.x + (endPos + 1) * cellWidth;

    // Bleed edge blocks past grid boundary
    if (startPos === 0) leftPx -= EDGE_BLEED;
    if (endPos === monthCount - 1) rightPx += EDGE_BLEED;

    const y0Px = coordSys.y + coordSys.height * (1 - bandY1);
    const y1Px = coordSys.y + coordSys.height * (1 - bandY0);

    return {
      type: "rect" as const,
      shape: {
        x: leftPx,
        y: y0Px,
        width: rightPx - leftPx,
        height: y1Px - y0Px,
      },
      style: {
        fill: riskColor(dscr, minDscr, isDark),
        opacity: riskOpacity(dscr, minDscr),
      },
      z2: -1,
    };
  };
}

// ── Tooltip builders ───────────────────────────────────────────────────────────

function buildDscrTooltip(
  label: string,
  dscrMap: PercentileMap,
  minDscr: number,
  extra?: string
): string {
  const pass = dscrMap.P10 >= minDscr;
  const keys: PercentileKey[] = ["P10", "P25", "P50", "P75", "P90"];
  const lines = keys.map(
    (k) => `${k}: ${fmtDscr(dscrMap[k])} ${dscrMark(dscrMap[k], minDscr)}`
  );
  return (
    `<b>${label}</b><br/>` +
    lines.join("<br/>") +
    (extra ? `<br/>${extra}` : "") +
    `<br/>Covenant (${minDscr.toFixed(2)}x): <b>${pass ? "PASS" : "BREACH"}</b>`
  );
}

// ── Band series builder ────────────────────────────────────────────────────────
// Returns the 8 series for outer (P10-P90) and inner (P25-P75) bands

function buildBandSeries(
  cfadsP10: number[],
  cfadsP25: number[],
  cfadsP75: number[],
  cfadsP90: number[],
  palette: ChartPalette,
  smooth: number | false
) {
  const deltaOuter = cfadsP90.map((v, i) => v - cfadsP10[i]);
  const deltaInner = cfadsP75.map((v, i) => v - cfadsP25[i]);

  return [
    // Outer band fill (P10-P90)
    {
      type: "line" as const,
      data: cfadsP10,
      stack: "band-outer",
      areaStyle: { opacity: 0 },
      lineStyle: { opacity: 0 },
      symbol: "none",
      silent: true,
      z: 1,
    },
    {
      type: "line" as const,
      name: "CFADS P10–P90",
      data: deltaOuter,
      stack: "band-outer",
      areaStyle: { color: palette.accentFill10 },
      lineStyle: { opacity: 0 },
      symbol: "none",
      silent: true,
      smooth,
      z: 1,
    },
    // Inner band fill (P25-P75)
    {
      type: "line" as const,
      data: cfadsP25,
      stack: "band-inner",
      areaStyle: { opacity: 0 },
      lineStyle: { opacity: 0 },
      symbol: "none",
      silent: true,
      z: 2,
    },
    {
      type: "line" as const,
      name: "CFADS IQR",
      data: deltaInner,
      stack: "band-inner",
      areaStyle: { color: palette.accentFill22 },
      lineStyle: { opacity: 0 },
      symbol: "none",
      silent: true,
      smooth,
      z: 2,
    },
    // Dashed border lines at actual percentile positions
    {
      type: "line" as const,
      data: cfadsP10,
      lineStyle: { width: 1, type: "dashed" as const, color: palette.mutedLine },
      symbol: "none",
      silent: true,
      smooth,
      z: 3,
    },
    {
      type: "line" as const,
      data: cfadsP90,
      lineStyle: { width: 1, type: "dashed" as const, color: palette.mutedLine },
      symbol: "none",
      silent: true,
      smooth,
      z: 3,
    },
    {
      type: "line" as const,
      data: cfadsP25,
      lineStyle: { width: 1, type: "dashed" as const, color: palette.mutedLine },
      symbol: "none",
      silent: true,
      smooth,
      z: 3,
    },
    {
      type: "line" as const,
      data: cfadsP75,
      lineStyle: { width: 1, type: "dashed" as const, color: palette.mutedLine },
      symbol: "none",
      silent: true,
      smooth,
      z: 3,
    },
  ];
}

// ── Quarterly option builder (shared by lifecycle and 3-year) ──────────────────

function buildQuarterlyOption(
  data: QuarterlyPoint[],
  minDscr: number,
  palette: ChartPalette,
  isDark: boolean,
  xTitle: string
): EChartsOption {
  const cfadsP10 = data.map((p) => toM(p.cfads.P10));
  const cfadsP25 = data.map((p) => toM(p.cfads.P25));
  const cfadsP50 = data.map((p) => toM(p.cfads.P50));
  const cfadsP75 = data.map((p) => toM(p.cfads.P75));
  const cfadsP90 = data.map((p) => toM(p.cfads.P90));
  const dsArr = data.map((p) => toM(p.debtService));

  // Heatmap data: 5 bands per quarter
  const heatmapData = data.flatMap((p, i) =>
    RISK_BANDS.map((band) => [i, band.y0, band.y1, p.ltmDscr[band.key]])
  );

  // X-axis labels: show calendar year ('26, '27, ...) only at Q1
  const xLabels = data.map((p) =>
    p.quarter === 1 ? `'${String(p.calYear).slice(-2)}` : ""
  );

  const smooth = 0.4;

  return {
    backgroundColor: palette.plotBg,
    animation: true,
    animationDuration: 300,
    grid: baseGrid(),
    xAxis: {
      type: "category",
      data: data.map((_, i) => i),
      axisLabel: {
        formatter: (_: string, idx: number) => xLabels[idx] || "",
        color: palette.axisColor,
        fontSize: 10,
        fontFamily: FONT_FAMILY,
      },
      axisLine: { lineStyle: { color: palette.gridColor } },
      axisTick: { alignWithLabel: true },
      splitLine: { show: false },
      name: xTitle,
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: palette.axisColor, fontSize: 11, fontFamily: FONT_FAMILY },
    },
    yAxis: baseYAxis(palette),
    tooltip: {
      ...baseTooltip(palette),
      formatter: (params: unknown) => {
        const idx = axisIdx(params);
        const p = data[idx];
        if (!p) return "";

        const cfadsLine = `CFADS P50: $${toM(p.cfads.P50).toFixed(2)}M · Range: $${toM(p.cfads.P10).toFixed(2)}M–$${toM(p.cfads.P90).toFixed(2)}M`;
        const dsLine = `DS: $${toM(p.debtService).toFixed(2)}M`;

        // Build detailed tooltip label: "Q2 2026 (Apr–Jun)"
        const qMonthNames = [
          ["Jan", "Mar"], ["Apr", "Jun"], ["Jul", "Sep"], ["Oct", "Dec"],
        ];
        const [qStart, qEnd] = qMonthNames[p.quarter - 1];
        const tooltipLabel = `Q${p.quarter} ${p.calYear} (${qStart}–${qEnd}) — LTM DSCR`;

        return buildDscrTooltip(
          tooltipLabel,
          p.ltmDscr,
          minDscr,
          `${cfadsLine}<br/>${dsLine}`
        );
      },
    },
    legend: baseLegend(palette),
    series: [
      // Heatmap background
      {
        type: "custom",
        renderItem: makeHeatmapRenderItem(minDscr, isDark, data.length),
        data: heatmapData,
        silent: true,
        z: 0,
        encode: { x: 0 },
        tooltip: { show: false },
      },
      // Band fills + borders
      ...buildBandSeries(cfadsP10, cfadsP25, cfadsP75, cfadsP90, palette, smooth),
      // P50 median
      {
        type: "line",
        name: "CFADS P50",
        data: cfadsP50,
        lineStyle: { width: 2.5, color: palette.accent },
        itemStyle: { color: palette.accent },
        smooth,
        symbol: "circle",
        symbolSize: 4,
        z: 5,
      },
      // Debt Service
      {
        type: "line",
        name: "Debt Service",
        data: dsArr,
        lineStyle: { width: 2.2, color: palette.warningColor },
        itemStyle: { color: palette.warningColor },
        smooth: false,
        symbol: "diamond",
        symbolSize: 4,
        z: 5,
      },
    ],
  };
}

// ── Public: Lifecycle option (all 72 quarters) ─────────────────────────────────

export function buildLifecycleOption(
  quarterlyData: QuarterlyPoint[],
  minDscr: number,
  palette: ChartPalette,
  isDark: boolean
): EChartsOption {
  return buildQuarterlyOption(
    quarterlyData,
    minDscr,
    palette,
    isDark,
    "Quarter (project lifecycle)"
  );
}

// ── Public: 3-Year option (first 12 quarters) ──────────────────────────────────

export function build3YearOption(
  quarterlyData: QuarterlyPoint[],
  minDscr: number,
  palette: ChartPalette,
  isDark: boolean
): EChartsOption {
  return buildQuarterlyOption(
    quarterlyData.slice(0, 12),
    minDscr,
    palette,
    isDark,
    "Quarter (3-year view)"
  );
}

// ── Public: Forward 12M option ─────────────────────────────────────────────────

export function buildForward12MOption(
  monthlyPoints: MonthlyViewPoint[],
  quarterBlocks: ForwardQuarterBlock[],
  minDscr: number,
  palette: ChartPalette,
  isDark: boolean
): EChartsOption {
  const cfadsP10 = monthlyPoints.map((p) => toM(p.cfads.P10));
  const cfadsP25 = monthlyPoints.map((p) => toM(p.cfads.P25));
  const cfadsP50 = monthlyPoints.map((p) => toM(p.cfads.P50));
  const cfadsP75 = monthlyPoints.map((p) => toM(p.cfads.P75));
  const cfadsP90 = monthlyPoints.map((p) => toM(p.cfads.P90));
  const dsArr = monthlyPoints.map((p) => toM(p.debtService));

  // Monthly heatmap: each quarter block spans multiple x positions
  // Data: [startPos, endPos, bandY0, bandY1, dscrValue] — raw month indices (inclusive)
  const heatmapData = quarterBlocks.flatMap((block) =>
    RISK_BANDS.map((band) => [
      block.startPos,
      block.endPos,
      band.y0,
      band.y1,
      block.dscr[band.key],
    ])
  );

  const smooth = 0.4;

  // Explicit y-axis max: prevent heatmap data dimensions (block positions)
  // from inflating the auto-scale. Use CFADS P90 + DS with 15% headroom.
  const yMax = Math.ceil(Math.max(...cfadsP90, ...dsArr) * 11.5) / 10;

  return {
    backgroundColor: palette.plotBg,
    animation: true,
    animationDuration: 300,
    grid: baseGrid(),
    xAxis: {
      type: "category",
      data: monthlyPoints.map((_, i) => i),
      axisLabel: {
        formatter: (_: string, idx: number) => monthlyPoints[idx]?.monthName || "",
        color: palette.axisColor,
        fontSize: 10,
        fontFamily: FONT_FAMILY,
      },
      axisLine: { lineStyle: { color: palette.gridColor } },
      axisTick: { alignWithLabel: true },
      splitLine: { show: false },
      name: "Forward 12 Months (monthly)",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: palette.axisColor, fontSize: 11, fontFamily: FONT_FAMILY },
    },
    yAxis: { ...baseYAxis(palette), max: yMax },
    tooltip: {
      ...baseTooltip(palette),
      formatter: (params: unknown) => {
        const idx = axisIdx(params);
        const mp = monthlyPoints[idx];
        if (!mp) return "";

        // Find which quarter block this month belongs to
        const block = quarterBlocks.find(
          (b) => idx >= b.startPos && idx <= b.endPos
        );

        // Build month label with year context
        const monthYear = block
          ? `${mp.monthName} ${block.calYear}`
          : mp.monthName;

        let html =
          `<b>${monthYear}</b><br/>` +
          `Rev P50: $${toM(mp.revenue.P50).toFixed(2)}M<br/>` +
          `CFADS P50: $${toM(mp.cfads.P50).toFixed(2)}M<br/>` +
          `Range: $${toM(mp.cfads.P10).toFixed(2)}M–$${toM(mp.cfads.P90).toFixed(2)}M<br/>` +
          `Monthly DS: $${toM(mp.debtService).toFixed(2)}M`;

        if (block) {
          // Build descriptive quarter label: "Q2 2026 (Apr–Jun)" or "Q1 2026 (Mar only)"
          const qMonthNames = [
            ["Jan", "Mar"], ["Apr", "Jun"], ["Jul", "Sep"], ["Oct", "Dec"],
          ];
          const [qStart, qEnd] = qMonthNames[block.calQuarter - 1];
          const partialNote = block.monthCount < 3
            ? ` — ${block.monthCount}mo partial`
            : "";
          const blockLabel = `Q${block.calQuarter} ${block.calYear} (${qStart}–${qEnd})${partialNote}`;

          html +=
            "<br/><br/>" +
            buildDscrTooltip(
              `${blockLabel} — Quarterly DSCR`,
              block.dscr,
              minDscr
            );
        }

        return html;
      },
    },
    legend: {
      ...baseLegend(palette),
      data: ["CFADS P10–P90", "CFADS IQR", "CFADS P50", "Monthly DS (Y1)"],
    },
    series: [
      // Heatmap background (monthly variant)
      {
        type: "custom",
        renderItem: makeMonthlyHeatmapRenderItem(minDscr, isDark, monthlyPoints.length),
        data: heatmapData,
        silent: true,
        z: 0,
        encode: { x: 0 },
        tooltip: { show: false },
      },
      // Band fills + borders
      ...buildBandSeries(cfadsP10, cfadsP25, cfadsP75, cfadsP90, palette, smooth),
      // P50 median
      {
        type: "line",
        name: "CFADS P50",
        data: cfadsP50,
        lineStyle: { width: 2.5, color: palette.accent },
        itemStyle: { color: palette.accent },
        smooth,
        symbol: "none",
        z: 5,
      },
      // Monthly Debt Service
      {
        type: "line",
        name: "Monthly DS (Y1)",
        data: dsArr,
        lineStyle: { width: 2.2, color: palette.warningColor },
        itemStyle: { color: palette.warningColor },
        smooth: false,
        symbol: "none",
        z: 5,
      },
    ],
  };
}

// ── Public: Annual fallback ────────────────────────────────────────────────────

export function buildAnnualFallbackOption(
  dscrTable: DscrRow[],
  loanSchedule: LoanScheduleRow[],
  pctCfads: PercentileMap,
  annualOpex: number,
  minDscr: number,
  palette: ChartPalette,
  isDark: boolean,
  startYear: number = 2026
): EChartsOption {
  const years = dscrTable.map((r) => r.year);

  const cfadsP10 = years.map(() => toM(pctCfads.P10));
  const cfadsP25 = years.map(() => toM(pctCfads.P25));
  const cfadsP50 = years.map(() => toM(pctCfads.P50));
  const cfadsP75 = years.map(() => toM(pctCfads.P75));
  const cfadsP90 = years.map(() => toM(pctCfads.P90));
  const dsArr = loanSchedule.map((r) => toM(r.debtService));

  // Heatmap data: 5 bands per year
  const heatmapData = dscrTable.flatMap((row, i) =>
    RISK_BANDS.map((band) => [i, band.y0, band.y1, row.dscr[band.key]])
  );

  return {
    backgroundColor: palette.plotBg,
    animation: true,
    animationDuration: 300,
    grid: baseGrid(),
    xAxis: {
      type: "category",
      data: years.map((y) => `'${String(startYear + y - 1).slice(-2)}`),
      axisLabel: {
        interval: 1, // show every other year
        color: palette.axisColor,
        fontSize: 10,
        fontFamily: FONT_FAMILY,
      },
      axisLine: { lineStyle: { color: palette.gridColor } },
      axisTick: { alignWithLabel: true },
      splitLine: { show: false },
      name: "Year (annual)",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: palette.axisColor, fontSize: 11, fontFamily: FONT_FAMILY },
    },
    yAxis: baseYAxis(palette),
    tooltip: {
      ...baseTooltip(palette),
      formatter: (params: unknown) => {
        const idx = axisIdx(params);
        const row = dscrTable[idx];
        if (!row) return "";

        const cfadsLine = `Revenue P50: ${fmtMillion(pctCfads.P50 + annualOpex)} · OpEx: ${fmtMillion(annualOpex)}`;
        const dsLine = `DS: ${fmtMillion(row.debtService)} · CFADS P50: ${fmtMillion(row.cfads.P50)}`;

        const calYear = startYear + row.year - 1;
        return buildDscrTooltip(
          `${calYear} (Year ${row.year}) — Annual DSCR`,
          row.dscr,
          minDscr,
          `${cfadsLine}<br/>${dsLine}`
        );
      },
    },
    legend: baseLegend(palette),
    series: [
      // Heatmap
      {
        type: "custom",
        renderItem: makeHeatmapRenderItem(minDscr, isDark, years.length),
        data: heatmapData,
        silent: true,
        z: 0,
        encode: { x: 0 },
        tooltip: { show: false },
      },
      // Band fills + borders (no smoothing for annual)
      ...buildBandSeries(cfadsP10, cfadsP25, cfadsP75, cfadsP90, palette, false),
      // P50
      {
        type: "line",
        name: "CFADS P50",
        data: cfadsP50,
        lineStyle: { width: 2.5, color: palette.accent },
        itemStyle: { color: palette.accent },
        smooth: false,
        symbol: "circle",
        symbolSize: 5,
        z: 5,
      },
      // Debt Service
      {
        type: "line",
        name: "Debt Service",
        data: dsArr,
        lineStyle: { width: 2.2, color: palette.warningColor },
        itemStyle: { color: palette.warningColor },
        smooth: false,
        symbol: "diamond",
        symbolSize: 5,
        z: 5,
      },
    ],
  };
}
