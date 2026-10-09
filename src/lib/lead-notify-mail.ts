import { db } from "./db";
import { formatDateTime, telHref, whatsappNumber } from "./format";
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

export type MasterLeadMailData = LeadMailData & {
  email: string | null;
  phone: string | null;
  language: string | null;
};

/** Öffentliche Adresse: APP_URL, sonst die Produktions-Domain, die Vercel automatisch setzt. */
export function absoluteUrl(path: string) {
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

/** Vollständige Lead-Zusammenfassung für den Master-Account über alle Dashboards. */
export function buildMasterLeadMail(tenant: { slug: string; name: string }, lead: MasterLeadMailData) {
  const leadUrl = absoluteUrl(tenantPath(PLATFORM_TENANT_SLUG, `/leads/${lead.id}`));
  const phone = lead.phone?.trim() || null;
  const email = lead.email?.trim() || null;
  const waNumber = phone ? whatsappNumber(phone) : "";
  const actions = [
    phone ? { label: "Anrufen", href: telHref(phone), color: "#059669" } : null,
    email ? { label: "E-Mail", href: `mailto:${encodeURIComponent(email).replace(/%40/gi, "@")}`, color: "#2563eb" } : null,
    /^\d{8,15}$/.test(waNumber) ? { label: "WhatsApp", href: `https://wa.me/${waNumber}`, color: "#16a34a" } : null,
  ].filter((action): action is { label: string; href: string; color: string } => action !== null);
  const rows: [string, string][] = [
    ["Dashboard", tenant.name],
    ["Name", lead.fullName || "Unbekannt"],
    ["Telefon", phone || "–"],
    ["E-Mail", email || "–"],
    ["Sprache", lead.language || "–"],
    ["Eingang", formatDateTime(lead.receivedAt)],
    ["Zugewiesen an", lead.assignedTo || "Niemand"],
    ...(lead.answers ?? [])
      .filter((answer) => !isContactKey(answer.questionKey))
      .map((answer): [string, string] => [
        answer.questionLabel,
        Array.isArray(answer.answers) ? answer.answers.map(String).join(", ") || "–" : "–",
      ]),
  ];
  const subject = `Neuer Lead · ${tenant.name}: ${lead.fullName || "Unbekannt"}`;
  const text = [
    subject,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    ...actions.map(({ label, href }) => `${label}: ${href}`),
    `Lead im Master-Dashboard öffnen: ${leadUrl}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="de"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:13px;color:#64748b">${escapeHtml(tenant.name)}</p>
    <h1 style="margin:0 0 20px;font-size:21px">Neuer Lead: ${escapeHtml(lead.fullName || "Unbekannt")}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows.map(([label, value]) => `<tr><td style="padding:7px 12px 7px 0;color:#64748b;width:34%;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;vertical-align:top">${escapeHtml(value)}</td></tr>`).join("")}
    </table>
    <p style="margin:24px 0 12px">
      ${actions.map(({ label, href, color }) => `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:6px;background:${color};color:#fff;text-decoration:none;font-weight:bold;font-size:14px">${label}</a>`).join("")}
    </p>
    <p style="margin:4px 0"><a href="${escapeHtml(leadUrl)}" style="color:#2563eb">Lead im Master-Dashboard öffnen</a></p>
  </div>
</body></html>`;
  return { subject, text, html };
}

/** Die E-Mail-Adresse folgt Änderungen am Master-Account und ist nicht fest im Code hinterlegt. */
export async function sendMasterLeadMail(leadId: string): Promise<string | null> {
  const master = await db.user.findUnique({
    where: { id: "user_master_account" },
    select: { email: true, active: true, isPlatformAdmin: true },
  });
  if (!master?.active || !master.isPlatformAdmin || !master.email) return null;
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: {
      id: true, fullName: true, email: true, phone: true, language: true, receivedAt: true,
      tenant: { select: { slug: true, name: true } },
      assignedTo: { select: { displayName: true } },
      answers: { orderBy: { position: "asc" }, select: { questionKey: true, questionLabel: true, answers: true } },
    },
  });
  const mail = buildMasterLeadMail(lead.tenant, { ...lead, assignedTo: lead.assignedTo?.displayName ?? null });
  const sent = await sendMail({ to: [master.email], ...mail });
  return sent ? master.email : null;
}

/** Schickt die "Neuer Lead"-Mail an alle Adressen, die im Dashboard hinterlegt sind. */
export async function sendLeadNotificationMail(tenantId: string, leadId: string, excludeEmail?: string): Promise<void> {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true, name: true, leadNotifyEmails: true },
  });
  const to = parseEmailList(tenant.leadNotifyEmails).filter((email) => email.toLowerCase() !== excludeEmail?.toLowerCase());
  if (to.length === 0) return;
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { id: true, fullName: true, receivedAt: true, assignedTo: { select: { displayName: true } } },
  });
  const mail = buildLeadMail(tenant, { ...lead, assignedTo: lead.assignedTo?.displayName ?? null });
  await sendMail({ to, ...mail });
}

export type AssigneeMailResult = { sent: true; to: string } | { sent: false; reason: string };

/** Mail an den zugewiesenen Vertriebler – nur, wenn bei ihm "E-Mail bei neuem Lead" angehakt ist. */
export async function sendAssigneeLeadMail(leadId: string): Promise<AssigneeMailResult> {
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
  if (!user) return { sent: false, reason: "Der Lead ist niemandem zugewiesen." };
  if (!user.active) return { sent: false, reason: `${user.displayName} ist deaktiviert.` };
  if (!user.notifyNewLeadEmail) return { sent: false, reason: `Bei ${user.displayName} ist „E-Mail bei neuem Lead“ ausgeschaltet.` };
  if (!user.email) return { sent: false, reason: `${user.displayName} hat keine E-Mail-Adresse.` };
  const mail = buildLeadMail(lead.tenant, { ...lead, assignedTo: user.displayName }, true);
  const sent = await sendMail({ to: [user.email], ...mail });
  return sent ? { sent: true, to: user.email } : { sent: false, reason: "Der Mailversand (SMTP) ist auf dem Server nicht eingerichtet." };
}
