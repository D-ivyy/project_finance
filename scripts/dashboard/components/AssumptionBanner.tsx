"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const ASSUMPTIONS = [
  { id: "A1", text: "Revenue constant across all years" },
  { id: "A2", text: "No degradation" },
  { id: "A3", text: "No price escalation" },
  { id: "A4", text: "Flat OpEx: zero escalation, no component structure, no inflation (overstates late-year CFADS by ~40% at 2.5%/yr over 18yr)" },
  { id: "A5", text: "Annual covenant test" },
  { id: "A6", text: "Hub/DA only" },
  { id: "A7", text: "No reserves" },
  { id: "A8", text: "Amort type shown in header (lev_pay / lev_prin / sculpted + sculpt target DSCR)" },
  { id: "A9", text: "OpEx is a single deterministic value — no uncertainty distribution, no correlation with revenue or climate risk, no component-level breakdown (understates tail risk)" },
];

export function AssumptionBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="
        border-t border-[var(--color-border)]
        bg-[var(--color-surface)]
        px-4 py-2
      "
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="
          flex items-center gap-2 text-xs text-[var(--color-text-muted)]
          hover:text-[var(--color-text)] transition-colors w-full text-left
        "
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        <span className="font-semibold uppercase tracking-widest">
          Gen 1 Assumptions
        </span>
        <span className="text-[var(--color-text-muted)]">
          — click to {expanded ? "collapse" : "expand"} · see{" "}
          <code className="font-mono">docs/From_Forecast_to_Cashflow_and_DSCR.md §5.4</code>
        </span>
      </button>

      {expanded && (
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          {ASSUMPTIONS.map(({ id, text }) => (
            <div key={id} className="flex items-start gap-1 text-xs text-[var(--color-text-secondary)]">
              <span className="font-mono font-semibold text-[var(--color-text-muted)] shrink-0">
                {id}
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      )}

      {!expanded && (
        <div className="mt-0.5 text-xs text-[var(--color-text-muted)] truncate">
          A1 Revenue constant · A2 No degradation · A3 No escalation ·{" "}
          <span className="text-[var(--color-warning)]">A4 Flat OpEx (overstates late-year CFADS)</span> ·
          A5 Annual test · A6 Hub/DA · A7 No reserves ·{" "}
          <span className="text-[var(--color-warning)]">A9 Deterministic OpEx (understates tail risk)</span>
        </div>
      )}
    </div>
  );
}
