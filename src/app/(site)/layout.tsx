import { getCurrentUser } from "@/lib/auth";
import { ViewerProvider } from "@/components/ViewerProvider";
import { AppShell } from "@/components/AppShell";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const viewer = user
    ? {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        profileImage: user.profileImage,
        guessCount: user.guessCount,
        correctCount: user.correctCount,
      }
    : null;

  return (
    <ViewerProvider key={viewer?.id ?? "guest"} user={viewer}>
      <AppShell>{children}</AppShell>
    </ViewerProvider>
  );
}
