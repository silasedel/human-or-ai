import { SITE } from "@/lib/branding";
import { cn } from "@/lib/utils";

/**
 * Temporary brand mark: a rounded square with a question mark. Swap this
 * component (and SITE in src/lib/branding.ts) to rebrand.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center justify-center rounded-xl bg-accent text-accent-fg font-bold select-none", className)}
      style={{ width: size, height: size, fontSize: size * 0.62, lineHeight: 1 }}
    >
      ?
    </span>
  );
}

export function Wordmark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.68 }}>
        {SITE.name}
      </span>
    </span>
  );
}
