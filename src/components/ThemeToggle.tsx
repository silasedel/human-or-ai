"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch. The current theme lives on <html class="dark"> (set
 * before paint by the script in layout.tsx), so the icons are chosen with CSS
 * rather than React state to avoid any hydration mismatch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage may be unavailable; the class still applies for this page
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg",
        className,
      )}
    >
      <Moon size={18} className="dark:hidden" />
      <Sun size={18} className="hidden dark:block" />
    </button>
  );
}
