"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavLink = { href: string; label: string };

/** `more`: selten genutzte Punkte, die hinter einem aufklappbaren „Mehr“-Menü liegen. */
export function NavLinks({ links, more = [] }: { links: NavLink[]; more?: NavLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menü schließen bei Klick daneben und Escape (bei Klick auf einen Eintrag direkt am Link).
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nur der genaueste Treffer ist aktiv (z. B. /platform/members statt zusätzlich /platform).
  const activeHref = [...links, ...more]
    .filter((l) => pathname === l.href || pathname.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const itemClass = (active: boolean) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`;
  const moreActive = more.some((l) => l.href === activeHref);

  return (
    <div className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto">
      <nav className="flex gap-1 overflow-x-auto">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={itemClass(l.href === activeHref)}>
            {l.label}
          </Link>
        ))}
      </nav>
      {more.length > 0 && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            className={itemClass(moreActive)}
          >
            Mehr <span className={`inline-block text-xs transition ${open ? "rotate-180" : ""}`}>▾</span>
          </button>
          {open && (
            <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg sm:left-0 sm:right-auto">
              {more.map((l) => (
                <Link key={l.href} href={l.href} role="menuitem" onClick={() => setOpen(false)} className={`block ${itemClass(l.href === activeHref)}`}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
