import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { deleteUser } from "@/app/actions/settings";
import { Closings } from "@/components/closings";
import { RemoveMemberButton } from "@/components/remove-member-button";
import { LoginLink } from "@/app/[tenant]/(app)/platform/login-link";
import { CreateUserForm, EditUserForm } from "./user-forms";

export const metadata = { title: "Mitglieder" };

export default async function UsersPage(props: PageProps<"/[tenant]/settings/users">) {
  const admin = await requireAdmin();
  const filter = await props.searchParams;
  const users = await db.user.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: [{ role: "asc" }, { distOrder: "asc" }],
    select: { id: true, email: true, displayName: true, role: true, active: true, salesEnabled: true, notifyNewLeadEmail: true, isPlatformAdmin: true, platformGrants: { select: { tenantId: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mitglieder</h1>
        <p className="text-sm text-slate-500">
          Vertriebler und Admins mit Zugang zu diesem Dashboard. Vertriebler sehen nur ihre eigenen Leads.{" "}
          <a href="#abschluesse" className="text-blue-700 hover:underline">
            Zu Abschlüssen und Einnahmen ↓
          </a>
        </p>
      </div>

      <section className="card space-y-3 p-4">
        <div><h2 className="font-semibold">Login-URL für Mitglieder</h2><p className="text-sm text-slate-500">Diesen Link können alle Mitglieder dieser Plattform zum Anmelden nutzen.</p></div>
        <LoginLink slug={admin.tenant.slug} showUrl />
      </section>

      <div className="space-y-3">
        {users.map((u) => (
          <details key={u.id} className="card group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
              <span className="font-medium">{u.displayName}</span>
              <span className={`badge ${u.role === "ADMIN" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                {u.role === "ADMIN" ? "Admin" : "Vertrieb"}
              </span>
              {!u.active && <span className="badge bg-red-100 text-red-700">deaktiviert</span>}
              {u.platformGrants.length > 0 && <span className="badge bg-blue-100 text-blue-800">Stufe 2</span>}
              {u.salesEnabled && <span className="badge bg-blue-100 text-blue-800">Auch Vertrieb</span>}
              <span className="ml-auto text-sm text-slate-500">{u.email}</span>
              <span className="text-slate-400 transition group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t border-slate-100 p-4">
              {(admin.isPlatformAdmin || (!u.isPlatformAdmin && u.platformGrants.length === 0)) ? <EditUserForm user={u} isSelf={u.id === admin.id} /> : <p className="text-sm text-slate-500">Dieses Mitglied wird vom Master-Admin verwaltet.</p>}
              {u.id !== admin.id && !u.isPlatformAdmin && (admin.isPlatformAdmin || u.platformGrants.length === 0) && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <RemoveMemberButton action={deleteUser.bind(null, u.id)} name={u.displayName} />
                </div>
              )}
            </div>
          </details>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Neues Mitglied anlegen</h2>
        <CreateUserForm />
      </section>

      <Closings user={admin} filter={filter} path="/settings/users" />
    </div>
  );
}
