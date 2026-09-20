import { getCurrentUser, getGuestId } from "@/lib/auth";
import { getFeedPage, newFeedSeed } from "@/lib/feed";
import { Feed } from "@/components/feed/Feed";
import { SecurityNotice } from "@/components/SecurityNotice";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ compose?: string; loginAttempts?: string }>;
}) {
  const [user, guestId, params] = await Promise.all([getCurrentUser(), getGuestId(), searchParams]);
  const seed = newFeedSeed();
  const feedTime = new Date();
  const initial = await getFeedPage({
    mode: "foryou",
    seed,
    feedTime,
    limit: 20,
    viewer: { userId: user?.id ?? null, guestId },
  });

  const failedAttempts = user ? Math.min(999, parseInt(params.loginAttempts ?? "0", 10) || 0) : 0;

  return (
    <>
      {failedAttempts >= 3 && <SecurityNotice attempts={failedAttempts} />}
      <Feed
      key={seed}
      initial={initial}
      seed={seed}
      feedTime={feedTime.getTime()}
      initialMode="foryou"
      autoFocusComposer={params.compose === "1"}
      />
    </>
  );
}
