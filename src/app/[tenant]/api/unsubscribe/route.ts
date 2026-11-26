import { verifyUnsubscribe } from "@/lib/chain-logic";
import { db } from "@/lib/db";

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Arial,sans-serif;background:#f1f5f9;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center"><main style="background:#fff;max-width:420px;margin:16px;padding:32px;border-radius:12px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)"><h1 style="font-size:20px;margin:0 0 12px">${title}</h1>${body}</main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function params(request: Request) {
  const url = new URL(request.url);
  return { leadId: url.searchParams.get("l") ?? "", token: url.searchParams.get("t") ?? "" };
}

/** Bestätigungsseite: Der Abmelde-Link in der Mail meldet erst nach Klick auf den Button ab (Link-Scanner lösen ihn so nicht aus). */
export async function GET(request: Request) {
  const { leadId, token } = params(request);
  if (!leadId || !verifyUnsubscribe(leadId, token)) return page("Link ungültig", "<p>Dieser Abmelde-Link ist ungültig.</p>", 400);
  return page(
    "Vom E-Mail-Verteiler abmelden?",
    `<p style="color:#475569">Du bekommst danach keine weiteren E-Mails mehr von uns.</p><form method="post"><button style="background:#d97706;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px;cursor:pointer">Ja, abmelden</button></form>`,
  );
}

/** Führt die Abmeldung aus (Button auf der Seite oder One-Click-Abmeldung des Mailprogramms). */
export async function POST(request: Request) {
  const { leadId, token } = params(request);
  if (!leadId || !verifyUnsubscribe(leadId, token)) return page("Link ungültig", "<p>Dieser Abmelde-Link ist ungültig.</p>", 400);
  const changed = await db.lead.updateMany({ where: { id: leadId, emailOptOut: false }, data: { emailOptOut: true, emailOptOutAt: new Date() } });
  if (changed.count) await db.activity.create({ data: { leadId, type: "UNSUBSCRIBED", meta: { via: "link" } } });
  await db.chainRun.updateMany({ where: { leadId, status: "ACTIVE" }, data: { status: "CANCELLED", nextRunAt: null, finishedAt: new Date() } });
  return page("Du wurdest abgemeldet", `<p style="color:#475569">Du bekommst keine weiteren E-Mails mehr von uns.</p>`);
}
