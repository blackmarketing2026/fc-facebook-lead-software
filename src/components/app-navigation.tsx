"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type AppLink = { href: string; label: string; icon: string };

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></>,
    layers: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    leads: <><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5h-3"/><path d="M8 3v5h8V3M8 13h8M8 17h5"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 11a3 3 0 0 0 0-6M17 14a5 5 0 0 1 4 5v1"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    chart: <><path d="M4 20V12M10 20V7M16 20v-9M22 20V4M2 20h20"/></>,
    sliders: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="17" r="2" fill="currentColor"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.settings}</svg>;
}

export function AppNavigation({ primary, secondary, master, brand }: { primary: AppLink[]; secondary: AppLink[]; master: boolean; brand: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [...primary, ...secondary];
  const active = links.filter((item) => pathname === item.href || pathname.startsWith(item.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const linkClass = (href: string) => `shell-nav-link ${active === href ? "is-active" : ""}`;
  const mobilePrimary = primary.slice(0, 4);
  const mobileMore = [...primary.slice(4), ...secondary];

  return <>
    <aside className="shell-sidebar" aria-label="Hauptnavigation">
      <Link href={primary[0].href} className="shell-brand"><span className="shell-brand-mark">{master ? "FC" : brand.slice(0, 1).toUpperCase()}</span><span><strong>{master ? "Function Concept" : brand}</strong><small>{master ? "Master · Verwaltung" : "Dein Leadcenter"}</small></span></Link>
      <div className="shell-sidebar-body"><p className="shell-nav-caption">{master ? "Verwaltung" : "Dein Alltag"}</p><nav className="space-y-1">{primary.map((item) => <Link key={item.href} href={item.href} className={linkClass(item.href)}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
      {secondary.length > 0 && <><p className="shell-nav-caption mt-8">{master ? "Weitere Bereiche" : "Verwalten"}</p><nav className="space-y-1">{secondary.map((item) => <Link key={item.href} href={item.href} className={linkClass(item.href)}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav></>}</div>
      <div className="shell-sidebar-foot"><span className="shell-status-dot"/> {master ? "Masterbereich" : "Plattform aktiv"}</div>
    </aside>
    <div className="shell-mobile-nav" aria-label="Mobile Navigation">
      {mobilePrimary.map((item) => <Link key={item.href} href={item.href} className={`shell-mobile-link ${active === item.href ? "is-active" : ""}`}><Icon name={item.icon} size={21}/><span>{item.label}</span></Link>)}
      {mobileMore.length > 0 && <button type="button" className={`shell-mobile-link ${menuOpen || mobileMore.some((item) => item.href === active) ? "is-active" : ""}`} onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label="Weitere Bereiche"><Icon name="more" size={21}/><span>Mehr</span></button>}
    </div>
    {menuOpen && <div className="shell-mobile-menu"><div className="shell-mobile-menu-head"><strong>Weitere Bereiche</strong><button type="button" onClick={() => setMenuOpen(false)} aria-label="Menü schließen">✕</button></div><nav>{mobileMore.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={linkClass(item.href)}><Icon name={item.icon}/>{item.label}</Link>)}</nav></div>}
  </>;
}
