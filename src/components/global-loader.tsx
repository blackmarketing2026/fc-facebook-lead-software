"use client";

import { useEffect, useState } from "react";

// Erst nach dieser Zeit erscheint die Anzeige, damit schnelle Klicks nicht flackern.
const SHOW_DELAY_MS = 300;
// Nur Anfragen kurz nach einem Klick/Enter zählen – Hintergrund-Refreshs (LeadWatcher) bleiben unsichtbar.
const INTERACTION_WINDOW_MS = 1500;
// Sicherheitsnetz, falls eine Navigation nie abschließt.
const MAX_MS = 20_000;

function headersOf(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

// Next.js schickt Seitenwechsel als RSC-Anfrage und Server-Actions mit dem Header "next-action".
function isRouterRequest(headers: Headers) {
  if (headers.has("next-action")) return true;
  return headers.has("rsc") && !headers.has("next-router-prefetch");
}

function isClientNavigation(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return false;
  // Reine Sprungmarken auf derselben Seite laden nichts.
  return url.pathname !== location.pathname || url.search !== location.search;
}

export function GlobalLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let lastInteraction = 0;
    let inflight = 0;
    let navFrom: string | null = null;
    let navStarted = 0;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let navPoll: ReturnType<typeof setInterval> | undefined;

    const update = () => {
      if (inflight > 0 || navFrom !== null) {
        showTimer ??= setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      } else {
        clearTimeout(showTimer);
        showTimer = undefined;
        setVisible(false);
      }
    };

    const markInteraction = () => {
      lastInteraction = Date.now();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") markInteraction();
    };

    const onClick = (e: MouseEvent) => {
      if (!isClientNavigation(e)) return;
      navFrom = location.href;
      navStarted = Date.now();
      clearInterval(navPoll);
      // Der App-Router setzt die neue URL erst, wenn die Zielseite angezeigt wird.
      navPoll = setInterval(() => {
        if (location.href !== navFrom || Date.now() - navStarted > MAX_MS) {
          navFrom = null;
          clearInterval(navPoll);
          update();
        }
      }, 100);
      update();
    };

    const originalFetch = window.fetch;
    const patchedFetch: typeof window.fetch = (input, init) => {
      const track =
        Date.now() - lastInteraction < INTERACTION_WINDOW_MS && isRouterRequest(headersOf(input, init));
      if (!track) return originalFetch(input, init);
      inflight++;
      update();
      return originalFetch(input, init).finally(() => {
        inflight--;
        update();
      });
    };
    window.fetch = patchedFetch;

    document.addEventListener("pointerdown", markInteraction, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("submit", markInteraction, true);
    // Bubble-Phase: so ist ein evtl. preventDefault() von <Link> schon gelaufen.
    document.addEventListener("click", onClick);

    return () => {
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
      document.removeEventListener("pointerdown", markInteraction, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("submit", markInteraction, true);
      document.removeEventListener("click", onClick);
      clearTimeout(showTimer);
      clearInterval(navPoll);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px]">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-slate-200"
      >
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        Lädt …
      </div>
    </div>
  );
}
