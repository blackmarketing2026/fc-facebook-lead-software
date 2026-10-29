import { redirect } from "next/navigation";
import { displayName, requireTenant } from "@/lib/tenant";
import { PLATFORM_TENANT_SLUG, tenantPath } from "@/lib/tenant-paths";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage() {
  const tenant = await requireTenant();
  if (tenant.status === "SUSPENDED") redirect(tenantPath(tenant.slug, "/suspended"));
  const master = tenant.slug === PLATFORM_TENANT_SLUG;
  const name = master ? "Function Concept" : displayName(tenant);
  const initials = name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return <main className={`login-shell ${master ? "login-shell--master" : "login-shell--member"}`}>
    <div className="login-frame">
      <section className="login-story" aria-label={master ? "Masterbereich" : `${name} Leadcenter`}>
        <div className="login-story-top"><span className="login-brand-mark">{initials}</span><span className="login-brand-name">{name}<small>{master ? "Masterbereich" : "Leadcenter"}</small></span></div>
        <div className="login-story-content"><span className="login-kicker">{master ? "ALLES IM BLICK" : "DEIN ARBEITSPLATZ"}</span><h1>{master ? <>Deine Plattformen.<br /><em>Ein Überblick.</em></> : <>Deine Leads.<br /><em>Dein nächster Schritt.</em></>}</h1><p>{master ? "Verwalte Plattformen, Mitglieder und Lead-Verteilung an einem Ort." : "Kontakte bearbeiten, Termine planen und Abschlüsse im Blick behalten. Einfach anmelden und loslegen."}</p></div>
        <div className="login-illustration" aria-hidden="true"><div className="login-illustration-ring ring-one"/><div className="login-illustration-ring ring-two"/><div className="login-illustration-center">{master ? "✦" : "↗"}</div><span className="login-float login-float-one">{master ? "Plattformen" : "Leads"}</span><span className="login-float login-float-two">{master ? "Mitglieder" : "Termine"}</span><span className="login-float login-float-three">{master ? "Verteilung" : "Abschlüsse"}</span></div>
        <div className="login-story-foot">{master ? "FUNCTION CONCEPT · VERWALTUNG" : `${name.toUpperCase()} · TEAM-PLATTFORM`}</div>
      </section>
      <section className="login-panel"><div className="login-panel-inner"><span className="login-panel-kicker">{master ? "MASTER-LOGIN" : "WILLKOMMEN ZURÜCK"}</span><h2>Schön, dass du da bist.</h2><p className="login-panel-intro">Melde dich mit deiner E-Mail-Adresse und deinem Passwort bei {name} an.</p><LoginForm /><div className="login-panel-foot"><span className="login-lock" aria-hidden="true">🔒</span> Dein Zugang ist nur für diese Plattform gültig.</div></div></section>
    </div>
  </main>;
}
