"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  SiteData, LoanConfig, DisplayConfig, FilterConfig, AssetMeta,
  ComputedFinancials,
} from "@/types";
import { fetchSiteData, fetchSites } from "@/lib/api";
import { computeFinancials } from "@/lib/finance";
import { computeMonthlyStats, computeQuarterlyPercentiles } from "@/lib/stats";
import { validateLoanConfig, validateCrossControls, hasHardError } from "@/lib/validation";

import { Header } from "@/components/Header";
import { KpiCards } from "@/components/KpiCards";
import { HeroChart } from "@/components/HeroChart";
import { LedgerTable } from "@/components/LedgerTable";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { RevenueDistChart } from "@/components/RevenueDistChart";
import { MonthlyChart } from "@/components/MonthlyChart";
import { ConfigSidebar } from "@/components/ConfigSidebar";
import { AssumptionBanner } from "@/components/AssumptionBanner";
import { AlertTriangle, RefreshCw } from "lucide-react";

// ── Default state ──────────────────────────────────────────────────────────────

const DEFAULT_LOAN: LoanConfig = {
  principal: 50_000_000,
  annualRate: 0.06,
  tenorYears: 18,
  amortType: "level_principal",
  targetDscrSculpt: 1.40,
  sculptPercentile: "P50",
};

const DEFAULT_DISPLAY: DisplayConfig = {
  selectedPercentile: "P50",
};

const DEFAULT_FILTER: FilterConfig = {
  kind: "hub",
  market: "da",
};

// ── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`
        rounded-lg border border-[var(--color-border)]
        bg-[var(--color-surface)] p-3
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
      {children}
    </div>
  );
}

// ── Loading overlay ───────────────────────────────────────────────────────────

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-[var(--color-text-secondary)]">
      <RefreshCw size={20} className="animate-spin text-[var(--color-accent)]" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

// ── Validation banner ─────────────────────────────────────────────────────────

function ValidationBanner({
  messages,
}: {
  messages: { severity: string; message: string }[];
}) {
  if (messages.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mb-2">
      {messages.map((m, i) => (
        <div
          key={i}
          className={
            m.severity === "error"
              ? "validation-error"
              : m.severity === "warning"
              ? "validation-warning"
              : "validation-info"
          }
        >
          <AlertTriangle size={11} className="inline mr-1" />
          {m.message}
        </div>
      ))}
    </div>
  );
}

