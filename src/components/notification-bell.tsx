"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = { id: string; kind: "reminder" | "lead"; title: string; subtitle: string; href: string; overdue?: boolean };
type Data = { count: number; items: Item[] };

export function NotificationBell() {
  const { tenant } = useParams<{ tenant: string }>();
  const [data, setData] = useState<Data>({ count: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/${tenant}/api/notifications`, { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {
        // Netzwerkfehler ignorieren, nächster Versuch in 30 s
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tenant]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Benachrichtigungen"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {data.count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {data.count > 99 ? "99+" : data.count}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium">Benachrichtigungen</div>
          {data.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Alles erledigt 🎉</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.items.map((item) => (
                <li key={item.kind + item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{item.kind === "reminder" ? "📞" : "✨"}</span>
                      <span className="truncate">{item.title}</span>
                    </div>
                    <div className={`text-xs ${item.overdue ? "text-red-600" : "text-slate-500"}`}>{item.subtitle}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
