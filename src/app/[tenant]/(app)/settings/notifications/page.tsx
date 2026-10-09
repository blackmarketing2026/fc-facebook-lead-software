import { db } from "@/lib/db";
import { missingMailerVars, parseEmailList } from "@/lib/mailer";
import { requireAdmin } from "@/lib/session";
import { PLATFORM_TENANT_SLUG } from "@/lib/tenant-paths";
import { NotifyEmailsForm, TestMailButton } from "./notification-forms";

export const metadata = { title: "Benachrichtigungen" };

export default async function NotificationsPage() {
  const admin = await requireAdmin();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: admin.tenantId }, select: { leadNotifyEmails: true } });
  const emails = parseEmailList(tenant.leadNotifyEmails);
  const missing = missingMailerVars();
  const smtp = missing.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Benachrichtigungen</h1>
        <p className="text-sm text-slate-500">
          Die unten eingetragenen Adressen bekommen bei jedem neuen Lead in diesem Dashboard eine E-Mail mit Namen und
          Link zum Lead-Profil. Kontaktdaten stehen in diesen E-Mails nur im Dashboard.
        </p>
        {admin.isPlatformAdmin && admin.tenant.slug === PLATFORM_TENANT_SLUG && (
          <p className="mt-2 text-sm text-slate-500">
            Der Master-Account erhält zusätzlich für jeden neuen Lead aus allen Dashboards eine ausführliche E-Mail an
            seine hinterlegte Adresse mit Kontaktdaten, Formularantworten und direkten Kontaktaktionen.
          </p>
        )}
      </div>

      {!smtp && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Der Mailversand ist auf dem Server noch nicht eingerichtet – es fehlt: {missing.join(", ")}. Die Adressen werden gespeichert, Mails gehen
          aber erst raus, sobald SMTP konfiguriert ist.
        </div>
      )}

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">E-Mail bei neuem Lead</h2>
        <p className="mb-3 text-sm text-slate-500">
          Eine oder mehrere Adressen, getrennt durch Komma oder Zeilenumbruch. Leer lassen, um die Benachrichtigung
          auszuschalten.
        </p>
        <NotifyEmailsForm initial={emails.join("\n")} />
        <div className="mt-4 border-t border-slate-100 pt-4">
          <TestMailButton disabled={!smtp || emails.length === 0} />
        </div>
      </section>
    </div>
  );
}
