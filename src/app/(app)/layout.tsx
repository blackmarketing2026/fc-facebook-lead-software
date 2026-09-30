import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { PushSetup } from "@/components/push-setup";
import { getPlatformAdmin, requireUser } from "@/lib/session";
import { displayName } from "@/lib/tenant";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const platformAdmin = await getPlatformAdmin();
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/leads", label: "Leads" },
    ...(user.role === "ADMIN"
      ? [
          { href: "/settings/users", label: "Mitglieder" },
          { href: "/settings/distribution", label: "Verteilung" },
          { href: "/settings/mailbox", label: "Postfach" },
          { href: "/settings/domain", label: "Domain" },
        ]
      : []),
    ...(platformAdmin ? [{ href: "/platform", label: "Plattform" }] : []),
  ];

  return (
    <div className="min-h-screen">
      {user.operator && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Plattform-Zugriff als Function Concept ({user.displayName}) im Dashboard <strong>{user.tenant.name}</strong>
          {user.tenant.status === "SUSPENDED" && " · Dashboard ist gesperrt"}
          {user.tenant.isDevelopment && " · Entwicklungs-Mandant"}
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="font-semibold text-slate-900">
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
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
