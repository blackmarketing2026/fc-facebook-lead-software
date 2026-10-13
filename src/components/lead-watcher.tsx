"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { audioReady, onAudioChange, playChime, unlockAudio } from "@/lib/chime";

type NewLead = { id: string; name: string | null; href: string; kind: "new" | "assigned" | "unassigned" };

function headline(lead: NewLead) {
  const name = lead.name ?? "Unbekannt";
  if (lead.kind === "assigned") return `Lead zugewiesen: ${name}`;
  if (lead.kind === "unassigned") return `Lead neu zugewiesen: ${name}`;
  return `Neuer Lead: ${name}`;
}

// Nicht öfter: jede Abfrage braucht eine der wenigen Datenbankverbindungen.
const POLL_MS = 20_000;

async function showDesktopNotification(lead: NewLead) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = lead.kind === "assigned" ? "Lead zugewiesen" : "Neuer Lead";
  const options: NotificationOptions = {
    body:
      lead.kind === "assigned"
        ? `${lead.name ?? "Ein Lead"} wurde dir zugewiesen`
        : lead.name
          ? `Neuer Lead: ${lead.name}`
          : "Ein neuer Lead ist eingegangen",
    // Gleicher Tag wie die Push-Nachricht – so erscheint die Meldung nicht doppelt.
    tag: `lead-${lead.id}`,
    data: { url: lead.href },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(title, options);
  } catch {
    // weiter mit der einfachen Variante
  }
  const n = new Notification(title, options);
  n.onclick = () => {
    window.focus();
    window.location.href = lead.href;
  };
}

/**
 * Schaut regelmäßig nach neuen und neu zugewiesenen Leads. Kommt einer, aktualisiert sich die Seite, es gibt eine
 * Desktop-Benachrichtigung, einen Hinweis in der Seite und einen Ton. Wurde einem ein Lead weggenommen, lädt die
 * Seite nur neu und zeigt einen Hinweis.
 */
export function LeadWatcher({ askPermission: offerPermission }: { askPermission: boolean }) {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const [toasts, setToasts] = useState<NewLead[]>([]);
  // Neue und zugewiesene Leads erscheinen als Popup, das man selbst schließen muss.
  const [popup, setPopup] = useState<NewLead[]>([]);
  const [askPermission, setAskPermission] = useState(false);
  const [soundOff, setSoundOff] = useState(false);

  useEffect(() => {
    // Erst nach dem ersten Rendern zeigen (Notification und Audio gibt es nur im Browser).
    const ask = setTimeout(() => {
      if (offerPermission && "Notification" in window && Notification.permission === "default") setAskPermission(true);
      setSoundOff(!audioReady());
    }, 1500);
    const off = onAudioChange(() => setSoundOff(!audioReady()));
    return () => {
      clearTimeout(ask);
      off();
    };
  }, [offerPermission]);

  useEffect(() => {
    let alive = true;
    let since: string | null = null;
    const check = async () => {
      try {
        const res = await fetch(`/${tenant}/api/leads/new${since ? `?since=${encodeURIComponent(since)}` : ""}`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data: { now: string; leads: NewLead[] } = await res.json();
        since = data.now;
        if (data.leads.length === 0) return;
        router.refresh();
        const incoming = data.leads.filter((l) => l.kind !== "unassigned");
        const removed = data.leads.filter((l) => l.kind === "unassigned");
        const ids = new Set(data.leads.map((l) => l.id));
        setPopup((p) => [...incoming, ...p.filter((x) => !ids.has(x.id))].slice(0, 10));
        setToasts((t) => [...removed, ...t.filter((x) => !ids.has(x.id))].slice(0, 5));
        if (incoming.length > 0) playChime("lead");
        for (const lead of incoming) await showDesktopNotification(lead);
      } catch {
        // Netzwerkfehler ignorieren, nächster Versuch im nächsten Intervall
      }
    };
    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tenant, router]);

  const closePopup = () => setPopup([]);

  return (
    <>
      {popup.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="lead-popup-title" className="card w-full max-w-md p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">{popup.some((l) => l.kind === "new") ? "✨" : "📥"}</span>
              <h2 id="lead-popup-title" className="text-lg font-semibold">
                {popup.length === 1
                  ? popup[0].kind === "assigned"
                    ? "Dir wurde ein Lead zugewiesen"
                    : "Neuer Lead eingegangen"
                  : `${popup.length} neue Leads für dich`}
              </h2>
            </div>
            <ul className="mb-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {popup.map((lead) => (
                <li key={lead.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="flex-1">
                    <span className="block font-medium">{lead.name ?? "Unbekannt"}</span>
                    <span className="text-xs text-slate-500">{lead.kind === "assigned" ? "Zugewiesen" : "Neuer Lead"}</span>
                  </span>
                  <Link href={lead.href} onClick={closePopup} className="btn-primary px-3 py-1.5 text-xs">
                    Öffnen
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button type="button" onClick={closePopup} className="btn-secondary" autoFocus>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
      {(toasts.length > 0 || askPermission || soundOff) && (
        <div className="fixed bottom-4 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
          {soundOff && (
            <button type="button" onClick={unlockAudio} className="card flex items-center gap-3 p-3 text-left text-sm hover:bg-slate-50">
              <span>🔔</span>
              <span className="flex-1">Hinweiston bei neuen Benachrichtigungen einschalten</span>
            </button>
          )}
          {askPermission && (
            <div className="card flex items-center gap-3 p-3 text-sm">
              <span className="flex-1">Bei neuen Leads benachrichtigen?</span>
              <button
                className="btn-primary px-2 py-1 text-xs"
                onClick={async () => {
                  await Notification.requestPermission();
                  setAskPermission(false);
                }}
              >
                Erlauben
              </button>
              <button className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setAskPermission(false)}>
                Später
              </button>
            </div>
          )}
          {toasts.map((lead) => (
            <div
              key={lead.id}
              className={`card flex items-center gap-3 border-l-4 p-3 text-sm ${lead.kind === "unassigned" ? "border-l-slate-400" : "border-l-blue-600"}`}
            >
              <span>{lead.kind === "new" ? "✨" : lead.kind === "assigned" ? "📥" : "↪"}</span>
              {lead.kind === "unassigned" ? (
                <span className="flex-1 text-slate-700">{headline(lead)} – nicht mehr bei dir</span>
              ) : (
                <Link href={lead.href} className="flex-1 font-medium text-blue-700 hover:underline" onClick={() => setToasts((t) => t.filter((x) => x.id !== lead.id))}>
                  {headline(lead)}
                </Link>
              )}
              <button
                className="text-slate-400 hover:text-slate-700"
                aria-label="Schließen"
                onClick={() => setToasts((t) => t.filter((x) => x.id !== lead.id))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
