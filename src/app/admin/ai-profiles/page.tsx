import Link from "next/link";
import { prisma } from "@/lib/db";
import { parsePersona } from "@/lib/ai/personas";
import { Avatar } from "@/components/Avatar";
import { AiProfileForm } from "@/components/admin/AiProfileForm";
import { DeleteButton } from "@/components/admin/DeleteButton";

export default async function AdminAiProfilesPage() {
  const profiles = await prisma.user.findMany({
    where: { accountType: "AI" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      profileImage: true,
      persona: true,
      postingWeight: true,
      _count: { select: { posts: true } },
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">AI profiles</h1>
        <p className="text-sm text-fg-muted">
          {profiles.length} personas. Each has a persistent style record the generator uses. Posting weight controls how
          often an account is picked when generating batches.
        </p>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {profiles.map((p) => {
            const persona = parsePersona(p.persona);
            return (
              <li key={p.id} className="flex gap-3 px-4 py-3">
                <Avatar src={p.profileImage} name={p.displayName} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href={`/u/${p.username}`} target="_blank" className="font-semibold hover:underline">
                      {p.displayName}
                    </Link>
                    <span className="text-fg-muted">@{p.username}</span>
                    <span className="text-xs text-fg-faint">
                      weight {p.postingWeight} · {p._count.posts} posts
                    </span>
                  </div>
                  {persona ? (
                    <>
                      <p className="mt-0.5 text-sm">{persona.summary}</p>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {persona.capitalization} caps · {persona.punctuation} punctuation · emoji {persona.emoji} · {persona.length} · slang {persona.slang} · grammar {persona.grammar}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-xs text-danger">No valid persona stored (default voice will be used).</p>
                  )}
                </div>
                <DeleteButton endpoint={`/api/admin/users/${p.id}`} confirmText={`Delete @${p.username} and all of its posts?`} />
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <AiProfileForm />
      </div>
    </div>
  );
}
