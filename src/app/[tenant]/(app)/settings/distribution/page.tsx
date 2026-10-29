import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DistributionEditor } from "./distribution-editor";
import { setDistributionPaused, setSalesAbsence } from "@/app/actions/settings";
import { seesAllTenants } from "@/lib/access";
import { RotationResetEditor } from "./rotation-reset-editor";

export const metadata = { title: "Verteilung" };

export default async function DistributionPage() {
  const admin = await requireAdmin();
  const master = seesAllTenants(admin);
  const users = await db.user.findMany({
    where: { tenantId: admin.tenantId, OR: [{ role: "SALES" }, { role: "ADMIN", salesEnabled: true }] },
    orderBy: { distOrder: "asc" },
    select: { id: true, displayName: true, active: true, distWeight: true, distPaused: true, distOrder: true, distCurrent: true, absenceReason: true, substituteId: true },
  });
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: admin.tenantId }, select: { id: true, name: true, distributionPaused: true } });
  const rotationTenants = master
    ? await db.tenant.findMany({ orderBy: { code: "asc" }, select: { id: true, name: true, distributionPaused: true } })
    : [tenant];
  const rotationMembers = master
    ? await db.user.findMany({ where: { OR: [{ role: "SALES" }, { role: "ADMIN", salesEnabled: true }] }, orderBy: { distOrder: "asc" }, select: { id: true, tenantId: true, displayName: true, active: true, distPaused: true, distWeight: true, distOrder: true } })
    : users.map((member) => ({ ...member, tenantId: tenant.id }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lead-Verteilung</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Neue Leads werden automatisch und gleichmäßig gestreut verteilt. Der <strong>Anteil</strong> legt fest, wie viel
          Prozent der Leads jemand bekommt – verschiebst du einen Regler, gleichen die anderen automatisch aus, die Summe
          bleibt immer 100 %. Mit dem Schloss hältst du einen Anteil fest. Die <strong>Reihenfolge</strong> bestimmt, wer
          zuerst dran ist. Pausierte oder deaktivierte Vertriebler (z. B. im Urlaub) werden übersprungen, ihr Anteil
          geht an die anderen.
        </p>
      </div>
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div><h2 className="font-semibold">Automatische Rotation</h2><p className="text-sm text-slate-500">Bei Stopp bleiben neue Leads unzugewiesen.</p></div>
        <form action={async () => { "use server"; await setDistributionPaused(!tenant.distributionPaused); }}><button className={tenant.distributionPaused ? "btn-primary" : "btn-danger"}>{tenant.distributionPaused ? "Rotation starten" : "Rotation stoppen"}</button></form>
      </section>
      <section className="card p-5"><h2 className="mb-1 text-lg font-semibold">Rotation neu beginnen</h2><p className="mb-5 text-sm text-slate-500">Setze den Verteiler zurück, ändere die Reihenfolge und bestimme, wer den nächsten automatisch verteilten Lead zuerst bekommt.</p><RotationResetEditor tenants={rotationTenants} members={rotationMembers} /></section>
      <DistributionEditor users={users} />
      <section className="card space-y-4 p-5"><h2 className="font-semibold">Urlaub und Krankheit</h2>{users.map((member) => <form key={member.id} action={async (formData) => { "use server"; await setSalesAbsence(member.id, undefined, formData); }} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"><span className="font-medium">{member.displayName}</span><label><span className="label">Status</span><select name="reason" defaultValue={member.absenceReason ?? ""} className="input"><option value="">Verfügbar</option><option value="URLAUB">Urlaub</option><option value="KRANK">Krank</option></select></label><label><span className="label">Vertretung</span><select name="substituteId" defaultValue={member.substituteId ?? ""} className="input"><option value="">Keine</option>{users.filter((u) => u.id !== member.id && u.active && !u.absenceReason).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></label><button className="btn-secondary">Speichern</button></form>)}</section>
    </div>
  );
}
