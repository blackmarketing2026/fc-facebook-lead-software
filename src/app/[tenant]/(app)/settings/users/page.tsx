import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { CreateUserForm, EditUserForm } from "./user-forms";

export const metadata = { title: "Mitglieder" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: [{ role: "asc" }, { distOrder: "asc" }],
    select: { id: true, email: true, displayName: true, role: true, active: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mitglieder</h1>
        <p className="text-sm text-slate-500">
          Vertriebler und Admins mit Zugang zu diesem Dashboard. Vertriebler sehen nur ihre eigenen Leads.
        </p>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <details key={u.id} className="card group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
              <span className="font-medium">{u.displayName}</span>
              <span className={`badge ${u.role === "ADMIN" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                {u.role === "ADMIN" ? "Admin" : "Vertrieb"}
              </span>
              {!u.active && <span className="badge bg-red-100 text-red-700">deaktiviert</span>}
              <span className="ml-auto text-sm text-slate-500">{u.email}</span>
              <span className="text-slate-400 transition group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t border-slate-100 p-4">
              <EditUserForm user={u} isSelf={u.id === admin.id} />
            </div>
          </details>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Neues Mitglied anlegen</h2>
        <CreateUserForm />
      </section>
    </div>
  );
}
