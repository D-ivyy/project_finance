"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Download, BarChart3 } from "lucide-react";

interface HeaderProps {
  siteName: string;
  assetType: string;
  kind: string;
  market: string;
  pathCount: number;
}

export function Header({ siteName, assetType, kind, market, pathCount }: HeaderProps) {
  const displayName = siteName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <header
      className="
        flex items-center justify-between
        px-4 py-2.5
        border-b border-[var(--color-border)]
        bg-[var(--color-surface)]
        sticky top-0 z-40
      "
    >
      {/* Left: logo + title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[var(--color-accent)]">
          <BarChart3 size={18} strokeWidth={1.8} />
          <span className="font-semibold text-sm tracking-tight text-[var(--color-text)]">
            InfraSure
          </span>
        </div>
        <span className="text-[var(--color-border)] text-sm select-none">|</span>
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          Project Finance Risk Dashboard
        </span>
      </div>

      {/* Center: site info */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className="
            px-2 py-0.5 rounded-full font-medium
            bg-[var(--color-accent-subtle)] text-[var(--color-accent)]
            border border-[var(--color-accent)]/30
          "
        >
          {displayName}
        </span>
        <span className="text-[var(--color-text-secondary)]">
          {kind}/{market}
        </span>
        <span className="text-[var(--color-text-muted)]">·</span>
        <span className="text-[var(--color-text-secondary)]">
          {pathCount > 0 ? `${pathCount.toLocaleString()} paths` : "loading…"}
        </span>
        <span
          className="
            px-1.5 py-0.5 rounded text-xs font-mono font-semibold
            bg-[var(--color-safe-subtle)] text-[var(--color-safe)]
            border border-[var(--color-safe)]/30
          "
        >
          GEN 1
        </span>
      </div>

      {/* Right: theme toggle + export */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          title="Export PDF snapshot (coming soon)"
          className="
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs
            border border-[var(--color-border)]
            bg-[var(--color-surface)] text-[var(--color-text-secondary)]
            hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]
            transition-colors
          "
          disabled
        >
          <Download size={13} />
          <span className="hidden sm:inline">Export PDF</span>
        </button>
      </div>
    </header>
  );
}
