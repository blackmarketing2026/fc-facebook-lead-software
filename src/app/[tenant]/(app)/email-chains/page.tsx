import Link from "next/link";
import { getAutoTagName, getTrackingEnabled } from "@/lib/chains";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { AutoTagForm, NewChainForm, TrackingToggle } from "./chain-forms";

export const metadata = { title: "E-Mail-Ketten" };

export default async function EmailChainsPage() {
  const admin = await requireAdmin();
  const base = tenantPath(admin.tenant.slug, "/email-chains");
  const [chains, autoTag, tags, tracking] = await Promise.all([
    db.emailChain.findMany({
      where: { tenantId: admin.tenantId },
      orderBy: { createdAt: "desc" },
      include: { triggerTag: { select: { name: true } }, steps: { select: { type: true } }, _count: { select: { sends: true } } },
    }),
    getAutoTagName(),
    db.tag.findMany({ where: { tenantId: admin.tenantId }, orderBy: { name: "asc" }, select: { name: true } }),
    getTrackingEnabled(),
  ]);
  const runStats = await db.chainRun.groupBy({ by: ["chainId", "status"], where: { chain: { tenantId: admin.tenantId } }, _count: true });
  const stat = (chainId: string, status: string) => runStats.find((r) => r.chainId === chainId && r.status === status)?._count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">E-Mail-Ketten</h1>
        <p className="text-sm text-slate-500">
          Eine Kette ist eine automatische Abfolge aus E-Mails und Wartezeiten. Sie startet für jeden Lead, der den
          Start-Tag bekommt, und läuft Schritt für Schritt bis zum Ende.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Tag für neue Leads</h2>
        <p className="mb-3 text-sm text-slate-500">
          Jeder frisch eingegangene Lead bekommt automatisch diesen Tag. Verwende ihn als Start-Tag einer Kette, dann
          startet sie sofort für neue Leads. Leer lassen = kein automatischer Tag.
        </p>
        <AutoTagForm initial={autoTag} />
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Statistik: Öffnungen und Klicks messen</h2>
        <p className="mb-3 text-sm text-slate-500">
          Dafür enthält jede Ketten-Mail ein unsichtbares Zählpixel, und Links laufen über unseren Server. Bounces und Spam-Beschwerden
          werden unabhängig davon aus Rückläufer-Mails im Lead-Postfach erkannt. Hinweis: In Deutschland brauchst du für die Messung
          in der Regel eine Einwilligung und einen Hinweis in der Datenschutzerklärung.
        </p>
        <TrackingToggle enabled={tracking} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Deine Ketten</h2>
        {chains.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">Noch keine Kette. Lege unten die erste an.</div>}
        {chains.map((c) => (
          <Link key={c.id} href={`${base}/${c.id}`} className="card block p-4 transition hover:shadow-md">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{c.name}</span>
              <span className={`badge ${c.active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{c.active ? "aktiv" : "pausiert"}</span>
              <span className="ml-auto text-sm text-blue-700">Bearbeiten →</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              <span>Start: Tag „{c.triggerTag.name}“</span>
              <span>{c.steps.filter((s) => s.type === "EMAIL").length} E-Mail(s), {c.steps.filter((s) => s.type === "WAIT").length} Wartezeit(en)</span>
              <span>{stat(c.id, "ACTIVE")} laufend · {stat(c.id, "DONE")} fertig · {c._count.sends} Mails verschickt</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Neue E-Mail-Kette</h2>
        <NewChainForm existingTags={tags.map((t) => t.name)} defaultTag={autoTag} />
      </section>
    </div>
  );
}
