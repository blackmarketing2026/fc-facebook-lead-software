"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NewLead = { id: string; name: string | null; href: string };

const POLL_MS = 15_000;

/** Kurzer Zwei-Ton-Gong über Web Audio (keine Audiodatei nötig). */
function playChime(ctx: AudioContext) {
  const start = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = start + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

async function showDesktopNotification(lead: NewLead) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = "Neuer Lead";
  const options: NotificationOptions = {
    body: lead.name ? `Neuer Lead: ${lead.name}` : "Ein neuer Lead ist eingegangen",
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
 * Schaut regelmäßig nach neuen Leads. Kommt einer, aktualisiert sich die Seite, es gibt eine
 * Desktop-Benachrichtigung, einen Hinweis in der Seite und einen Ton.
 */
export function LeadWatcher({ askPermission: offerPermission }: { askPermission: boolean }) {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const [toasts, setToasts] = useState<NewLead[]>([]);
  const [askPermission, setAskPermission] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  // Browser spielen Töne erst nach einer Interaktion ab – beim ersten Klick/Tastendruck freischalten.
  useEffect(() => {
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    // Erst nach dem ersten Rendern zeigen (Notification gibt es nur im Browser).
    const ask = setTimeout(() => {
      if (offerPermission && "Notification" in window && Notification.permission === "default") setAskPermission(true);
    });
    return () => {
      clearTimeout(ask);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
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
        setToasts((t) => [...data.leads, ...t].slice(0, 5));
        if (audio.current?.state === "running") playChime(audio.current);
        for (const lead of data.leads) await showDesktopNotification(lead);
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

  if (toasts.length === 0 && !askPermission) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
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
        <div key={lead.id} className="card flex items-center gap-3 border-l-4 border-l-blue-600 p-3 text-sm">
          <span>✨</span>
          <Link href={lead.href} className="flex-1 font-medium text-blue-700 hover:underline" onClick={() => setToasts((t) => t.filter((x) => x.id !== lead.id))}>
            Neuer Lead: {lead.name ?? "Unbekannt"}
          </Link>
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
