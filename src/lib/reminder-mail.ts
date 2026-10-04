import { db } from "./db";
import { formatDateTime, formatTime, telHref } from "./format";
import { buildIcs, googleCalendarUrl } from "./ics";
import { escapeHtml, sendMail } from "./mailer";
import { REMINDER_CALENDAR_SELECT, reminderEvent, type ReminderForCalendar } from "./reminder-calendar";
import { formatDuration, REMINDER_LEAD_MINUTES, reminderIcon, reminderLabel } from "./reminder-types";
import { absoluteUrl } from "./lead-notify-mail";
import { PLATFORM_TENANT_SLUG, PRODUCT_NAME, tenantPath } from "./tenant-paths";

/** Mail an den zuständigen Vertriebler: alle Termin- und Kontaktdaten, Google-Kalender-Button, Profil-Link, .ics. */
export function buildReminderMail(
  r: ReminderForCalendar,
  tenant: { slug: string; name: string },
  opts: { ownerName: string; createdBy: string | null; due?: boolean },
) {
  const dashboardName = tenant.slug === PLATFORM_TENANT_SLUG ? PRODUCT_NAME : tenant.name;
  const event = reminderEvent(r, tenant.slug);
  const label = reminderLabel(r.type);
  const name = r.lead.fullName ?? "Lead";
  const when = formatDateTime(r.dueAt);
  // due: Erinnerung kurz vor dem Termin statt Mail beim Anlegen.
  const subject = opts.due
    ? `In ${REMINDER_LEAD_MINUTES} Minuten: ${label} mit ${name} – ${formatTime(r.dueAt)} Uhr`
    : `Neuer Termin: ${label} mit ${name} – ${when}`;
  const intro = opts.due
    ? `in ${REMINDER_LEAD_MINUTES} Minuten steht ein Termin an – bitte den Lead kontaktieren (${dashboardName}):`
    : `für dich wurde ein neuer Termin angelegt (${dashboardName}):`;
  const googleUrl = googleCalendarUrl(event);
  const calendarPage = absoluteUrl(tenantPath(tenant.slug, "/calendar"));

  const rows: [string, string, string?][] = [
    ["Art", `${reminderIcon(r.type)} ${label}`],
    ["Wann", `${when} Uhr (${formatDuration(r.durationMinutes)})`],
    ...(r.title && r.title !== label ? [["Titel", r.title] as [string, string]] : []),
    ...(r.comment ? [["Kommentar", r.comment] as [string, string]] : []),
    ["Name", name],
    ...(r.lead.phone ? [["Telefon", r.lead.phone, telHref(r.lead.phone)] as [string, string, string]] : []),
    ...(r.lead.email ? [["E-Mail", r.lead.email, `mailto:${r.lead.email}`] as [string, string, string]] : []),
    ...(opts.createdBy && opts.createdBy !== opts.ownerName ? [["Angelegt von", opts.createdBy] as [string, string]] : []),
  ];

  const text = [
    `Hallo ${opts.ownerName},`,
    "",
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Zu Google Kalender hinzufügen: ${googleUrl}`,
    `Lead-Profil öffnen: ${event.url}`,
    "",
    "Für Outlook oder Apple Kalender die angehängte Datei termin.ics öffnen.",
  ].join("\n");

  const button = (href: string, label: string, color: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:bold;font-size:14px;margin:0 8px 8px 0">${label}</a>`;

  const html = `<!doctype html>
<html lang="de"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:13px;color:#64748b">${escapeHtml(dashboardName)}</p>
    <h1 style="margin:0 0 4px;font-size:20px">${escapeHtml(`${reminderIcon(r.type)} ${label} mit ${name}`)}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#334155">${escapeHtml(when)} Uhr${opts.due ? ` · <strong>in ${REMINDER_LEAD_MINUTES} Minuten</strong>` : ""}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([k, v, href]) =>
            `<tr><td style="padding:6px 12px 6px 0;color:#64748b;width:35%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;vertical-align:top">${
              href ? `<a href="${escapeHtml(href)}" style="color:#2563eb">${escapeHtml(v)}</a>` : escapeHtml(v)
            }</td></tr>`,
        )
        .join("")}
    </table>
    <p style="margin:24px 0 0">
      ${button(googleUrl, "Zu Google Kalender hinzufügen", "#16a34a")}
      ${button(event.url!, "Lead-Profil öffnen", "#2563eb")}
    </p>
    <p style="margin:8px 0 0;font-size:12px;color:#64748b">
      Outlook / Apple Kalender: angehängte Datei <strong>termin.ics</strong> öffnen.
      Alle Termine automatisch im Kalender: <a href="${escapeHtml(calendarPage)}" style="color:#2563eb">Kalender-Abo einrichten</a>.
    </p>
  </div>
</body></html>`;

  return {
    subject,
    text,
    html,
    attachments: [{ filename: "termin.ics", content: buildIcs(event), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }],
  };
}

/**
 * Schickt die Termin-Mail an den Vertriebler, dem der Termin gehört. Gibt dessen Namen zurück (oder null).
 * due: Erinnerung kurz vor dem Termin.
 */
export async function sendReminderMail(reminderId: string, createdBy: string | null, due = false): Promise<string | null> {
  const r = await db.reminder.findUniqueOrThrow({
    where: { id: reminderId },
    select: {
      ...REMINDER_CALENDAR_SELECT,
      user: { select: { displayName: true, email: true, active: true } },
      lead: { select: { ...REMINDER_CALENDAR_SELECT.lead.select, tenant: { select: { slug: true, name: true } } } },
    },
  });
  if (!r.user.active || !r.user.email) return null;
  const mail = buildReminderMail(r, r.lead.tenant, { ownerName: r.user.displayName, createdBy, due });
  const sent = await sendMail({ to: [r.user.email], ...mail });
  return sent ? r.user.displayName : null;
}