// ── Skeleton placeholder ──────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--color-bg)] ${className}`}
    />
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // ── Site/data state ──────────────────────────────────────────────────────────
  const [sites, setSites] = useState<{ asset_slug: string; asset_type: string; state: string }[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Config state ──────────────────────────────────────────────────────────────
  const [loan, setLoan] = useState<LoanConfig>(DEFAULT_LOAN);
  const [display, setDisplay] = useState<DisplayConfig>(DEFAULT_DISPLAY);
  const [filter, setFilter] = useState<FilterConfig>(DEFAULT_FILTER);
  const [opexOverride, setOpexOverride] = useState<number | null>(null);
  const [minDscrOverride, setMinDscrOverride] = useState<number | null>(null);

  // ── Load sites on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchSites()
      .then((s) => {
        setSites(s);
        if (s.length > 0) setSelectedSite(s[0].asset_slug);
      })
      .catch((e) => {
        console.error("Could not load sites:", e);
        setError(`Could not connect to API: ${e.message}. Is the Python API running on port 8001?`);
        setLoading(false);
      });
  }, []);

  // ── Load site data when site or filter changes ────────────────────────────────
  const loadSiteData = useCallback(
    async (slug: string, kind: string, market: string) => {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSiteData(slug, kind, market);
        setSiteData(data);
        setOpexOverride(null);
        setMinDscrOverride(null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Failed to load data for ${slug}: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedSite) {
      loadSiteData(selectedSite, filter.kind, filter.market);
    }
  }, [selectedSite, filter.kind, filter.market, loadSiteData]);

  // ── Derived: simulated paths only ─────────────────────────────────────────────
  const simulatedRevenue = useMemo(
    () =>
      siteData?.revenue_paths
        .filter((p) => p.segment === "simulated")
        .map((p) => p.annual_revenue_usd) ?? [],
    [siteData]
  );

  // ── Validation ────────────────────────────────────────────────────────────────
  const asset: AssetMeta | null = siteData?.asset ?? null;

  const validationMsgs = useMemo(() => {
    if (!asset) return [];
    return validateLoanConfig(loan, null, opexOverride ?? 0);
  }, [loan, opexOverride, asset]);

  const isBlocked = hasHardError(validationMsgs);

  // ── Quarterly percentiles from monthly data ──────────────────────────────────
  const quarterlyRevPcts = useMemo(
    () => computeQuarterlyPercentiles(siteData?.monthly_paths ?? []),
    [siteData?.monthly_paths]
  );

  // ── Main computation ──────────────────────────────────────────────────────────
  const computed: ComputedFinancials | null = useMemo(() => {
    if (!asset || simulatedRevenue.length === 0 || isBlocked) return null;
    try {
      return computeFinancials(simulatedRevenue, asset, loan, opexOverride, minDscrOverride, quarterlyRevPcts);
    } catch (e) {
      console.error("Computation error:", e);
      return null;
    }
  }, [asset, simulatedRevenue, loan, opexOverride, minDscrOverride, isBlocked, quarterlyRevPcts]);

  // ── Cross-control validation (post-compute) ───────────────────────────────────
  const crossMsgs = useMemo(() => {
    if (!computed) return [];
    return validateCrossControls(
      computed.pctCfads.P10,
      computed.loanSchedule[0]?.debtService ?? 0,
      loan.principal,
      computed.loanSchedule
    );
  }, [computed, loan.principal]);

  const allMsgs = [...validationMsgs, ...crossMsgs];

  // ── Monthly stats ──────────────────────────────────────────────────────────────
  const monthlyStats = useMemo(
    () => computeMonthlyStats(siteData?.monthly_paths ?? []),
    [siteData?.monthly_paths]
  );

  const pathCount = simulatedRevenue.length;

  // ── Error state ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header
          siteName="—"
          assetType="—"
          kind={filter.kind}
          market={filter.market}
          pathCount={0}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-lg text-center space-y-4 p-6">
            <AlertTriangle size={32} className="text-[var(--color-breach)] mx-auto" />
            <div className="text-lg font-semibold text-[var(--color-text)]">
              Could not connect to data API
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] text-left bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)] font-mono">
              {error}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] text-left">
              <strong>To start the API:</strong>
              <pre className="mt-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3 text-xs overflow-auto">
{`cd scripts/api
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--color-bg)]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Header
        siteName={selectedSite || "Loading…"}
        assetType={asset?.asset_type ?? ""}
        kind={filter.kind}
        market={filter.market}
        pathCount={pathCount}
      />

      {/* ── 2-column layout ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left sidebar — unchanged */}
        <ConfigSidebar
          sites={sites}
          selectedSite={selectedSite}
          onSiteChange={setSelectedSite}
          asset={asset}
          filter={filter}
          onFilterChange={setFilter}
          loan={loan}
          onLoanChange={setLoan}
          opexOverride={opexOverride}
          onOpexChange={setOpexOverride}
          minDscrOverride={minDscrOverride}
          onMinDscrChange={setMinDscrOverride}
          display={display}
          onDisplayChange={setDisplay}
          validationErrors={allMsgs
            .filter((m) => m.severity === "error")
            .map((m) => m.message)}
        />

        {/* Main content — full remaining width */}
        <main className="flex-1 min-w-0 overflow-y-auto p-3 space-y-3">
          {loading ? (
            <LoadingOverlay message={`Loading ${selectedSite || "site data"}…`} />
          ) : (
            <>
              {/* Validation banners (warnings + info only; errors go to sidebar) */}
              <ValidationBanner messages={allMsgs.filter((m) => m.severity !== "error")} />

              {/* ── KPI strip (2 cards) ──────────────────────────────────────── */}
              {computed ? (
                <KpiCards data={computed} />
              ) : (
                <div className="flex gap-3">
                  <Skeleton className="flex-1 h-24" />
                  <Skeleton className="flex-1 h-24" />
                </div>
              )}

              {/* ── Hero chart: DSCR band + heatmap background ───────────────── */}
              <Panel>
                <SectionLabel>
                  Cashflow vs Debt Service — {loan.amortType.replace(/_/g, " ")}
                  {loan.amortType === "sculpted"
                    ? ` · sculpt target ${loan.targetDscrSculpt.toFixed(2)}x @ ${loan.sculptPercentile}`
                    : ""}
                </SectionLabel>
                {computed ? (
                  <HeroChart
                    dscrTable={computed.dscrTable}
                    loanSchedule={computed.loanSchedule}
                    pctCfads={computed.pctCfads}
                    annualOpex={computed.annualOpex}
                    minDscr={computed.minDscr}
                    quarterlyData={computed.quarterlyData}
                  />
                ) : (
                  <Skeleton className="h-[380px]" />
                )}
              </Panel>

              {/* ── Ledger table ─────────────────────────────────────────────── */}
              <Panel>
                <SectionLabel>
                  Financial Schedule — {display.selectedPercentile} revenue
                </SectionLabel>
                {computed ? (
                  <LedgerTable
                    dscrTable={computed.dscrTable}
                    loanSchedule={computed.loanSchedule}
                    pctRevenue={computed.pctRevenue}
                    pctCfads={computed.pctCfads}
                    annualOpex={computed.annualOpex}
                    minDscr={computed.minDscr}
                    selectedPercentile={display.selectedPercentile}
                    quarterlyData={computed.quarterlyData}
                    siteName={selectedSite}
                    assetType={asset?.asset_type ?? "unknown"}
                    loanConfig={loan}
                    computed={computed}
                  />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </Panel>

              {/* ── Collapsible extras ───────────────────────────────────────── */}
              <CollapsiblePanel title="Revenue Distribution (simulated paths)">
                {computed ? (
                  <RevenueDistChart
                    revenuePaths={simulatedRevenue}
                    pctRevenue={computed.pctRevenue}
                    annualOpex={computed.annualOpex}
                  />
                ) : (
                  <Skeleton className="h-56" />
                )}
              </CollapsiblePanel>

              <CollapsiblePanel title="Monthly Forecast Distribution (1-year seasonal)">
                <MonthlyChart stats={monthlyStats} />
              </CollapsiblePanel>
            </>
          )}
        </main>
      </div>

      {/* ── Assumption disclosure (unchanged) ──────────────────────────────── */}
      <AssumptionBanner />
    </div>
  );
}
