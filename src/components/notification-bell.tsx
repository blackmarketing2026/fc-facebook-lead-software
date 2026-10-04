"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = {
  id: string;
  kind: "reminder" | "lead";
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  overdue?: boolean;
  dueAt?: string;
};
type Data = { count: number; items: Item[] };

const SEEN_KEY = "lc-seen-reminders";

/** Bereits gemeldete Termine merken, damit der Hinweis pro Termin nur einmal kommt (auch über Seitenwechsel). */
function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    // ohne Speicher kommt der Hinweis nach einem Neuladen eben noch einmal
  }
}

async function showDesktopNotification(item: Item) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body: `${item.title} – ${item.subtitle}`,
    // Gleicher Tag wie die Push-Nachricht – so erscheint die Meldung nicht doppelt.
    tag: `reminder-${item.id}`,
    data: { url: item.href },
    requireInteraction: true,
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification("Termin steht an", options);
  } catch {
    // weiter mit der einfachen Variante
  }
  const n = new Notification("Termin steht an", options);
  n.onclick = () => {
    window.focus();
    window.location.href = item.href;
  };
}

export function NotificationBell() {
  const { tenant } = useParams<{ tenant: string }>();
  const [data, setData] = useState<Data>({ count: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Item[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const seen = loadSeen();
    const load = async () => {
      try {
        const res = await fetch(`/${tenant}/api/notifications`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next: Data = await res.json();
        setData(next);
        // Termine, die gerade in das Erinnerungsfenster (30 Min.) gerutscht sind: Hinweis + Desktop-Meldung.
        const upcoming = next.items.filter((i) => i.kind === "reminder" && !i.overdue && !seen.has(i.id));
        if (upcoming.length > 0) {
          upcoming.forEach((i) => seen.add(i.id));
          saveSeen(seen);
          setToasts((t) => [...upcoming, ...t].slice(0, 5));
          for (const item of upcoming) await showDesktopNotification(item);
        }
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

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

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
                      <span>{item.icon}</span>
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

      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
          {toasts.map((item) => (
            <div key={item.id} className="card flex items-start gap-3 border-l-4 border-l-amber-500 p-3 text-sm">
              <span className="text-lg leading-none">{item.icon}</span>
              <Link href={item.href} onClick={() => dismiss(item.id)} className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Termin steht an</div>
                <div className="font-medium text-blue-700 hover:underline">{item.title}</div>
                <div className="text-xs text-slate-500">{item.subtitle} · Lead jetzt kontaktieren</div>
              </Link>
              <button className="text-slate-400 hover:text-slate-700" aria-label="Schließen" onClick={() => dismiss(item.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
