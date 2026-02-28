"use client";

import { useState } from "react";
import type { ComputedFinancials, PercentileKey } from "@/types";
import { fmtDscr, fmtMillion } from "@/lib/api";

interface CovenantScorecardProps {
  data: ComputedFinancials;
}

function getDscrStyle(dscr: number, minDscr: number) {
  if (dscr < minDscr) {
    return {
      bg: "var(--cov-red)",
      color: "var(--cov-red-text)",
    };
  } else if (dscr < minDscr + 0.25) {
    return {
      bg: "var(--cov-amber)",
      color: "var(--cov-amber-text)",
    };
  } else if (dscr < minDscr + 0.75) {
    return {
      bg: "var(--cov-light-green)",
      color: "var(--cov-light-green-text)",
    };
  }
  return {
    bg: "var(--cov-deep-green)",
    color: "var(--cov-deep-green-text)",
  };
}

interface CellTooltip {
  year: number;
  pct: PercentileKey;
  dscr: number;
  cfads: number;
  ds: number;
  revenue: number;
  opex: number;
}

export function CovenantScorecard({ data }: CovenantScorecardProps) {
  const { dscrTable, minDscr, pctRevenue, annualOpex, loanSchedule, pctCfads } = data;
  const [hoveredCell, setHoveredCell] = useState<CellTooltip | null>(null);

  const percentiles: PercentileKey[] = ["P10", "P50", "P90"];

  return (
    <aside
      className="
        w-52 shrink-0 flex flex-col gap-3
        bg-[var(--color-surface)]
        border-l border-[var(--color-border)]
        h-full overflow-y-auto sidebar-scroll
        px-3 py-3
      "
    >
      {/* Covenant Matrix */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Covenant Matrix
        </div>
        <div className="border border-[var(--color-border)] rounded overflow-hidden text-xs font-mono">
          {/* Header */}
          <div
            className="grid bg-[var(--color-bg)] border-b border-[var(--color-border)]"
            style={{ gridTemplateColumns: "2rem repeat(3, 1fr)" }}
          >
            <div className="px-1.5 py-1 text-[var(--color-text-muted)]">Yr</div>
            {percentiles.map((p) => (
              <div key={p} className="px-1 py-1 text-center text-[var(--color-text-secondary)]">
                {p}
              </div>
            ))}
          </div>
          {/* Rows — show every 3 years to save space */}
          {dscrTable
            .filter((r) => r.year === 1 || r.year % 3 === 0 || r.year === dscrTable.length)
            .map((row) => {
              const lsRow = loanSchedule[row.year - 1];
              return (
                <div
                  key={row.year}
                  className="grid border-b border-[var(--color-border)] last:border-b-0"
                  style={{ gridTemplateColumns: "2rem repeat(3, 1fr)" }}
                >
                  <div className="px-1.5 py-1 text-[var(--color-text-muted)]">
                    {row.year}
                  </div>
                  {percentiles.map((p) => {
                    const dscr = row.dscr[p];
                    const style = getDscrStyle(dscr, minDscr);
                    return (
                      <div
                        key={p}
                        className="px-1 py-1 text-center cursor-default relative"
                        style={{ background: style.bg, color: style.color }}
                        onMouseEnter={() =>
                          setHoveredCell({
                            year: row.year,
                            pct: p,
                            dscr,
                            cfads: row.cfads[p],
                            ds: row.debtService,
                            revenue: pctRevenue[p],
                            opex: annualOpex,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`Year ${row.year} ${p}: ${fmtDscr(dscr)}`}
                      >
                        {dscr.toFixed(2)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>
        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
          ✓ = DSCR ≥ {minDscr.toFixed(2)}x · Red = breach
        </div>
      </div>

      {/* Hovered cell detail */}
      {hoveredCell && (
        <div className="tooltip-card text-xs space-y-0.5 pointer-events-none">
          <div className="font-semibold text-[var(--color-text)]">
            Year {hoveredCell.year} · {hoveredCell.pct}
          </div>
          <div>Revenue: {fmtMillion(hoveredCell.revenue)}</div>
          <div>OpEx: {fmtMillion(hoveredCell.opex)}</div>
          <div>CFADS: {fmtMillion(hoveredCell.cfads)}</div>
          <div>Debt Service: {fmtMillion(hoveredCell.ds)}</div>
          <div className="font-semibold pt-0.5">
            DSCR: {fmtDscr(hoveredCell.dscr)}
          </div>
        </div>
      )}

      {/* P-value Reference */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Revenue (hub/da)
        </div>
        <table className="w-full text-xs font-mono">
          <tbody>
            {(["P10", "P25", "P50", "P75", "P90"] as PercentileKey[]).map((p) => (
              <tr key={p} className="border-b border-[var(--color-border-subtle)] last:border-0">
                <td className="py-0.5 text-[var(--color-text-secondary)]">{p}</td>
                <td className="py-0.5 text-right text-[var(--color-text)]">
                  {fmtMillion(pctRevenue[p])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CFADS Reference */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          CFADS
        </div>
        <table className="w-full text-xs font-mono">
          <tbody>
            {(["P10", "P25", "P50", "P75", "P90"] as PercentileKey[]).map((p) => (
              <tr key={p} className="border-b border-[var(--color-border-subtle)] last:border-0">
                <td className="py-0.5 text-[var(--color-text-secondary)]">{p}</td>
                <td className="py-0.5 text-right text-[var(--color-text)]">
                  {fmtMillion(pctCfads[p])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Debt Service Reference */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Debt Service
        </div>
        <table className="w-full text-xs font-mono">
          <tbody>
            {loanSchedule.length > 0 && (
              <>
                <tr className="border-b border-[var(--color-border-subtle)]">
                  <td className="py-0.5 text-[var(--color-text-secondary)]">Yr 1</td>
                  <td className="py-0.5 text-right text-[var(--color-text)]">
                    {fmtMillion(loanSchedule[0].debtService)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 text-[var(--color-text-secondary)]">
                    Yr {loanSchedule[loanSchedule.length - 1].year}
                  </td>
                  <td className="py-0.5 text-right text-[var(--color-text)]">
                    {fmtMillion(loanSchedule[loanSchedule.length - 1].debtService)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="h-4" />
    </aside>
  );
}
