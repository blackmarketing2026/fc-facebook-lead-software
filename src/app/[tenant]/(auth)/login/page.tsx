import { requireTenant } from "@/lib/tenant";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage() {
  await requireTenant();
  const name = "Function Concept";
  const initials = name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return <main className="login-shell login-shell--master">
    <div className="login-frame">
      <section className="login-story" aria-label="Masterbereich">
        <div className="login-story-top"><span className="login-brand-mark">{initials}</span><span className="login-brand-name">{name}<small>Masterbereich</small></span></div>
        <div className="login-story-content"><span className="login-kicker">ALLES IM BLICK</span><h1><>Deine Leads.<br /><em>Dein nächster Schritt.</em></></h1><p>Facebook-Leads bearbeiten, Termine planen, E-Mail-Marketing und Abschlüsse an einem Ort.</p></div>
        <div className="login-illustration" aria-hidden="true"><div className="login-illustration-ring ring-one"/><div className="login-illustration-ring ring-two"/><div className="login-illustration-center">↗</div><span className="login-float login-float-one">Leads</span><span className="login-float login-float-two">Termine</span><span className="login-float login-float-three">Abschlüsse</span></div>
        <div className="login-story-foot">FUNCTION CONCEPT · LEADCENTER</div>
      </section>
      <section className="login-panel"><div className="login-panel-inner"><span className="login-panel-kicker">MASTER-LOGIN</span><h2>Schön, dass du da bist.</h2><p className="login-panel-intro">Melde dich mit deiner E-Mail-Adresse und deinem Passwort bei {name} an.</p><LoginForm /><div className="login-panel-foot"><span className="login-lock" aria-hidden="true">🔒</span> Dein Zugang ist nur für diese Anwendung gültig.</div></div></section>
    </div>
  </main>;
}
