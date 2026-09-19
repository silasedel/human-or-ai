import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata: Metadata = { title: "Edit profile" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  return (
    <div>
      <PageHeader title="Edit profile" subtitle={`@${user.username}`} />
      <SettingsForm
        initial={{
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profileImage: user.profileImage,
        }}
      />
    </div>
  );
}
