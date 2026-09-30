import { checkReminders } from "./reminders";
import { imapConfigured, pollMailbox } from "./imap";

const IMAP_INTERVAL = Number(process.env.IMAP_POLL_SECONDS || 60) * 1000;
const REMINDER_INTERVAL = 60 * 1000;

/** Führt eine Aufgabe periodisch aus, ohne dass sich Läufe überlappen. */
function every(name: string, ms: number, task: () => Promise<void>) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await task();
    } catch (err) {
      console.error(`[worker:${name}]`, err);
    } finally {
      running = false;
    }
  };
  void run();
  setInterval(run, ms);
}

console.log("[worker] gestartet");
if (!imapConfigured()) console.warn("[worker] IMAP-Zugang fehlt (Platzhalter) – Postfach-Abruf läuft im Leerlauf");
every("imap", IMAP_INTERVAL, pollMailbox);
every("reminders", REMINDER_INTERVAL, checkReminders);
