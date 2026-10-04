import { db } from "./db";
import { formatDateTime } from "./format";
import { isContactKey } from "./lead-parser";
import { escapeHtml, parseEmailList, sendMail } from "./mailer";
import { PLATFORM_TENANT_SLUG, PRODUCT_NAME, tenantPath } from "./tenant-paths";

export type LeadMailData = {
  id: string;
  fullName: string | null;
  receivedAt: Date;
  assignedTo: string | null;
  /** Formular-Antworten; Kontaktfelder (Name, Telefon, E-Mail) werden beim Bauen der Mail herausgefiltert. */
  answers?: { questionKey: string; questionLabel: string; answers: unknown }[];
};

/** Öffentliche Adresse: APP_URL, sonst die Produktions-Domain, die Vercel automatisch setzt. */
function absoluteUrl(path: string) {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = process.env.APP_URL || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path}`;
}

/**
 * Mail zu einem neuen Lead. Telefon und E-Mail des Leads stehen bewusst nie drin – die gibt es nur im Dashboard.
 * personal: Mail an den zugewiesenen Vertriebler ("für dich", mit Formular-Antworten).
 */
export function buildLeadMail(tenant: { slug: string; name: string }, lead: LeadMailData, personal = false) {
  // Wie displayName() aus tenant.ts – das ist "server-only" und läuft nicht im Worker.
  const dashboardName = tenant.slug === PLATFORM_TENANT_SLUG ? PRODUCT_NAME : tenant.name;
  const leadUrl = absoluteUrl(tenantPath(tenant.slug, `/leads/${lead.id}`));
  const dashboardUrl = absoluteUrl(tenantPath(tenant.slug, "/dashboard"));
  const name = lead.fullName || "Unbekannt";
  const heading = personal ? `Neuer Lead für dich: ${name}` : `Neuer Lead: ${name}`;
  const rows: [string, string][] = [
    ["Name", name],
    ["Eingang", formatDateTime(lead.receivedAt)],
    ...(personal ? [] : [["Zugewiesen an", lead.assignedTo || "Niemand (kein aktiver Vertriebler)"] as [string, string]]),
    ...(lead.answers ?? [])
      .filter((a) => !isContactKey(a.questionKey))
      .map((a): [string, string] => [a.questionLabel, (a.answers as string[]).join(", ") || "–"]),
  ];

  const text = [
    `${heading} (${dashboardName})`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Lead-Profil öffnen: ${leadUrl}`,
    `Zum Dashboard: ${dashboardUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="de"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:13px;color:#64748b">${escapeHtml(dashboardName)}</p>
    <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px 6px 0;color:#64748b;width:40%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;vertical-align:top">${escapeHtml(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <p style="margin:24px 0 8px">
      <a href="${escapeHtml(leadUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:bold;font-size:14px">Lead-Profil öffnen</a>
    </p>
    <p style="margin:0;font-size:13px"><a href="${escapeHtml(dashboardUrl)}" style="color:#2563eb">Zum Dashboard</a></p>
  </div>
</body></html>`;

  return { subject: heading, text, html };
}

/** Schickt die "Neuer Lead"-Mail an alle Adressen, die im Dashboard hinterlegt sind. */
export async function sendLeadNotificationMail(tenantId: string, leadId: string): Promise<void> {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true, name: true, leadNotifyEmails: true },
  });
  const to = parseEmailList(tenant.leadNotifyEmails);
  if (to.length === 0) return;
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { id: true, fullName: true, receivedAt: true, assignedTo: { select: { displayName: true } } },
  });
  const mail = buildLeadMail(tenant, { ...lead, assignedTo: lead.assignedTo?.displayName ?? null });
  await sendMail({ to, ...mail });
}

/** Mail an den zugewiesenen Vertriebler – nur, wenn bei ihm "E-Mail bei neuem Lead" angehakt ist. */
export async function sendAssigneeLeadMail(leadId: string): Promise<void> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: {
      id: true,
      fullName: true,
      receivedAt: true,
      tenant: { select: { slug: true, name: true } },
      assignedTo: { select: { displayName: true, email: true, active: true, notifyNewLeadEmail: true } },
      answers: { orderBy: { position: "asc" }, select: { questionKey: true, questionLabel: true, answers: true } },
    },
  });
  const user = lead.assignedTo;
  if (!user || !user.active || !user.notifyNewLeadEmail || !user.email) return;
  const mail = buildLeadMail(lead.tenant, { ...lead, assignedTo: user.displayName }, true);
  await sendMail({ to: [user.email], ...mail });
}
