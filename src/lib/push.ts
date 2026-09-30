import webpush from "web-push";
import { db } from "./db";

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || pub.startsWith("PLATZHALTER") || priv.startsWith("PLATZHALTER")) {
    console.warn("[push] VAPID-Schlüssel fehlen – Push-Benachrichtigungen sind deaktiviert");
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };

/** Schickt eine Push-Nachricht an alle registrierten Browser eines Benutzers. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<number> {
  if (!configure()) return 0;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          JSON.stringify(message),
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // Abgelaufene Subscriptions entfernen.
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[push] Fehler beim Senden", status, (err as Error).message);
        }
      }
    }),
  );
  return sent;
}
