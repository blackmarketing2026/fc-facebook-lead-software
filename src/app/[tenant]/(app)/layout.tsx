import { logout } from "@/app/actions/auth";
import { AppNavigation, type AppLink } from "@/components/app-navigation";
import { LeadWatcher } from "@/components/lead-watcher";
import { NotificationBell } from "@/components/notification-bell";
import { PushSetup } from "@/components/push-setup";
import { requireUser } from "@/lib/session";
import { displayName } from "@/lib/tenant";
import { tenantPath } from "@/lib/tenant-paths";

export default async function AppLayout({ children }: LayoutProps<"/[tenant]">) {
  const user = await requireUser();
  const t = (path: string) => tenantPath(user.tenant.slug, path);
  const brand = displayName(user.tenant);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const pushEnabled = Boolean(vapid) && !vapid.startsWith("PLATZHALTER");

  const primary: AppLink[] = [
    { href: t("/dashboard"), label: "Start", icon: "home" },
    { href: t("/leads"), label: "Leads", icon: "leads" },
    { href: t("/calendar"), label: "Kalender", icon: "calendar" },
    ...(user.role === "ADMIN" ? [{ href: t("/email-chains"), label: "E-Mail-Ketten", icon: "mail" }] : []),
  ];
  const secondary: AppLink[] = user.role === "ADMIN" ? [
    { href: t("/settings/intake"), label: "Lead-Empfang", icon: "sliders" },
    { href: t("/settings/smtp"), label: "SMTP", icon: "mail" },
    { href: t("/settings/mailbox"), label: "Postfach", icon: "mail" },
    { href: t("/settings/notifications"), label: "Benachrichtigungen", icon: "settings" },
  ] : [];

  return <div className="app-shell app-shell--master">
    <AppNavigation primary={primary} secondary={secondary} master brand={brand} />
    <div className="shell-content">
      <header className="shell-header"><div className="shell-header-title"><span className="shell-eyebrow">FUNCTION CONCEPT</span><strong>{brand}</strong></div><div className="shell-header-actions"><NotificationBell /><span className="shell-user-name">{user.displayName}</span><form action={logout}><button className="shell-logout">Abmelden</button></form></div></header>
      <PushSetup vapidPublicKey={vapid} />
      <LeadWatcher askPermission={!pushEnabled} />
      <main className="shell-main">{children}</main>
    </div>
  </div>;
}
