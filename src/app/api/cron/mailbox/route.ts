import { isAuthorizedCron } from "@/lib/cron";
import { pollMailbox } from "@/lib/mailbox";

export const maxDuration = 60;

/** Ruft das zentrale Lead-Postfach einmal ab (für Vercel Cron oder einen externen Cron-Dienst). */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  const result = await pollMailbox(new URL(request.url).searchParams.get("reconcile") === "1");
  return Response.json(result, { status: result.ok ? 200 : 503 });
}
