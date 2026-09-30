import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/session";
import { getDnsTarget } from "@/lib/tenant";
import { vercelConfigured } from "@/lib/vercel";
import { PlatformSettingsForm } from "../platform-forms";

export const metadata = { title: "Plattform-Einstellungen" };

export default async function PlatformSettingsPage() {
  await requirePlatformAdmin();
  const target = await getDnsTarget();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-slate-500 hover:text-slate-800">
          ← Plattform
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Plattform-Einstellungen</h1>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">DNS-Vorgabe für Kunden-Domains</h2>
        <p className="mb-4 max-w-3xl text-sm text-slate-500">
          Diese Einträge sehen die Kunden in ihrem Dashboard unter <strong>Domain</strong> und tragen sie bei ihrem
          Domain-Anbieter ein. Subdomains (z. B. leads.kunde.de) bekommen einen CNAME, Hauptdomains (kunde.de) einen
          A-Eintrag.
        </p>
        <PlatformSettingsForm cnameTarget={target.cnameTarget} aRecord={target.aRecord} />
      </section>

      <section className="card p-5 text-sm">
        <h2 className="mb-1 font-semibold">Vercel-Anbindung</h2>
        {vercelConfigured() ? (
          <p className="text-green-700">
            ✓ Aktiv. Neue Domains werden automatisch im Vercel-Projekt eingetragen und dort geprüft.
          </p>
        ) : (
          <p className="text-slate-600">
            Nicht eingerichtet. Neue Domains müssen im Vercel-Dashboard unter <em>Settings → Domains</em> von Hand
            hinzugefügt werden. Für die Automatik die Umgebungsvariablen <code>VERCEL_TOKEN</code>,{" "}
            <code>VERCEL_PROJECT_ID</code> und bei Team-Projekten <code>VERCEL_TEAM_ID</code> setzen.
          </p>
        )}
      </section>
    </div>
  );
}
