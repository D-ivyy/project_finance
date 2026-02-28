"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;

  const cycle = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("system");
    else setTheme("dark");
  };

  const icon =
    theme === "dark" ? (
      <Moon size={15} />
    ) : theme === "light" ? (
      <Sun size={15} />
    ) : (
      <Monitor size={15} />
    );

  const label =
    theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <button
      onClick={cycle}
      title={`Theme: ${label} — click to cycle`}
      className="
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs
        border border-[var(--color-border)]
        bg-[var(--color-surface)] text-[var(--color-text-secondary)]
        hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]
        transition-colors select-none
      "
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
