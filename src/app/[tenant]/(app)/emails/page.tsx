import { allStepStats, getTrackingEnabled } from "@/lib/chains";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { EmailItem, type EmailItemData } from "./email-item";

export const metadata = { title: "E-Mails" };

export default async function EmailsPage() {
  const admin = await requireAdmin();
  const [chains, stats, tracking] = await Promise.all([
    db.emailChain.findMany({
      where: { tenantId: admin.tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, active: true, steps: { orderBy: { position: "asc" }, select: { id: true, type: true, subject: true, body: true } } },
    }),
    allStepStats(admin.tenantId),
    getTrackingEnabled(),
  ]);

  const items: EmailItemData[] = chains.flatMap((chain) => {
    const mails = chain.steps.filter((s) => s.type === "EMAIL");
    return mails.map((s, i) => ({
      id: s.id,
      subject: s.subject ?? "",
      body: s.body ?? "",
      chainId: chain.id,
      chainName: chain.name,
      chainActive: chain.active,
      position: i + 1,
      total: mails.length,
      stats: stats[s.id] ?? { sent: 0, bounced: 0, opened: 0, clicked: 0 },
    }));
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">E-Mails</h1>
        <p className="text-sm text-slate-500">
          Alle E-Mails aus deinen E-Mail-Ketten an einem Ort – mit Statistik. Klick auf eine E-Mail zum Bearbeiten und Testen.
          Neue E-Mails legst du in der jeweiligen Kette an.
        </p>
      </div>
      {items.length === 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">
          Noch keine E-Mails. Lege unter „E-Mail-Ketten“ eine Kette an und füge E-Mail-Schritte hinzu.
        </div>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <EmailItem key={item.id} item={item} chainHref={tenantPath(admin.tenant.slug, `/email-chains/${item.chainId}`)} testEmail={admin.email} tracking={tracking} />
        ))}
      </div>
    </div>
  );
}
