import type { Metadata } from "next";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const configured = isAdminConfigured();
  const authed = configured && (await isAdminAuthenticated());

  if (!authed) {
    return <AdminLogin configured={configured} />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <AdminNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
