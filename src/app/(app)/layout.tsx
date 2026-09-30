import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { PushSetup } from "@/components/push-setup";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/leads", label: "Leads" },
    ...(user.role === "ADMIN"
      ? [
          { href: "/settings/users", label: "Mitglieder" },
          { href: "/settings/distribution", label: "Verteilung" },
          { href: "/settings/mailbox", label: "Postfach" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="font-semibold text-slate-900">
            Function Concept - Facebook Lead Software
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
