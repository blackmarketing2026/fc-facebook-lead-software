import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { db } from "./db";
import { processInboundMail } from "./lead-service";

const SEEN_FLAG = String.raw`\Seen`;
const PROCESSED_FOLDER = process.env.IMAP_PROCESSED_FOLDER || "Verarbeitet";
const MAX_MESSAGES_PER_POLL = 5;

type PollResult =
  | { ok: true; processed: number; ignored: number; deleted: number; remaining?: number }
  | { ok: false; message: string };

function imapErrorMessage(error: unknown): string {
  const response = (error as { response?: unknown })?.response;
  if (typeof response === "string" && /AUTHENTICATIONFAILED|authentication failed/i.test(response)) {
    return "IMAP-Anmeldung fehlgeschlagen. Benutzername und Passwort des Postfachs prüfen.";
  }
  return error instanceof Error ? error.message : "Unbekannter IMAP-Fehler";
}

export function imapConfigured(): boolean {
  const { IMAP_HOST, IMAP_USER, IMAP_PASS } = process.env;
  return Boolean(IMAP_HOST && IMAP_USER && IMAP_PASS && !IMAP_HOST.startsWith("PLATZHALTER"));
}

function addressText(value: AddressObject | AddressObject[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((a) => a.text);
}

/**
 * Alle Empfänger einer Mail. Leitet ein Alias (z. B. martin@…) ins zentrale Postfach weiter,
 * steht die ursprüngliche Adresse meist in To, Delivered-To oder X-Original-To.
 */
function recipients(mail: ParsedMail): string {
  const headerValues = ["delivered-to", "x-original-to", "envelope-to"].flatMap((h) => {
    const v = mail.headers.get(h);
    if (!v) return [];
    return (Array.isArray(v) ? v : [v]).map((x) => (typeof x === "string" ? x : (x as AddressObject).text ?? String(x)));
  });
  return [...addressText(mail.to), ...addressText(mail.cc), ...headerValues].join(", ");
}

async function setStatus(value: string) {
  await db.setting.upsert({
    where: { key: "imap.lastRun" },
    create: { key: "imap.lastRun", value },
    update: { value },
  });
}

/** Ruft neue Mails ab; reconcile gleicht auch gelesene Mails und den alten Ordner ab. */
export async function pollMailbox(reconcile = false): Promise<PollResult> {
  if (!imapConfigured()) {
    const message = "IMAP nicht konfiguriert (Platzhalter in .env)";
    await setStatus(JSON.stringify({ at: new Date().toISOString(), ok: false, message }));
    return { ok: false, message };
  }

  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE !== "false",
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASS! },
    logger: false,
  });

  let processed = 0;
  let ignored = 0;
  let deleted = 0;
  let remaining = 0;
  try {
    await client.connect();
    if (!client.capabilities.has("UIDPLUS")) throw new Error("IMAP-Server unterstuetzt kein gezieltes Loeschen per UIDPLUS");

    for (const folder of new Set(reconcile ? ["INBOX", PROCESSED_FOLDER] : ["INBOX"])) {
      const lock = await client.getMailboxLock(folder);
      try {
        // Pro Lauf nur wenige Mails bearbeiten, damit der Cron-Aufruf sein Zeitlimit einhaelt.
        const uids = ((await client.search(reconcile ? { all: true } : { seen: false }, { uid: true })) || []).slice(0, MAX_MESSAGES_PER_POLL);
        if (uids.length === 0) continue;
        // Waehrend fetch() sind keine weiteren IMAP-Befehle erlaubt.
        const messages: { uid: number; source: Buffer }[] = [];
        for await (const msg of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
          if (msg.source) messages.push({ uid: msg.uid, source: msg.source });
        }

        for (const { uid, source } of messages) {
          const mail = await simpleParser(source);
          const messageId = mail.messageId || `uid-${uid}-${mail.date?.getTime() ?? 0}`;
          const existing = await db.inboundEmail.findUnique({
            where: { messageId },
            select: { status: true, lead: { select: { id: true } } },
          });
          if (existing?.status === "PROCESSED" && existing.lead) {
            if (!(await client.messageDelete(uid, { uid: true }))) throw new Error(`IMAP-Mail ${uid} konnte nicht geloescht werden`);
            deleted++;
            continue;
          }
          if (existing) {
            if (!reconcile && existing.status === "IGNORED") await client.messageFlagsAdd(uid, [SEEN_FLAG], { uid: true });
            continue;
          }

          const result = await processInboundMail({
            messageId,
            from: mail.from?.text,
            to: recipients(mail),
            subject: mail.subject,
            receivedAt: mail.date ?? new Date(),
            text: mail.text ?? "",
            html: typeof mail.html === "string" ? mail.html : null,
          });
          if (result.status === "PROCESSED") {
            processed++;
            if (!(await client.messageDelete(uid, { uid: true }))) throw new Error(`IMAP-Mail ${uid} konnte nicht geloescht werden`);
            deleted++;
          } else if (result.status === "IGNORED") {
            ignored++;
            if (!reconcile) await client.messageFlagsAdd(uid, [SEEN_FLAG], { uid: true });
          } else if (result.status === "DUPLICATE") {
            // Ein paralleler Abruf kann den Lead inzwischen angelegt haben.
            const saved = await db.inboundEmail.findUnique({
              where: { messageId },
              select: { status: true, lead: { select: { id: true } } },
            });
            if (saved?.status === "PROCESSED" && saved.lead) {
              if (!(await client.messageDelete(uid, { uid: true }))) throw new Error(`IMAP-Mail ${uid} konnte nicht geloescht werden`);
              deleted++;
            }
          }
          // FAILED bleibt im Postfach, damit kein Lead verloren geht.
        }
        if (reconcile) remaining += ((await client.search({ all: true }, { uid: true })) || []).length;
      } finally {
        lock.release();
      }
    }
    await client.logout();
    await setStatus(JSON.stringify({ at: new Date().toISOString(), ok: true, processed, ignored, deleted }));
    if (processed || ignored || deleted) console.log(`[imap] ${processed} Leads angelegt, ${ignored} Mails ignoriert, ${deleted} Mails geloescht`);
    return { ok: true, processed, ignored, deleted, ...(reconcile ? { remaining } : {}) };
  } catch (err) {
    const message = imapErrorMessage(err);
    console.error("[imap] Fehler:", message);
    await setStatus(JSON.stringify({ at: new Date().toISOString(), ok: false, message }));
    client.close();
    return { ok: false, message };
  }
}
