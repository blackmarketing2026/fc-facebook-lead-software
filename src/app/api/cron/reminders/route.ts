import { processChains } from "@/lib/chains";
import { isAuthorizedCron } from "@/lib/cron";
import { checkReminders } from "@/worker/reminders";

export const maxDuration = 60;

/** Verschickt fällige Rückruf-Erinnerungen (für Vercel Cron oder einen externen Cron-Dienst). */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  await checkReminders();
  await processChains().catch((err) => console.error("[chains]", err));
  return Response.json({ ok: true });
}
