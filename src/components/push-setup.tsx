"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe(vapidPublicKey: string) {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

/** Registriert den Service Worker und zeigt einen Hinweis, bis Push erlaubt wurde. */
export function PushSetup({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<"hidden" | "ask" | "denied">("hidden");
  const enabled = vapidPublicKey && !vapidPublicKey.startsWith("PLATZHALTER");

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    let alive = true;
    (async () => {
      await navigator.serviceWorker.register("/sw.js");
      if (Notification.permission === "granted") {
        await subscribe(vapidPublicKey);
      } else if (Notification.permission === "default" && alive) {
        setState("ask");
      }
    })().catch((e) => console.warn("Push-Anmeldung fehlgeschlagen", e));
    return () => {
      alive = false;
    };
  }, [enabled, vapidPublicKey]);

  if (state === "hidden") return null;

  return (
    <div className="border-b border-blue-100 bg-blue-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm text-blue-900">
        {state === "ask" ? (
          <>
            <span>Aktiviere Browser-Benachrichtigungen für neue Leads und Rückruf-Erinnerungen.</span>
            <button
              className="btn-primary py-1"
              onClick={async () => {
                const perm = await Notification.requestPermission();
                if (perm === "granted") {
                  await subscribe(vapidPublicKey).catch((e) => console.warn(e));
                  setState("hidden");
                } else {
                  setState("denied");
                }
              }}
            >
              Aktivieren
            </button>
            <button className="text-blue-700 underline" onClick={() => setState("hidden")}>
              Später
            </button>
          </>
        ) : (
          <span>Benachrichtigungen wurden blockiert. Du kannst sie in den Browser-Einstellungen wieder erlauben.</span>
        )}
      </div>
    </div>
  );
}
