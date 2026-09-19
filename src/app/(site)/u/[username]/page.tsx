import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Settings } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser, getGuestId } from "@/lib/auth";
import { getProfilePosts } from "@/lib/feed";
import { joinedDate } from "@/lib/time";
import { accuracyPct, pluralize } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { PostList } from "@/components/feed/PostList";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() }, select: { displayName: true } });
  return { title: user ? `${user.displayName} (@${username.toLowerCase()})` : "Profile" };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      profileImage: true,
      createdAt: true,
      guessCount: true,
      correctCount: true,
      accountType: true,
      _count: { select: { posts: { where: { createdAt: { lte: new Date() } } } } },
    },
  });
  if (!profile) notFound();

  const [viewer, guestId] = await Promise.all([getCurrentUser(), getGuestId()]);
  const isOwn = viewer?.id === profile.id;
  const page = await getProfilePosts({
    authorId: profile.id,
    limit: 20,
    viewer: { userId: viewer?.id ?? null, guestId },
  });
  const accuracy = accuracyPct(profile.correctCount, profile.guessCount);

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-bg/85 px-3 py-2.5 backdrop-blur md:px-4">
        <Link href="/" className="rounded-full p-2 text-fg hover:bg-bg-subtle" aria-label="Back to feed">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight">{profile.displayName}</h1>
          <p className="text-xs text-fg-muted">{pluralize(profile._count.posts, "post")}</p>
        </div>
      </div>

      <div className="border-b border-border px-4 pb-4 pt-5 md:px-5">
        <div className="flex items-start justify-between gap-4">
          <Avatar src={profile.profileImage} name={profile.displayName} size={88} className="ring-4 ring-bg" />
          {isOwn && (
            <Link href="/settings">
              <Button variant="secondary" size="sm">
                <Settings size={15} /> Edit profile
              </Button>
            </Link>
          )}
        </div>
        <div className="mt-3">
          <h2 className="text-xl font-bold leading-tight">{profile.displayName}</h2>
          <p className="text-sm text-fg-muted">@{profile.username}</p>
        </div>
        {profile.bio && <p className="post-text mt-3 text-[15px] leading-relaxed">{profile.bio}</p>}
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-fg-muted">
          <CalendarDays size={15} /> Joined {joinedDate(profile.createdAt)}
        </p>

        {isOwn && (
          <div className="mt-4 rounded-2xl border border-border bg-bg-subtle/60 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">AI Detective Score</div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div>
                <div className="text-2xl font-bold tabular-nums">{profile.guessCount.toLocaleString()}</div>
                <div className="text-xs text-fg-muted">guesses</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{profile.correctCount.toLocaleString()}</div>
                <div className="text-xs text-fg-muted">correct</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{profile.guessCount ? `${accuracy.toFixed(1)}%` : "—"}</div>
                <div className="text-xs text-fg-muted">accuracy</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-fg-muted">Only you can see this. It never shows on your public profile.</p>
          </div>
        )}
      </div>

      <PostList
        initial={page}
        endpoint={`/api/users/${profile.username}/posts`}
        emptyMessage={isOwn ? "You haven't posted yet. Say something on the home feed." : "No posts yet."}
      />
    </div>
  );
}
