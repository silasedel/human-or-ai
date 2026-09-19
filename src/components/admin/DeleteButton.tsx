"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

interface DeleteButtonProps {
  endpoint: string;
  confirmText: string;
  label?: string;
}

export function DeleteButton({ endpoint, confirmText, label = "Delete" }: DeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(confirmText)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Delete failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={remove}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
      >
        {loading ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
        {label}
      </button>
      {error && <span className="mt-1 text-[11px] text-danger">{error}</span>}
    </span>
  );
}
