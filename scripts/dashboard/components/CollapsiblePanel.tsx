"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface CollapsiblePanelProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsiblePanel({
  title,
  defaultOpen = false,
  children,
  className = "",
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`
        rounded-lg border border-[var(--color-border)]
        bg-[var(--color-surface)]
        ${className}
      `}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="
          w-full flex items-center gap-2 px-4 py-3
          text-left text-xs font-semibold uppercase tracking-widest
          text-[var(--color-text-muted)]
          hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]
          transition-colors rounded-lg
          select-none
        "
      >
        {open ? (
          <ChevronDown size={13} className="shrink-0 text-[var(--color-accent)]" />
        ) : (
          <ChevronRight size={13} className="shrink-0 text-[var(--color-text-muted)]" />
        )}
        {title}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-[var(--color-border)]">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}
