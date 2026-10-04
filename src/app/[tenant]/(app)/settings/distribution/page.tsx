import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DistributionEditor } from "./distribution-editor";

export const metadata = { title: "Verteilung" };

export default async function DistributionPage() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({
    where: { tenantId: admin.tenantId, role: "SALES" },
    orderBy: { distOrder: "asc" },
    select: { id: true, displayName: true, active: true, distWeight: true, distPaused: true, distOrder: true, distCurrent: true },
  });

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
      <DistributionEditor users={users} />
    </div>
  );
}
