import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { LeadWatcher } from "@/components/lead-watcher";
import { NavLinks } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { PushSetup } from "@/components/push-setup";
import { getPlatformAdmin, requireUser } from "@/lib/session";
import { displayName } from "@/lib/tenant";
import { PLATFORM_TENANT_SLUG, tenantPath } from "@/lib/tenant-paths";

export default async function AppLayout({ children }: LayoutProps<"/[tenant]">) {
  const user = await requireUser();
  const platformAdmin = await getPlatformAdmin();
  const t = (path: string) => tenantPath(user.tenant.slug, path);
  // Ist Push eingerichtet, fragt schon PushSetup nach der Erlaubnis für Benachrichtigungen.
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const pushEnabled = Boolean(vapid) && !vapid.startsWith("PLATZHALTER");
  const links = [
    { href: t("/dashboard"), label: "Dashboard" },
    { href: t("/leads"), label: "Leads" },
    ...(user.role === "ADMIN"
      ? [
          { href: t("/settings/users"), label: "Mitglieder" },
          { href: t("/settings/distribution"), label: "Verteilung" },
          { href: t("/settings/mailbox"), label: "Postfach" },
          { href: t("/log"), label: "Log" },
        ]
      : []),
    ...(platformAdmin ? [{ href: t("/platform"), label: "Plattform" }] : []),
  ];

  return (
    <div className="min-h-screen">
      {user.operator && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Plattform-Zugriff als Function Concept ({user.displayName}) im Dashboard <strong>{user.tenant.name}</strong>
          {user.tenant.status === "SUSPENDED" && " · Dashboard ist gesperrt"}
          {user.tenant.isDevelopment && " · Entwicklungs-Mandant"}
          <Link href={tenantPath(PLATFORM_TENANT_SLUG, "/platform")} className="ml-3 font-medium underline">
            Zurück zur Plattform
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={t("/dashboard")} className="font-semibold text-slate-900">
            {displayName(user.tenant)}
          </Link>
          <NavLinks links={links} />
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <span className="hidden text-sm text-slate-600 sm:inline">
              {user.displayName}
              {user.role === "ADMIN" && <span className="ml-1 text-xs text-slate-400">(Admin)</span>}
            </span>
            <form action={logout}>
              <button className="btn-secondary py-1.5">Abmelden</button>
            </form>
          </div>
        </div>
      </header>
      <PushSetup vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      <LeadWatcher askPermission={!pushEnabled} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
