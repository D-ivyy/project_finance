"use client";

import { useState, useRef, useEffect } from "react";
import type {
  LoanConfig, DisplayConfig, FilterConfig, AmortType, SculptPercentile, AssetMeta
} from "@/types";
import { resolveOpex, resolveMinDscr, resolveDefaultLoan } from "@/lib/finance";
import { Info } from "lucide-react";

// ── Tooltip ──────────────────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current) { setPos(null); return; }
    const rect = btnRef.current.getBoundingClientRect();
    // Position tooltip to the right of the icon, clamped to viewport
    const tipW = 230;
    const tipH = 120;
    let left = rect.right + 8;
    let top = rect.top - 4;
    // If overflows right, flip to left
    if (left + tipW > window.innerWidth - 12) {
      left = rect.left - tipW - 8;
    }
    // If overflows bottom, shift up
    if (top + tipH > window.innerHeight - 12) {
      top = window.innerHeight - tipH - 12;
    }
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] ml-1 shrink-0"
      >
        <Info size={11} />
      </button>
      {open && pos && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ top: pos.top, left: pos.left }}
        >
          <div
            className="
              bg-[var(--color-surface)] border border-[var(--color-border)]
              rounded-md shadow-lg px-3 py-2.5
              text-xs text-[var(--color-text)] whitespace-pre-line leading-relaxed
            "
            style={{ width: 230, maxHeight: 200, overflow: "auto" }}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label, tooltip, children
}: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center text-xs text-[var(--color-text-secondary)]">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </label>
      {children}
    </div>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────

