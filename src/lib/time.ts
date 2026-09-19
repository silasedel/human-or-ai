/** Compact relative timestamps: "now", "5m", "3h", "2d", "Mar 4". */
export function relativeTime(input: Date | string, now: Date = new Date()): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = Math.max(0, now.getTime() - date.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(
    "en-US",
    sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
  );
}

export function fullDateTime(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function joinedDate(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
