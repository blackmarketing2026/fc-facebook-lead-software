import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AppNavigation, type AppLink } from "@/components/app-navigation";
import { LeadWatcher } from "@/components/lead-watcher";
import { NotificationBell } from "@/components/notification-bell";
import { PushSetup } from "@/components/push-setup";
import { seesAllTenants } from "@/lib/access";
import { getPlatformAdmin, getPlatformManager, requireUser } from "@/lib/session";
import { displayName } from "@/lib/tenant";
import { tenantPath } from "@/lib/tenant-paths";

export default async function AppLayout({ children }: LayoutProps<"/[tenant]">) {
  const user = await requireUser();
  const platformAdmin = await getPlatformAdmin();
  const platformManager = await getPlatformManager();
  const master = seesAllTenants(user);
  const localMaster = user.isTenantMaster && !user.operator && !master;
  const t = (path: string) => tenantPath(user.tenant.slug, path);
  const brand = displayName(user.tenant);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const pushEnabled = Boolean(vapid) && !vapid.startsWith("PLATZHALTER");

  const primary: AppLink[] = master ? [
    { href: t("/platform"), label: "Plattformen", icon: "layers" },
    { href: t("/leads"), label: "Alle Leads", icon: "leads" },
    { href: t("/platform/members"), label: "Mitglieder", icon: "users" },
    { href: t("/settings/mailbox"), label: "Postfächer", icon: "mail" },
  ] : [
    { href: t("/dashboard"), label: "Start", icon: "home" },
    { href: t("/leads"), label: "Leads", icon: "leads" },
    { href: t("/calendar"), label: "Kalender", icon: "calendar" },
    { href: t("/closings"), label: "Abschlüsse", icon: "chart" },
  ];
  const secondary: AppLink[] = master ? [
    { href: t("/settings/distribution-test"), label: "Verteilungstest", icon: "sliders" },
    { href: t("/log"), label: "Protokoll", icon: "settings" },
    { href: t("/dashboard"), label: "Dashboard", icon: "home" },
    { href: t("/calendar"), label: "Kalender", icon: "calendar" },
    { href: t("/closings"), label: "Abschlüsse", icon: "chart" },
    { href: t("/settings/distribution"), label: "Verteilung", icon: "sliders" },
    { href: t("/settings/notifications"), label: "Benachrichtigungen", icon: "settings" },
  ] : [
    ...(user.role === "ADMIN" ? [
      { href: t("/settings/users"), label: "Mitglieder", icon: "users" },
      { href: t("/settings/distribution"), label: "Verteilung", icon: "sliders" },
      { href: t("/settings/distribution-test"), label: "Verteilungstest", icon: "sliders" },
      { href: t("/settings/mailbox"), label: "Postfach", icon: "mail" },
      { href: t("/settings/notifications"), label: "Benachrichtigungen", icon: "settings" },
      ...(!localMaster ? [{ href: t("/log"), label: "Protokoll", icon: "settings" }] : []),
    ] : []),
    ...(platformManager && !localMaster ? [
      { href: t("/platform"), label: "Plattformen", icon: "layers" },
      ...(platformAdmin ? [{ href: t("/platform/members"), label: "Plattformmitglieder", icon: "users" }] : []),
    ] : []),
  ];

  return <div className={`app-shell ${master ? "app-shell--master" : "app-shell--tenant"}`}>
    <AppNavigation primary={primary} secondary={secondary} master={master} brand={brand} />
    <div className="shell-content">
      {user.operator && <div className="shell-operator">Du verwaltest <strong>{user.tenant.name}</strong> als {user.displayName}. <Link href={tenantPath(user.homeTenantSlug, "/platform")}>Zurück zur Plattform →</Link></div>}
      <header className="shell-header"><div className="shell-header-title"><span className="shell-eyebrow">{master ? "MASTERBEREICH" : "DEIN ARBEITSBEREICH"}</span><strong>{master ? "Übersicht & Verwaltung" : brand}</strong></div><div className="shell-header-actions"><NotificationBell /><span className="shell-user-name">{user.displayName}</span><form action={logout}><button className="shell-logout">Abmelden</button></form></div></header>
      <PushSetup vapidPublicKey={vapid} />
      <LeadWatcher askPermission={!pushEnabled} />
      <main className="shell-main">{children}</main>
    </div>
  </div>;
}
