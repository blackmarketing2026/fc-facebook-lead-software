import { readStoredSmtp, smtpConfig } from "@/lib/mailer";
import { requireAdmin } from "@/lib/session";
import { ResetSmtpButton, SmtpForm, SmtpTestForm } from "./smtp-forms";

export const metadata = { title: "SMTP" };

export default async function SmtpPage() {
  const admin = await requireAdmin();
  const c = await smtpConfig();
  const stored = await readStoredSmtp();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">SMTP</h1>
        <p className="text-sm text-slate-500">
          Zugang für den E-Mail-Versand (Benachrichtigungen, später E-Mail-Marketing). Hier gespeicherte Werte gehen vor den
          SMTP-Variablen des Servers. Das Passwort wird verschlüsselt gespeichert und nie angezeigt.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Aktuell wirksam: {c.host ? <strong>{c.host}:{c.port}</strong> : "nichts eingerichtet"} ·{" "}
          {c.source === "app" ? "in der App gespeichert" : "aus den Server-Variablen"}
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Zugangsdaten</h2>
        <SmtpForm
          initial={{ host: c.host ?? "", port: c.port, secure: c.secure, user: c.user ?? "", from: c.from ?? "", hasPassword: Boolean(c.pass) }}
        />
        {stored && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ResetSmtpButton />
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Verbindung testen</h2>
        <p className="mb-3 text-sm text-slate-500">Prüft die Anmeldung beim Server und schickt eine Test-Mail.</p>
        <SmtpTestForm defaultTo={admin.email} />
      </section>
    </div>
  );
}
