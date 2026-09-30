import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db } from "../lib/db";
import { processInboundMail } from "../lib/lead-service";

const SEEN_FLAG = String.raw`\Seen`;
const PROCESSED_FOLDER = process.env.IMAP_PROCESSED_FOLDER || "Verarbeitet";

export function imapConfigured(): boolean {
  const { IMAP_HOST, IMAP_USER, IMAP_PASS } = process.env;
  return Boolean(IMAP_HOST && IMAP_USER && IMAP_PASS && !IMAP_HOST.startsWith("PLATZHALTER"));
}

async function setStatus(value: string) {
  await db.setting.upsert({
    where: { key: "imap.lastRun" },
    create: { key: "imap.lastRun", value },
    update: { value },
  });
}

/** Ruft alle ungelesenen Mails ab und legt daraus Leads an. */
export async function pollMailbox(): Promise<void> {
  if (!imapConfigured()) {
    await setStatus(JSON.stringify({ at: new Date().toISOString(), ok: false, message: "IMAP nicht konfiguriert (Platzhalter in .env)" }));
    return;
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
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = (await client.search({ seen: false }, { uid: true })) || [];
      if (uids.length > 0) {
        // Erst alles laden, dann verarbeiten: während fetch() sind keine anderen IMAP-Befehle erlaubt.
        const messages: { uid: number; source: Buffer }[] = [];
        for await (const msg of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
          if (msg.source) messages.push({ uid: msg.uid, source: msg.source });
        }

        const done: number[] = [];
        const seenOnly: number[] = [];
        for (const { uid, source } of messages) {
          const mail = await simpleParser(source);
          const result = await processInboundMail({
            messageId: mail.messageId || `uid-${uid}-${mail.date?.getTime() ?? Date.now()}`,
            from: mail.from?.text,
            subject: mail.subject,
            receivedAt: mail.date ?? new Date(),
            text: mail.text ?? "",
            html: typeof mail.html === "string" ? mail.html : null,
          });
          if (result.status === "PROCESSED") {
            processed++;
            done.push(uid);
          } else if (result.status === "IGNORED") {
            ignored++;
            seenOnly.push(uid);
          } else if (result.status === "DUPLICATE") {
            seenOnly.push(uid);
          }
          // FAILED bleibt ungelesen im Posteingang, damit nichts verloren geht.
        }

        if (done.length > 0) {
          await client.messageFlagsAdd(done, [SEEN_FLAG], { uid: true });
          try {
            await client.mailboxCreate(PROCESSED_FOLDER).catch(() => {});
            await client.messageMove(done, PROCESSED_FOLDER, { uid: true });
          } catch (err) {
            console.warn("[imap] Verschieben nach", PROCESSED_FOLDER, "fehlgeschlagen:", (err as Error).message);
          }
        }
        // Mails ohne Lead als gelesen markieren, damit sie nicht jedes Mal neu geprüft werden.
        if (seenOnly.length > 0) await client.messageFlagsAdd(seenOnly, [SEEN_FLAG], { uid: true });
      }
    } finally {
      lock.release();
    }
    await client.logout();
    await setStatus(JSON.stringify({ at: new Date().toISOString(), ok: true, processed, ignored }));
    if (processed || ignored) console.log(`[imap] ${processed} Leads angelegt, ${ignored} Mails ignoriert`);
  } catch (err) {
    console.error("[imap] Fehler:", (err as Error).message);
    await setStatus(JSON.stringify({ at: new Date().toISOString(), ok: false, message: (err as Error).message }));
    client.close();
  }
}
