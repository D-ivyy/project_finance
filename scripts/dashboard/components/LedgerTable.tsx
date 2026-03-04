"use client";

import React, { useState, useCallback } from "react";
import { Download, FileText, ChevronDown, ChevronRight } from "lucide-react";
import type {
  DscrRow,
  LoanScheduleRow,
  PercentileMap,
  PercentileKey,
  QuarterlyPoint,
  LoanConfig,
  ComputedFinancials,
} from "@/types";
import { fmtMillion, fmtDscr } from "@/lib/api";
import { generateYearCsv, generateFullReportCsv, downloadCsv } from "@/lib/export";

interface LedgerTableProps {
  dscrTable: DscrRow[];
  loanSchedule: LoanScheduleRow[];
  pctRevenue: PercentileMap;
  pctCfads: PercentileMap;
  annualOpex: number;
  minDscr: number;
  selectedPercentile: PercentileKey;
  quarterlyData?: QuarterlyPoint[];
  siteName: string;
  assetType: string;
  loanConfig: LoanConfig;
  computed: ComputedFinancials;
}

// ── DSCR cell coloring ────────────────────────────────────────────────────────

function getDscrStyle(dscr: number, minDscr: number): { bg: string; color: string } {
  if (dscr < minDscr) {
    return { bg: "var(--cov-red)", color: "var(--cov-red-text)" };
  }
  if (dscr < minDscr + 0.25) {
    return { bg: "var(--cov-amber)", color: "var(--cov-amber-text)" };
  }
  if (dscr < minDscr + 0.75) {
    return { bg: "var(--cov-light-green)", color: "var(--cov-light-green-text)" };
  }
  return { bg: "var(--cov-deep-green)", color: "var(--cov-deep-green-text)" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`
        px-3 py-2 text-[10px] font-semibold uppercase tracking-wider
        text-[var(--color-text-muted)]
        bg-[var(--color-bg)]
        border-b border-[var(--color-border)]
        whitespace-nowrap min-w-[5rem]
        ${right ? "text-right" : "text-left"}
      `}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right = false,
  muted = false,
}: {
  children: React.ReactNode;
  right?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`
        px-3 py-1.5 text-[11px] font-mono
        border-b border-[var(--color-border-subtle)]
        whitespace-nowrap min-w-[5rem]
        ${right ? "text-right" : "text-left"}
        ${muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]"}
      `}
    >
      {children}
    </td>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LedgerTable({
  dscrTable,
  loanSchedule,
  pctRevenue,
  pctCfads,
  annualOpex,
  minDscr,
  selectedPercentile,
  quarterlyData,
  siteName,
  assetType,
  loanConfig,
  computed,
}: LedgerTableProps) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  const toggleYear = useCallback((year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }, []);

  const handleYearExport = useCallback(
    (year: number) => {
      const i = year - 1;
      const dscrRow = dscrTable[i];
      const loanRow = loanSchedule[i];
      if (!dscrRow || !loanRow) return;
      const csv = generateYearCsv(
        year, dscrRow, loanRow, pctRevenue, pctCfads,
        annualOpex, minDscr, selectedPercentile, quarterlyData
      );
      downloadCsv(csv, `${siteName}_year${year}_detail.csv`);
    },
    [dscrTable, loanSchedule, pctRevenue, pctCfads, annualOpex, minDscr, selectedPercentile, quarterlyData, siteName]
  );

  const handleFullReport = useCallback(() => {
    const csv = generateFullReportCsv(siteName, assetType, loanConfig, computed, selectedPercentile);
    downloadCsv(csv, `${siteName}_full_report.csv`);
  }, [siteName, assetType, loanConfig, computed, selectedPercentile]);

  if (dscrTable.length === 0 || loanSchedule.length === 0) {
    return (
      <div className="text-xs text-[var(--color-text-muted)] px-2 py-4">
        No data to display.
      </div>
    );
  }

  const revenue = pctRevenue[selectedPercentile];
  const cfads = pctCfads[selectedPercentile];
  const colCount = 10;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10">
          <tr>
            <Th>Year</Th>
            <Th right>Revenue ({selectedPercentile})</Th>
            <Th right>OpEx</Th>
            <Th right>CFADS</Th>
            <Th right>Debt Service</Th>
            <Th right>Interest</Th>
            <Th right>Principal</Th>
            <Th right>Balance</Th>
            <Th right>Min DSCR</Th>
            <Th right>Export</Th>
          </tr>
        </thead>
        <tbody>
          {dscrTable.map((row, i) => {
            const ls = loanSchedule[i];
            if (!ls) return null;
            const p10Dscr = row.dscr.P10;
            const style = getDscrStyle(p10Dscr, minDscr);
            const isExpanded = expandedYears.has(row.year);

            return (
              <React.Fragment key={row.year}>
                {/* Main row */}
                <tr className="hover:bg-[var(--color-surface-hover)] transition-colors">
                  <Td muted>{row.year}</Td>
                  <Td right>{fmtMillion(revenue)}</Td>
                  <Td right muted>{fmtMillion(annualOpex)}</Td>
                  <Td right>{fmtMillion(cfads)}</Td>
                  <Td right>{fmtMillion(ls.debtService)}</Td>
                  <Td right muted>{fmtMillion(ls.interest)}</Td>
                  <Td right muted>{fmtMillion(ls.principal)}</Td>
                  <Td right muted>{fmtMillion(ls.closingBalance)}</Td>

                  {/* Min DSCR (P10) — clickable to expand */}
                  <td
                    className="px-3 py-1.5 text-[11px] font-mono text-right whitespace-nowrap border-b border-[var(--color-border-subtle)] font-semibold cursor-pointer select-none min-w-[5rem]"
                    style={{ background: style.bg, color: style.color }}
                    onClick={() => toggleYear(row.year)}
                    title="Click to expand DSCR detail"
                  >
                    <span className="inline-flex items-center gap-1">
                      {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      {fmtDscr(p10Dscr)}
                    </span>
                  </td>

                  {/* Export button */}
                  <td className="px-3 py-1.5 text-center border-b border-[var(--color-border-subtle)]">
                    <button
                      onClick={() => handleYearExport(row.year)}
                      title={`Download Year ${row.year} detail CSV`}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      <Download size={13} />
                    </button>
                  </td>
                </tr>

                {/* Expandable DSCR detail row */}
                {isExpanded && (
                  <tr className="bg-[var(--color-bg)]">
                    <td colSpan={colCount} className="px-5 py-2.5 border-b border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-4 text-[11px] font-mono">
                        {(["P10", "P25", "P50", "P75", "P90"] as PercentileKey[]).map((k) => {
                          const d = row.dscr[k];
                          const s = getDscrStyle(d, minDscr);
                          return (
                            <span key={k} className="flex items-center gap-1.5">
                              <span className="text-[var(--color-text-muted)] text-[10px]">{k}:</span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[11px] font-semibold"
                                style={{ background: s.bg, color: s.color }}
                              >
                                {fmtDscr(d)}
                              </span>
                            </span>
                          );
                        })}
                        <span className="ml-2 text-[10px]">
                          Covenant ({fmtDscr(minDscr)}):{" "}
                          <span
                            className="font-semibold"
                            style={{
                              color: p10Dscr >= minDscr
                                ? "var(--cov-deep-green-text)"
                                : "var(--cov-red-text)",
                            }}
                          >
                            {p10Dscr >= minDscr ? "PASS" : "BREACH"}
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>

        {/* Summary + full report */}
        <tfoot>
          <tr className="border-t-2 border-[var(--color-border)]">
            <td
              colSpan={4}
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
            >
              Summary
            </td>
            <Td right>
              {fmtMillion(loanSchedule.reduce((s, r) => s + r.debtService, 0))}
            </Td>
            <Td right muted>
              {fmtMillion(loanSchedule.reduce((s, r) => s + r.interest, 0))}
            </Td>
            <Td right muted>
              {fmtMillion(loanSchedule.reduce((s, r) => s + r.principal, 0))}
            </Td>
            <Td right muted>
              {fmtMillion(loanSchedule[loanSchedule.length - 1]?.closingBalance ?? 0)}
            </Td>
            {/* Min DSCR across all years */}
            {(() => {
              const minP10 = Math.min(...dscrTable.map((r) => r.dscr.P10));
              const s = getDscrStyle(minP10, minDscr);
              return (
                <td
                  className="px-3 py-1.5 text-[11px] font-mono text-right whitespace-nowrap font-semibold"
                  style={{ background: s.bg, color: s.color }}
                >
                  {fmtDscr(minP10)}
                </td>
              );
            })()}
            {/* Full report download */}
            <td className="px-3 py-1.5 text-center">
              <button
                onClick={handleFullReport}
                title="Download full project report CSV"
                className="
                  inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                  bg-[var(--color-accent-subtle)] text-[var(--color-accent)]
                  border border-[var(--color-accent)]/30
                  hover:bg-[var(--color-accent)] hover:text-white
                  transition-colors
                "
              >
                <FileText size={11} />
                Report
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
