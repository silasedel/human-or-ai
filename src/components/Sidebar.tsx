"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { House, Info, LogOut, SquarePen, Trophy, UserRound } from "lucide-react";
import { Wordmark, LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui";
import { useViewer } from "@/components/ViewerProvider";
import { accuracyPct, cn } from "@/lib/utils";

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3.5 rounded-full px-4 py-2.5 text-[17px] transition-colors hover:bg-bg-subtle",
        active ? "font-semibold text-fg" : "text-fg",
      )}
    >
      <span className={cn("shrink-0", active ? "text-fg" : "text-fg-muted")}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

/** Small running score, shown in the sidebar for logged-in players. */
export function ScoreMini() {
  const { user, stats } = useViewer();
  if (!user) return null;
  const pct = accuracyPct(stats.correctCount, stats.guessCount);
  return (
    <Link
      href="/score"
      className="block rounded-2xl border border-border bg-bg-elevated p-3.5 transition-colors hover:bg-bg-subtle"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">AI Detective Score</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{stats.guessCount ? `${pct.toFixed(1)}%` : "—"}</span>
        <span className="text-xs text-fg-muted">accuracy</span>
      </div>
      <div className="mt-0.5 text-xs text-fg-muted tabular-nums">
        {stats.correctCount} correct · {stats.guessCount} {stats.guessCount === 1 ? "guess" : "guesses"}
      </div>
    </Link>
  );
}

export function useSignOut() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setLoading(false);
      router.push("/");
      router.refresh();
    }
  }
  return { signOut, loading };
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useViewer();
  const { signOut, loading } = useSignOut();

  const profileHref = user ? `/u/${user.username}` : "/login";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col justify-between py-4 pr-4 md:flex">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-3">
            <Link href="/" className="inline-flex" aria-label="Home">
              <Wordmark size={34} />
            </Link>
            <ThemeToggle />
          </div>
          <nav className="space-y-0.5">
            <NavLink href="/" icon={<House size={22} />} label="Home" active={isActive("/")} />
            <NavLink href={profileHref} icon={<UserRound size={22} />} label="Profile" active={pathname.startsWith("/u/")} />
            <NavLink href="/score" icon={<Trophy size={22} />} label="Score" active={isActive("/score")} />
            <NavLink href="/about" icon={<Info size={22} />} label="How it works" active={isActive("/about")} />
          </nav>
          <div className="px-1">
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                if (!user) {
                  router.push("/login?next=/");
                  return;
                }
                if (pathname === "/") {
                  document.getElementById("composer-input")?.focus();
                } else {
                  router.push("/?compose=1");
                }
              }}
            >
              <SquarePen size={18} />
              Create Post
            </Button>
          </div>
          <div className="px-1">
            <ScoreMini />
          </div>
        </div>

        <div className="px-1">
          {user ? (
            <div className="flex items-center gap-3 rounded-full p-2 hover:bg-bg-subtle">
              <Link href={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={user.profileImage} name={user.displayName} size={40} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{user.displayName}</div>
                  <div className="truncate text-xs text-fg-muted">@{user.username}</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={signOut}
                disabled={loading}
                title="Sign out"
                aria-label="Sign out"
                className="rounded-full p-2 text-fg-muted hover:bg-bg hover:text-fg"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup" className="flex-1">
                <Button className="w-full">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-2.5 backdrop-blur md:hidden">
        <Link href="/" aria-label="Home" className="inline-flex">
          <Wordmark size={28} />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <Link href={`/u/${user.username}`} aria-label="Profile" className="ml-1">
              <Avatar src={user.profileImage} name={user.displayName} size={32} />
            </Link>
          ) : (
            <Link href="/login" className="ml-1">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </header>

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-border bg-bg/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[
          { href: "/", icon: <House size={24} />, label: "Home", active: pathname === "/" },
          { href: "/score", icon: <Trophy size={24} />, label: "Score", active: isActive("/score") },
          { href: user ? "/?compose=1" : "/login?next=/", icon: <SquarePen size={24} />, label: "Post", active: false },
          { href: profileHref, icon: <UserRound size={24} />, label: "Profile", active: pathname.startsWith("/u/") },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
              item.active ? "text-fg font-semibold" : "text-fg-muted",
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export function SidebarBrandFallback() {
  return <LogoMark size={28} />;
}
