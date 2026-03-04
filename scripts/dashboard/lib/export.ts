import type {
  DscrRow,
  LoanScheduleRow,
  PercentileMap,
  PercentileKey,
  QuarterlyPoint,
  LoanConfig,
  ComputedFinancials,
} from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(v: number): string {
  return `$${(v / 1e6).toFixed(2)}M`;
}

function fmtDscr(v: number): string {
  return `${v.toFixed(2)}x`;
}

function csvRow(cells: (string | number)[]): string {
  return cells
    .map((c) => {
      const s = String(c);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

// ── Per-year CSV ─────────────────────────────────────────────────────────────

export function generateYearCsv(
  year: number,
  dscrRow: DscrRow,
  loanRow: LoanScheduleRow,
  pctRevenue: PercentileMap,
  pctCfads: PercentileMap,
  annualOpex: number,
  minDscr: number,
  selectedPercentile: PercentileKey,
  quarterlyData?: QuarterlyPoint[]
): string {
  const lines: string[] = [];
  const pass = dscrRow.dscr.P10 >= minDscr ? "PASS" : "BREACH";

  lines.push(`Year ${year} — Project Finance Summary`);
  lines.push("");

  // Annual summary
  lines.push(csvRow([
    "Year", `Revenue (${selectedPercentile})`, "OpEx", "CFADS",
    "Debt Service", "Interest", "Principal Repaid", "Closing Balance",
    "DSCR P10", "DSCR P25", "DSCR P50", "DSCR P75", "DSCR P90",
    "Covenant Min", "Covenant Status",
  ]));
  lines.push(csvRow([
    year,
    fmtM(pctRevenue[selectedPercentile]),
    fmtM(annualOpex),
    fmtM(pctCfads[selectedPercentile]),
    fmtM(loanRow.debtService),
    fmtM(loanRow.interest),
    fmtM(loanRow.principal),
    fmtM(loanRow.closingBalance),
    fmtDscr(dscrRow.dscr.P10),
    fmtDscr(dscrRow.dscr.P25),
    fmtDscr(dscrRow.dscr.P50),
    fmtDscr(dscrRow.dscr.P75),
    fmtDscr(dscrRow.dscr.P90),
    fmtDscr(minDscr),
    pass,
  ]));

  // Revenue percentiles
  lines.push("");
  lines.push("Revenue Percentiles");
  lines.push(csvRow(["Percentile", "Annual Revenue"]));
  for (const k of ["P10", "P25", "P50", "P75", "P90"] as PercentileKey[]) {
    lines.push(csvRow([k, fmtM(pctRevenue[k])]));
  }

  // CFADS percentiles
  lines.push("");
  lines.push("CFADS Percentiles");
  lines.push(csvRow(["Percentile", "Annual CFADS"]));
  for (const k of ["P10", "P25", "P50", "P75", "P90"] as PercentileKey[]) {
    lines.push(csvRow([k, fmtM(pctCfads[k])]));
  }

  // Quarterly breakdown
  const yearQuarters = quarterlyData?.filter((q) => q.year === year);
  if (yearQuarters && yearQuarters.length > 0) {
    lines.push("");
    lines.push("Quarterly Breakdown");
    lines.push(csvRow([
      "Quarter", "Revenue P50", "CFADS P50", "Quarterly DS",
      "LTM DSCR P10", "LTM DSCR P50", "LTM DSCR P90",
    ]));
    for (const q of yearQuarters) {
      lines.push(csvRow([
        q.label,
        fmtM(q.revenue.P50),
        fmtM(q.cfads.P50),
        fmtM(q.debtService),
        fmtDscr(q.ltmDscr.P10),
        fmtDscr(q.ltmDscr.P50),
        fmtDscr(q.ltmDscr.P90),
      ]));
    }
  }

  return lines.join("\n");
}

// ── Full project report CSV ──────────────────────────────────────────────────

const ASSUMPTIONS = [
  "A1: Revenue constant across all years",
  "A2: No degradation",
  "A3: No price escalation",
  "A4: Flat OpEx — zero escalation, no component structure",
  "A5: Annual covenant test (LTM quarterly in dashboard)",
  "A6: Hub/DA only",
  "A7: No reserves",
  "A8: Amort type as configured",
  "A9: OpEx is deterministic — no uncertainty distribution",
];

export function generateFullReportCsv(
  siteName: string,
  assetType: string,
  loanConfig: LoanConfig,
  computed: ComputedFinancials,
  selectedPercentile: PercentileKey
): string {
  const lines: string[] = [];

  // Header
  lines.push("InfraSure — Project Finance Risk Report (Gen 1)");
  lines.push(`Generated,${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  // Site info
  lines.push("Site Configuration");
  lines.push(csvRow(["Site", siteName]));
  lines.push(csvRow(["Asset Type", assetType]));
  lines.push(csvRow(["Principal", fmtM(loanConfig.principal)]));
  lines.push(csvRow(["Rate", `${(loanConfig.annualRate * 100).toFixed(2)}%`]));
  lines.push(csvRow(["Tenor", `${loanConfig.tenorYears} years`]));
  lines.push(csvRow(["Amortization", loanConfig.amortType]));
  if (loanConfig.amortType === "sculpted") {
    lines.push(csvRow(["Sculpt Target DSCR", fmtDscr(loanConfig.targetDscrSculpt)]));
    lines.push(csvRow(["Sculpt Percentile", loanConfig.sculptPercentile]));
  }
  lines.push(csvRow(["OpEx", fmtM(computed.annualOpex)]));
  lines.push(csvRow(["Covenant Min DSCR", fmtDscr(computed.minDscr)]));
  lines.push("");

  // KPI Summary
  lines.push("KPI Summary");
  lines.push(csvRow(["Min DSCR", fmtDscr(computed.minDscrValue)]));
  lines.push(csvRow(["Binding Case", `${computed.minDscrPercentile} Year ${computed.minDscrYear}`]));
  lines.push(csvRow(["Debt / CFADS", `${computed.debtCfadsRatio.toFixed(2)}x`]));
  lines.push(csvRow(["Covenant Status", computed.covenantStatus.toUpperCase()]));
  lines.push(csvRow(["Breach Count", String(computed.breachCount)]));
  lines.push("");

  // Assumptions
  lines.push("Gen 1 Assumptions");
  for (const a of ASSUMPTIONS) {
    lines.push(a);
  }
  lines.push("");

  // Annual Schedule
  lines.push("Annual Financial Schedule");
  lines.push(csvRow([
    "Year", `Revenue (${selectedPercentile})`, "OpEx", "CFADS",
    "Debt Service", "Interest", "Principal", "Balance",
    "DSCR P10", "DSCR P25", "DSCR P50", "DSCR P75", "DSCR P90",
    "Covenant Status",
  ]));

  const revenue = computed.pctRevenue[selectedPercentile];
  const cfads = computed.pctCfads[selectedPercentile];

  for (let i = 0; i < computed.dscrTable.length; i++) {
    const row = computed.dscrTable[i];
    const ls = computed.loanSchedule[i];
    if (!ls) continue;
    const pass = row.dscr.P10 >= computed.minDscr ? "PASS" : "BREACH";
    lines.push(csvRow([
      row.year,
      fmtM(revenue),
      fmtM(computed.annualOpex),
      fmtM(cfads),
      fmtM(ls.debtService),
      fmtM(ls.interest),
      fmtM(ls.principal),
      fmtM(ls.closingBalance),
      fmtDscr(row.dscr.P10),
      fmtDscr(row.dscr.P25),
      fmtDscr(row.dscr.P50),
      fmtDscr(row.dscr.P75),
      fmtDscr(row.dscr.P90),
      pass,
    ]));
  }
  lines.push("");

  // Revenue + CFADS percentiles
  lines.push("Revenue Percentiles");
  lines.push(csvRow(["Percentile", "Annual Revenue", "Annual CFADS"]));
  for (const k of ["P10", "P25", "P50", "P75", "P90"] as PercentileKey[]) {
    lines.push(csvRow([k, fmtM(computed.pctRevenue[k]), fmtM(computed.pctCfads[k])]));
  }
  lines.push("");

  // Quarterly detail
  if (computed.quarterlyData.length > 0) {
    lines.push("Quarterly Detail (CFADS + LTM DSCR)");
    lines.push(csvRow([
      "Label", "Year", "Quarter",
      "Revenue P50", "CFADS P10", "CFADS P50", "CFADS P90",
      "Quarterly DS",
      "LTM DSCR P10", "LTM DSCR P50", "LTM DSCR P90",
    ]));
    for (const q of computed.quarterlyData) {
      lines.push(csvRow([
        q.label, q.year, q.quarter,
        fmtM(q.revenue.P50), fmtM(q.cfads.P10), fmtM(q.cfads.P50), fmtM(q.cfads.P90),
        fmtM(q.debtService),
        fmtDscr(q.ltmDscr.P10), fmtDscr(q.ltmDscr.P50), fmtDscr(q.ltmDscr.P90),
      ]));
    }
  }

  return lines.join("\n");
}

// ── Download trigger ─────────────────────────────────────────────────────────

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
