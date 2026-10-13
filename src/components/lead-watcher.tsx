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

const POLL_MS = 15_000;

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
        setToasts((t) => [...data.leads, ...t.filter((x) => !data.leads.some((l) => l.id === x.id))].slice(0, 5));
        const incoming = data.leads.filter((l) => l.kind !== "unassigned");
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

  if (toasts.length === 0 && !askPermission && !soundOff) return null;

  return (
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
  );
}
