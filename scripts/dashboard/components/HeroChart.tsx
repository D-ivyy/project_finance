"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState, Fragment } from "react";
import { ChevronRight } from "lucide-react";
import * as echarts from "echarts/core";
import { LineChart, CustomChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ECharts } from "echarts/core";

import type {
  DscrRow,
  LoanScheduleRow,
  PercentileMap,
  QuarterlyPoint,
  MonthlyViewPoint,
  ForwardQuarterBlock,
} from "@/types";
import { getChartPalette } from "@/lib/echarts-theme";
import {
  buildLifecycleOption,
  build3YearOption,
  buildForward12MOption,
  buildAnnualFallbackOption,
} from "@/lib/hero-chart-options";

// Register ECharts modules (tree-shaken)
echarts.use([
  LineChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

// ── Types ──────────────────────────────────────────────────────────────────────

interface HeroChartProps {
  dscrTable: DscrRow[];
  loanSchedule: LoanScheduleRow[];
  pctCfads: PercentileMap;
  annualOpex: number;
  minDscr: number;
  quarterlyData?: QuarterlyPoint[];
  monthlyViewData?: {
    monthlyPoints: MonthlyViewPoint[];
    quarterBlocks: ForwardQuarterBlock[];
  } | null;
  forecastStartMonth?: number;
  forecastStartYear?: number;
}

type ViewMode = "lifecycle" | "3year" | "forward12m";

const VIEW_BUTTONS: {
  key: ViewMode;
  label: string;
}[] = [
  { key: "forward12m", label: "Forward 12M" },
  { key: "3year", label: "3-Year" },
  { key: "lifecycle", label: "Project Lifecycle" },
];

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ── Component ──────────────────────────────────────────────────────────────────

export function HeroChart({
  dscrTable,
  loanSchedule,
  pctCfads,
  annualOpex,
  minDscr,
  quarterlyData,
  monthlyViewData,
  forecastStartMonth = 1,
  forecastStartYear = new Date().getFullYear(),
}: HeroChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<ECharts | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("forward12m");

  // ── Initialize ECharts instance ────────────────────────────────────────────

  useEffect(() => {
    setMounted(true);
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current, undefined, {
      renderer: "canvas",
    });
    echartsRef.current = chart;

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      echartsRef.current = null;
    };
  }, []);

  // ── Determine active view mode ─────────────────────────────────────────────

  const canShow12m = !!(
    monthlyViewData && monthlyViewData.monthlyPoints.length === 12
  );
  const canShow3y = !!(quarterlyData && quarterlyData.length >= 12);

  let activeMode: ViewMode = viewMode;
  if (viewMode === "forward12m" && !canShow12m) activeMode = "lifecycle";
  if (viewMode === "3year" && !canShow3y) activeMode = "lifecycle";

  const useQuarterly =
    activeMode === "lifecycle" && quarterlyData && quarterlyData.length > 0;

  // ── Update chart option ────────────────────────────────────────────────────

  useEffect(() => {
    if (!echartsRef.current || !mounted || dscrTable.length === 0) return;

    const isDark = resolvedTheme === "dark";
    const palette = getChartPalette(isDark);

    let option;
    if (activeMode === "forward12m" && canShow12m) {
      option = buildForward12MOption(
        monthlyViewData!.monthlyPoints,
        monthlyViewData!.quarterBlocks,
        minDscr,
        palette,
        isDark
      );
    } else if (activeMode === "3year" && canShow3y) {
      option = build3YearOption(quarterlyData!, minDscr, palette, isDark);
    } else if (useQuarterly) {
      option = buildLifecycleOption(quarterlyData!, minDscr, palette, isDark);
    } else {
      option = buildAnnualFallbackOption(
        dscrTable,
        loanSchedule,
        pctCfads,
        annualOpex,
        minDscr,
        palette,
        isDark,
        forecastStartYear
      );
    }

    echartsRef.current.setOption(option, { notMerge: true });
  }, [
    activeMode,
    resolvedTheme,
    mounted,
    quarterlyData,
    monthlyViewData,
    dscrTable,
    loanSchedule,
    pctCfads,
    annualOpex,
    minDscr,
    canShow12m,
    canShow3y,
    useQuarterly,
    forecastStartYear,
  ]);

  // ── Helper text ────────────────────────────────────────────────────────────

  const isLoading = !mounted || dscrTable.length === 0;

  const startLabel = MONTH_NAMES_SHORT[forecastStartMonth - 1];
  const yr2 = String(forecastStartYear).slice(-2);
  let helperText: string;
  if (activeMode === "forward12m") {
    helperText = `${startLabel} '${yr2} → +12 months · calendar quarter DSCR heatmap · hover for detail`;
  } else if (activeMode === "3year") {
    helperText = `Quarterly CFADS · LTM DSCR heatmap · '${yr2}–'${String(forecastStartYear + 2).slice(-2)}`;
  } else if (useQuarterly) {
    helperText = `Quarterly CFADS · LTM DSCR heatmap · '${yr2}–'${String(forecastStartYear + loanSchedule.length - 1).slice(-2)}`;
  } else {
    helperText = `Annual CFADS · DSCR risk · '${yr2}–'${String(forecastStartYear + dscrTable.length - 1).slice(-2)}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  // Always render the chart <div> so chartRef is available when the init
  // useEffect fires on first mount.  Loading state is an overlay on top.

  return (
    <div className="w-full">
      {/* View toggle + scenario placeholder */}
      {!isLoading && (
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            {/* 3-view toggle with navigation arrows */}
            <div className="flex items-center rounded overflow-hidden border border-[var(--color-border)] text-[10px] font-semibold">
              {VIEW_BUTTONS.map(({ key, label }, i) => {
                const enabled =
                  key === "lifecycle" ||
                  (key === "3year" && canShow3y) ||
                  (key === "forward12m" && canShow12m);

                const nextBtn = VIEW_BUTTONS[i + 1];
                const nextEnabled = nextBtn
                  ? nextBtn.key === "lifecycle" ||
                    (nextBtn.key === "3year" && canShow3y) ||
                    (nextBtn.key === "forward12m" && canShow12m)
                  : false;

                return (
                  <Fragment key={key}>
                    <button
                      onClick={() => setViewMode(key)}
                      disabled={!enabled}
                      className={`px-3 py-1 transition-colors ${
                        activeMode === key
                          ? "bg-[var(--color-accent)] text-white"
                          : enabled
                            ? "bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                            : "bg-transparent text-[var(--color-border)] cursor-not-allowed"
                      }`}
                    >
                      {label}
                    </button>
                    {nextBtn && (
                      <button
                        onClick={() => nextEnabled && setViewMode(nextBtn.key)}
                        disabled={!nextEnabled}
                        className="px-0.5 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={nextEnabled ? `Switch to ${nextBtn.label}` : ""}
                      >
                        <ChevronRight size={10} />
                      </button>
                    )}
                  </Fragment>
                );
              })}
            </div>

            {/* Scenario placeholder (lifecycle only) */}
            {activeMode === "lifecycle" && (
              <div className="flex items-center gap-1.5">
                <select
                  disabled
                  className="text-[10px] px-2 py-1 rounded border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] cursor-not-allowed opacity-50"
                  defaultValue="base"
                >
                  <option value="base">Scenario: Base</option>
                  <option value="ssp245">SSP2-4.5</option>
                  <option value="ssp585">SSP5-8.5</option>
                </select>
                <span
                  className="text-[9px] text-[var(--color-text-muted)] italic"
                  title="Coming soon — requires LTRisk integration"
                >
                  Coming soon
                </span>
              </div>
            )}
          </div>

          <div className="text-[10px] text-[var(--color-text-muted)]">
            {helperText}
          </div>
        </div>
      )}

      {/* Chart container — always rendered so ref is available for echarts.init */}
      <div className="relative" style={{ width: "100%", height: "380px" }}>
        <div
          ref={chartRef}
          style={{ width: "100%", height: "100%" }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] text-sm bg-[var(--color-surface)]">
            Loading chart…
          </div>
        )}
      </div>
    </div>
  );
}
