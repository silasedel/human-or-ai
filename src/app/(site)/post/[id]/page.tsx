import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, getGuestId } from "@/lib/auth";
import { getPostById } from "@/lib/feed";
import { SinglePost } from "@/components/feed/SinglePost";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostById(id, { userId: null, guestId: null });
  return { title: post ? `${post.author.displayName}: "${post.text.slice(0, 60)}"` : "Post" };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const [user, guestId] = await Promise.all([getCurrentUser(), getGuestId()]);
  const post = await getPostById(id, { userId: user?.id ?? null, guestId });
  if (!post) notFound();

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-bg/85 px-3 py-2.5 backdrop-blur md:px-4">
        <Link href="/" className="rounded-full p-2 text-fg hover:bg-bg-subtle" aria-label="Back to feed">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">Post</h1>
      </div>
      <SinglePost post={post} />
    </div>
  );
}
