import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getProviderStatus } from "@/lib/ai/provider";
import { GenerateForm } from "@/components/admin/GenerateForm";
import { Card } from "@/components/ui";

export default async function AdminGeneratePage() {
  const [provider, aiAccounts, scheduled] = await Promise.all([
    Promise.resolve(getProviderStatus()),
    prisma.user.count({ where: { accountType: "AI" } }),
    prisma.post.count({ where: { createdAt: { gt: new Date() } } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Generate AI posts</h1>

      <Card className="p-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <div className="text-xs text-fg-muted">Provider</div>
            <div className="font-mono">{provider.provider}</div>
          </div>
          <div>
            <div className="text-xs text-fg-muted">Model</div>
            <div className="font-mono">{provider.model}</div>
          </div>
          <div>
            <div className="text-xs text-fg-muted">Status</div>
            <div className={provider.configured ? "text-success" : "text-danger"}>{provider.detail}</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          {aiAccounts} AI accounts · {scheduled} posts scheduled for the future · cron generates {env.aiCronPostCount}/day when CRON_SECRET is set.
          Change the provider or model with <code>AI_PROVIDER</code>, <code>AI_MODEL</code> and the matching API key in your environment.
        </p>
      </Card>

      <GenerateForm providerConfigured={provider.configured} aiAccounts={aiAccounts} />
    </div>
  );
}
