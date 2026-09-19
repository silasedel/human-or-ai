import { SITE } from "@/lib/branding";
import { cn } from "@/lib/utils";

/**
 * Brand mark: a circle split green (human) / orange (AI) with a question mark.
 * Swap this component (and SITE in src/lib/branding.ts) to rebrand.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("brand-mark inline-flex select-none items-center justify-center rounded-full font-black text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.6, lineHeight: 1, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.25)" }}
    >
      ?
    </span>
  );
}

export function Wordmark({ size = 32, className }: { size?: number; className?: string }) {
  const name = SITE.name;
  const endsWithQuestion = name.endsWith("?");
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="font-extrabold tracking-tight" style={{ fontSize: size * 0.7 }}>
        {endsWithQuestion ? (
          <>
            {name.slice(0, -1)}
            <span className="text-ai">?</span>
          </>
        ) : (
          name
        )}
      </span>
    </span>
  );
}
