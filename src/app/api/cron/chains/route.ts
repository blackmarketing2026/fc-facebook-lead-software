import { processChains } from "@/lib/chains";
import { isAuthorizedCron } from "@/lib/cron";

export const maxDuration = 60;

/** Verarbeitet fällige E-Mail-Ketten (Aufruf wie bei den anderen Cron-Routen, minütlich). */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  return Response.json({ ok: true, ...(await processChains()) });
}
