"use client";

import type { ComputedFinancials } from "@/types";
import { fmtDscr, fmtMillion } from "@/lib/api";
import { TrendingUp, CheckCircle, XCircle, Scale } from "lucide-react";

interface KpiCardsProps {
  data: ComputedFinancials;
}

function KpiCard({
  label,
  value,
  sub,
  detail,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  detail?: string;
  color: "green" | "amber" | "red" | "blue";
  icon: React.ReactNode;
}) {
  const colorMap = {
    green: {
      border: "border-[var(--color-safe)]/40",
      text: "text-[var(--color-safe)]",
      value: "text-[var(--color-safe)]",
    },
    amber: {
      border: "border-[var(--color-warning)]/40",
      text: "text-[var(--color-warning)]",
      value: "text-[var(--color-warning)]",
    },
    red: {
      border: "border-[var(--color-breach)]/40",
      text: "text-[var(--color-breach)]",
      value: "text-[var(--color-breach)]",
    },
    blue: {
      border: "border-[var(--color-accent)]/40",
      text: "text-[var(--color-accent)]",
      value: "text-[var(--color-text)]",
    },
  }[color];

  return (
    <div
      className={`
        flex-1 min-w-0 rounded-lg border ${colorMap.border}
        bg-[var(--color-surface)] px-4 py-3
        flex flex-col gap-1
      `}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </span>
        <span className={colorMap.text}>{icon}</span>
      </div>
      <div className={`text-2xl font-mono font-bold ${colorMap.value}`}>
        {value}
      </div>
      {sub && (
        <div className="text-xs text-[var(--color-text-secondary)]">{sub}</div>
      )}
      {detail && (
        <div className={`text-xs font-medium ${colorMap.text}`}>{detail}</div>
      )}
    </div>
  );
}

export function KpiCards({ data }: KpiCardsProps) {
  const {
    minDscrValue,
    minDscrYear,
    minDscrPercentile,
    minDscr,
    debtCfadsRatio,
    covenantStatus,
    breachCount,
    dscrTable,
  } = data;

  const headroom = minDscrValue - minDscr;
  const minDscrColor =
    headroom > 0.5 ? "green" : headroom > 0.1 ? "amber" : "red";

  const year1Ds = dscrTable[0]?.debtService ?? 0;

  return (
    <div className="flex gap-3 w-full">
      {/* Card 1: Min DSCR */}
      <KpiCard
        label="Min DSCR"
        value={fmtDscr(minDscrValue)}
        sub={`${minDscrPercentile}, Year ${minDscrYear}`}
        detail={
          headroom >= 0
            ? `▲ +${headroom.toFixed(2)}x above covenant ${fmtDscr(minDscr)}`
            : `▼ ${Math.abs(headroom).toFixed(2)}x BELOW covenant ${fmtDscr(minDscr)}`
        }
        color={minDscrColor}
        icon={<TrendingUp size={14} />}
      />

      {/* Card 2: Debt / CFADS (leverage) */}
      <KpiCard
        label="Debt / CFADS"
        value={`${debtCfadsRatio.toFixed(2)}x`}
        sub="Year 1 P50 (leverage)"
        detail={`Yr 1 DS: ${fmtMillion(year1Ds)}/yr`}
        color="blue"
        icon={<Scale size={14} />}
      />

      {/* Card 3: Covenant Status */}
      <KpiCard
        label="Covenant Status"
        value={covenantStatus === "pass" ? "ALL PASS ✓" : `${breachCount} BREACH${breachCount !== 1 ? "ES" : ""}`}
        sub={
          covenantStatus === "pass"
            ? `${dscrTable.length} years · all percentiles clear ${fmtDscr(minDscr)}`
            : `${breachCount} cell${breachCount !== 1 ? "s" : ""} below ${fmtDscr(minDscr)}`
        }
        detail={
          covenantStatus === "pass"
            ? "No covenant violations"
            : `Min DSCR threshold: ${fmtDscr(minDscr)}`
        }
        color={covenantStatus === "pass" ? "green" : "red"}
        icon={
          covenantStatus === "pass" ? (
            <CheckCircle size={14} />
          ) : (
            <XCircle size={14} />
          )
        }
      />
    </div>
  );
}