function NumberInput({
  value,
  onChange,
  min, max, step, placeholder, hasError,
}: {
  value: number | string;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  placeholder?: string;
  hasError?: boolean;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      placeholder={placeholder}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={`
        w-full px-2 py-1.5 text-xs font-mono rounded
        bg-[var(--color-bg)] text-[var(--color-text)]
        border ${hasError ? "border-[var(--color-breach)]" : "border-[var(--color-border)]"}
        focus:outline-none focus:border-[var(--color-accent)]
        placeholder:text-[var(--color-text-muted)]
      `}
    />
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

function Select<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="
        w-full px-2 py-1.5 text-xs font-mono rounded
        bg-[var(--color-bg)] text-[var(--color-text)]
        border border-[var(--color-border)]
        focus:outline-none focus:border-[var(--color-accent)]
      "
    >
      {options.map((o, i) => (
        <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Toggle button pair ────────────────────────────────────────────────────────

function TogglePair<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded overflow-hidden border border-[var(--color-border)]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`
            flex-1 px-2 py-1 text-xs font-mono transition-colors
            ${value === o.value
              ? "bg-[var(--color-accent)] text-white"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
            }
          `}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mt-3 mb-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

interface ConfigSidebarProps {
  sites: { asset_slug: string; asset_type: string; state: string }[];
  selectedSite: string;
  onSiteChange: (slug: string) => void;
  asset: AssetMeta | null;
  filter: FilterConfig;
  onFilterChange: (f: FilterConfig) => void;
  loan: LoanConfig;
  onLoanChange: (c: LoanConfig) => void;
  opexOverride: number | null;
  onOpexChange: (v: number | null) => void;
  minDscrOverride: number | null;
  onMinDscrChange: (v: number | null) => void;
  display: DisplayConfig;
  onDisplayChange: (d: DisplayConfig) => void;
  validationErrors: string[];
}

export function ConfigSidebar({
  sites, selectedSite, onSiteChange,
  asset, filter, onFilterChange,
  loan, onLoanChange,
  opexOverride, onOpexChange,
  minDscrOverride, onMinDscrChange,
  display, onDisplayChange,
  validationErrors,
}: ConfigSidebarProps) {
  const opexInfo = asset ? resolveOpex(asset, opexOverride) : null;
  const minDscrInfo = asset ? resolveMinDscr(asset, minDscrOverride) : null;
  const defaultLoan = asset ? resolveDefaultLoan(asset) : null;

  const setLoan = (partial: Partial<LoanConfig>) =>
    onLoanChange({ ...loan, ...partial });

  const PERCENTILE_OPTIONS = (
    ["P10", "P25", "P50", "P75", "P90"] as SculptPercentile[]
  ).map((p) => ({ value: p, label: p }));

  const AMORT_OPTIONS: { value: AmortType; label: string }[] = [
    { value: "level_payment", label: "Level Payment" },
    { value: "level_principal", label: "Level Principal" },
    { value: "sculpted", label: "Sculpted" },
  ];

  return (
    <aside
      className="
        w-56 shrink-0 flex flex-col
        bg-[var(--color-surface)]
        border-r border-[var(--color-border)]
        h-full overflow-y-auto sidebar-scroll
        px-3 py-3 gap-1
      "
    >
      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="space-y-1 mb-2">
          {validationErrors.map((e, i) => (
            <div key={i} className="validation-error text-xs">{e}</div>
          ))}
        </div>
      )}

      <Divider label="Asset" />

      <Field label="Site">
        <Select
          value={selectedSite}
          onChange={onSiteChange}
          options={sites.map((s) => ({
            value: s.asset_slug,
            label: s.asset_slug.replace(/_/g, " "),
          }))}
        />
      </Field>

      {asset && (
        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {asset.asset_type} · {asset.state}
          {asset.ac_capacity_mw ? ` · ${asset.ac_capacity_mw.toFixed(1)} MW` : ""}
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <Field label="Kind">
          <TogglePair
            value={filter.kind}
            onChange={(v) => onFilterChange({ ...filter, kind: v })}
            options={[{ value: "hub", label: "hub" }, { value: "node", label: "node" }]}
          />
        </Field>
        <Field label="Market">
          <TogglePair
            value={filter.market}
            onChange={(v) => onFilterChange({ ...filter, market: v })}
            options={[{ value: "da", label: "da" }, { value: "rt", label: "rt" }]}
          />
        </Field>
      </div>

      <Divider label="Loan Terms" />

      <Field
        label="Principal ($M)"
        tooltip={
          defaultLoan && asset?.ac_capacity_mw
            ? `Default: $${(defaultLoan.principal / 1e6).toFixed(0)}M\nSized from min(CapEx × leverage, DSCR-constrained)\n${asset.ac_capacity_mw.toFixed(0)} MW ${asset.asset_type}\nResets on site change.`
            : "Loan principal. Range: $1M–$1B.\nSource: user-defined"
        }
      >
        <NumberInput
          value={loan.principal / 1e6}
          onChange={(v) => setLoan({ principal: v * 1e6 })}
          min={1} max={1000} step={1}
          placeholder="50"
          hasError={loan.principal <= 0}
        />
      </Field>

      <Field
        label="Rate (%)"
        tooltip={
          defaultLoan && asset
            ? `Default: ${(defaultLoan.annualRate * 100).toFixed(2)}% (${asset.asset_type})\nSolar: 5.75% | Wind: 6.25% | Battery: 7.00%\nResets on site change.`
            : "Annual interest rate (nominal, fixed).\nTypical US project finance 2024–25: 5.5–7.5%."
        }
      >
        <NumberInput
          value={(loan.annualRate * 100).toFixed(2)}
          onChange={(v) => setLoan({ annualRate: v / 100 })}
          min={0.1} max={30} step={0.1}
          placeholder="6.0"
          hasError={loan.annualRate <= 0}
        />
      </Field>

      <Field
        label="Tenor (years)"
        tooltip={
          defaultLoan && asset
            ? `Default: ${defaultLoan.tenorYears}yr (${asset.asset_type})\nSolar: 18yr | Wind: 15yr | Battery: 12yr\nSource: Norton Rose Fulbright 2024\nResets on site change.`
            : "Loan tenor from COD.\nDefault: 18yr.\nSource: Norton Rose Fulbright 2024; NREL ATB"
        }
      >
        <NumberInput
          value={loan.tenorYears}
          onChange={(v) => setLoan({ tenorYears: Math.round(v) })}
          min={1} max={40} step={1}
          placeholder="18"
          hasError={loan.tenorYears <= 0}
        />
      </Field>

      <Field
        label="Amortization"
        tooltip="level_payment: constant DS (annuity)\nlevel_principal: DS declines — DSCR improves\nsculpted: DS = CFADS/target_DSCR\nSource: docs/cashflow_dscr_methodology.md §4a"
      >
        <Select
          value={loan.amortType}
          onChange={(v) => setLoan({ amortType: v })}
          options={AMORT_OPTIONS}
        />
      </Field>

      {loan.amortType === "sculpted" && (
        <>
          <Field
            label="Target DSCR"
            tooltip="Target DSCR for sculpting.\nDefault: 1.40x — conservative headroom above solar covenant.\nSource: industry practice"
          >
            <NumberInput
              value={loan.targetDscrSculpt}
              onChange={(v) => setLoan({ targetDscrSculpt: v })}
              min={1.01} max={5} step={0.05}
              placeholder="1.40"
              hasError={loan.targetDscrSculpt <= 1.0}
            />
          </Field>

          <Field
            label="Sculpt percentile"
            tooltip="Revenue percentile that defines base CFADS for sculpting.\nDefault: P50 (expected base case).\nSource: lender convention"
          >
            <Select
              value={loan.sculptPercentile}
              onChange={(v) => setLoan({ sculptPercentile: v })}
              options={PERCENTILE_OPTIONS}
            />
          </Field>
        </>
      )}

      <Divider label="Operating" />

      <Field
        label="OpEx ($M/yr)"
        tooltip={
          opexInfo
            ? `Default: $${(opexInfo.value / 1e6).toFixed(2)}M/yr\n${opexInfo.source}\nRange: $22–25/kWAC-yr (solar)\nOverride: type to replace`
            : "OpEx derived from asset capacity × NREL ATB 2024 rate"
        }
      >
        <NumberInput
          value={opexOverride !== null ? opexOverride / 1e6 : ""}
          onChange={(v) => onOpexChange(isNaN(v) ? null : v * 1e6)}
          min={0} step={0.1}
          placeholder={opexInfo ? `${(opexInfo.value / 1e6).toFixed(2)} (auto)` : "auto"}
        />
      </Field>
      {opexOverride !== null && (
        <button
          onClick={() => onOpexChange(null)}
          className="text-xs text-[var(--color-accent)] hover:underline text-left"
        >
          ↩ Reset to auto
        </button>
      )}
      {opexInfo && opexOverride === null && (
        <div className="text-xs text-[var(--color-text-muted)]">
          auto: ${(opexInfo.value / 1e6).toFixed(2)}M/yr
        </div>
      )}

      <Divider label="Covenant" />

      <Field
        label="Min DSCR"
        tooltip={
          minDscrInfo
            ? `Default: ${minDscrInfo.value}x\nAsset type: ${asset?.asset_type}\nSource: ${minDscrInfo.source}\nSolar P50: 1.25x | Wind: 1.35x | BESS: 2.00x\nOverride: type to replace`
            : "MIN_DSCR derived from asset type"
        }
      >
        <NumberInput
          value={minDscrOverride !== null ? minDscrOverride : ""}
          onChange={(v) => onMinDscrChange(isNaN(v) ? null : v)}
          min={0.5} max={3.0} step={0.05}
          placeholder={minDscrInfo ? `${minDscrInfo.value} (auto)` : "auto"}
        />
      </Field>
      {minDscrOverride !== null && (
        <button
          onClick={() => onMinDscrChange(null)}
          className="text-xs text-[var(--color-accent)] hover:underline text-left"
        >
          ↩ Reset to auto
        </button>
      )}
      {minDscrInfo && minDscrOverride === null && (
        <div className="text-xs text-[var(--color-text-muted)]">
          auto: {minDscrInfo.value}x
        </div>
      )}

      <Divider label="Ledger" />
      <Field
        label="Revenue / CFADS percentile"
        tooltip="Controls which percentile is used for the Revenue and CFADS columns in the ledger table. DSCR columns always show P10/P50/P90."
      >
        <Select
          value={display.selectedPercentile}
          onChange={(v) => onDisplayChange({ ...display, selectedPercentile: v })}
          options={PERCENTILE_OPTIONS}
        />
      </Field>

      <div className="h-4" />
    </aside>
  );
}
