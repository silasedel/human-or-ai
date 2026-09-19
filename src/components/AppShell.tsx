import { Sidebar } from "@/components/Sidebar";
import { RightRail } from "@/components/RightRail";

/** Three-column layout on desktop (sidebar / feed / rail), single column on mobile. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col px-0 md:flex-row md:px-4">
      <Sidebar />
      <main className="min-h-screen w-full min-w-0 flex-1 border-border pb-20 md:max-w-[640px] md:border-x md:pb-0">
        {children}
      </main>
      <RightRail />
    </div>
  );
}
