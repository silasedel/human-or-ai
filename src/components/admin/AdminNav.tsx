"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Database, FileText, LayoutDashboard, LogOut, Users, WandSparkles } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/ai-profiles", label: "AI profiles", icon: Bot },
  { href: "/admin/generate", label: "Generate", icon: WandSparkles },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="inline-flex items-center gap-2" title="Back to site">
          <LogoMark size={30} />
          <span className="font-semibold">Admin</span>
        </Link>
        <span className="hidden rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent sm:inline-flex">
          <Database size={12} className="mr-1" /> server-side only
        </span>
      </div>
      <nav className="flex flex-wrap items-center gap-1">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-fg text-bg" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
              )}
            >
              <Icon size={15} /> {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={logout}
          className="ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg"
        >
          <LogOut size={15} /> Sign out
        </button>
      </nav>
    </div>
  );
}
