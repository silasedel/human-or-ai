export function TypeBadge({ type }: { type: "HUMAN" | "AI" }) {
  return (
    <span
      className={
        type === "AI"
          ? "rounded-full bg-ai-soft px-2 py-0.5 text-xs font-semibold text-ai"
          : "rounded-full bg-human-soft px-2 py-0.5 text-xs font-semibold text-human"
      }
    >
      {type}
    </span>
  );
}
