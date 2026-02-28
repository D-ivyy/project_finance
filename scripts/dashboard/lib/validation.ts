import type { LoanConfig, ValidationMessage, PercentileMap } from "@/types";

/** Validate all loan config inputs. Returns array of messages (may be empty = valid). */
export function validateLoanConfig(
  config: LoanConfig,
  pctCfads: PercentileMap | null,
  opex: number
): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];

  // ── Principal ────────────────────────────────────────────────────────────────
  if (config.principal <= 0) {
    msgs.push({
      severity: "error",
      field: "principal",
      message: "Principal must be greater than $0. Computation disabled.",
    });
  } else if (config.principal < 1_000_000) {
    msgs.push({
      severity: "warning",
      field: "principal",
      message: `Principal ($${(config.principal / 1e6).toFixed(2)}M) is very small for project finance.`,
    });
  } else if (config.principal > 1_000_000_000) {
    msgs.push({
      severity: "warning",
      field: "principal",
      message: `Principal ($${(config.principal / 1e9).toFixed(2)}B) exceeds typical project finance range. Verify.`,
    });
  }

  // ── Rate ─────────────────────────────────────────────────────────────────────
  if (config.annualRate <= 0) {
    msgs.push({
      severity: "error",
      field: "rate",
      message: "Interest rate must be greater than 0%. Computation disabled.",
    });
  } else if (config.annualRate > 0.20) {
    msgs.push({
      severity: "warning",
      field: "rate",
      message: `Rate (${(config.annualRate * 100).toFixed(1)}%) exceeds 20%, which is unusual for project finance.`,
    });
  }

  // ── Tenor ────────────────────────────────────────────────────────────────────
  if (config.tenorYears <= 0 || !Number.isInteger(config.tenorYears)) {
    msgs.push({
      severity: "error",
      field: "tenor",
      message: "Tenor must be a positive integer (1–40 years). Computation disabled.",
    });
  } else if (config.tenorYears > 30) {
    msgs.push({
      severity: "info",
      field: "tenor",
      message: `Tenor (${config.tenorYears}yr) exceeds 30 years — unusual for utility-scale renewables.`,
    });
  }

  // ── Sculpted-specific ────────────────────────────────────────────────────────
  if (config.amortType === "sculpted") {
    if (config.targetDscrSculpt <= 1.0) {
      msgs.push({
        severity: "error",
        field: "targetDscr",
        message: `Target DSCR (${config.targetDscrSculpt}x) must be > 1.0x. At ≤ 1.0x the loan would not amortize.`,
      });
    } else if (config.targetDscrSculpt < 1.10) {
      msgs.push({
        severity: "warning",
        field: "targetDscr",
        message: `Target DSCR (${config.targetDscrSculpt}x) is very thin coverage. Lenders typically require ≥ 1.10x.`,
      });
    } else if (config.targetDscrSculpt > 3.0) {
      msgs.push({
        severity: "info",
        field: "targetDscr",
        message: `Target DSCR (${config.targetDscrSculpt}x) is unusually conservative.`,
      });
    }

    // Sculpt percentile CFADS must be positive
    if (pctCfads) {
      const sculptCfads = pctCfads[config.sculptPercentile];
      if (sculptCfads <= 0) {
        msgs.push({
          severity: "error",
          field: "sculptPercentile",
          message: `OpEx ($${(opex / 1e6).toFixed(2)}M) ≥ revenue at ${config.sculptPercentile} ($${((sculptCfads + opex) / 1e6).toFixed(2)}M). CFADS is negative — sculpting requires positive CFADS.`,
        });
      }
    }
  }

  return msgs;
}

/** Cross-control warnings: run after full computation */
export function validateCrossControls(
  p10Cfads: number,
  year1DebtService: number,
  principal: number,
  loanSchedule: { debtService: number; closingBalance: number; year: number }[]
): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];

  // Year 1 DS > P10 CFADS — amber banner (still runs)
  if (year1DebtService > 0 && p10Cfads < year1DebtService) {
    msgs.push({
      severity: "warning",
      field: "crossControl",
      message: `Debt service in Year 1 ($${(year1DebtService / 1e6).toFixed(2)}M) exceeds P10 CFADS ($${(p10Cfads / 1e6).toFixed(2)}M). Project cannot service debt at worst-case revenue.`,
    });
  }

  // Sculpted schedule must fully amortize (closing balance ≈ 0 at end)
  if (loanSchedule.length > 0) {
    const lastRow = loanSchedule[loanSchedule.length - 1];
    if (Math.abs(lastRow.closingBalance) > 1.0 && lastRow.closingBalance / principal > 0.001) {
      msgs.push({
        severity: "error",
        field: "crossControl",
        message: `Sculpted schedule does not fully amortize — closing balance at Year ${lastRow.year} is $${(lastRow.closingBalance / 1e6).toFixed(2)}M. DS is too small to cover interest in late years.`,
      });
    }
  }

  return msgs;
}

/** Returns true if any hard error is present (computation should be blocked) */
export function hasHardError(msgs: ValidationMessage[]): boolean {
  return msgs.some((m) => m.severity === "error");
}
