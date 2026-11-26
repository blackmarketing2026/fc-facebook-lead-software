import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { ContactForm } from "./contact-form";

export const metadata = { title: "Kontakte importieren" };

export default async function ImportPage() {
  const admin = await requireAdmin();
  const [stages, tags] = await Promise.all([
    db.pipelineStage.findMany({ where: { tenantId: admin.tenantId }, orderBy: { position: "asc" }, select: { id: true, name: true, isDefault: true } }),
    db.tag.findMany({ where: { tenantId: admin.tenantId }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kontakte importieren</h1>
        <p className="text-sm text-slate-500">
          Lege hier einen Kontakt von Hand an, zum Beispiel jemanden aus einem Telefonat oder einer Messe. Er erscheint danach in der
          Pipeline und in der Kontaktcloud. (Ein Import aus Dateien folgt später.)
        </p>
      </div>
      <section className="card p-5">
        <ContactForm stages={stages} knownTags={tags.map((t) => t.name)} leadsBase={tenantPath(admin.tenant.slug, "/leads")} />
      </section>
    </div>
  );
}
