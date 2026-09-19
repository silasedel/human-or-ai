import { cn } from "@/lib/utils";

interface AvatarProps {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}

/** Circular avatar. Falls back to initials on a soft background. */
export function Avatar({ src, name, size = 44, className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-full bg-accent-soft text-accent select-none", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        // Plain <img>: avatars can come from any https host or our own API.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" loading="lazy" draggable={false} />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-semibold" style={{ fontSize: size * 0.4 }}>
          {initials || "?"}
        </span>
      )}
    </span>
  );
}
