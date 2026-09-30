import { DnsInstructions } from "@/components/dns-instructions";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { getDnsTarget } from "@/lib/tenant";

export const metadata = { title: "Domain" };

export default async function DomainPage() {
  const admin = await requireAdmin();
  const [domains, target] = await Promise.all([
    db.tenantDomain.findMany({ where: { tenantId: admin.tenantId }, orderBy: { createdAt: "asc" } }),
    getDnsTarget(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Domain</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Unter diesen Adressen ist dein Dashboard erreichbar. Damit eine eigene Domain funktioniert, muss bei deinem
          Domain-Anbieter der unten angezeigte DNS-Eintrag gesetzt sein. Neue Domains richtet Function Concept für dich ein.
        </p>
      </div>

      {domains.length === 0 && (
        <p className="card p-5 text-sm text-slate-500">Für dieses Dashboard ist noch keine eigene Domain hinterlegt.</p>
      )}

      {domains.map((d) => (
        <section key={d.id} className="card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{d.hostname}</span>
            <span className={`badge ${d.verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              {d.verified ? "verbunden" : "ausstehend"}
            </span>
            {d.lastCheckedAt && (
              <span className="text-xs text-slate-500">zuletzt geprüft {formatDateTime(d.lastCheckedAt)}</span>
            )}
          </div>
          <DnsInstructions hostname={d.hostname} target={target} />
        </section>
      ))}
    </div>
  );
}
