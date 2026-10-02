"use server";

import type { LeadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getAccessibleLeadOr404 } from "@/lib/access";
import { db } from "@/lib/db";
import { parseBerlinLocal } from "@/lib/format";
import { STATUSES } from "@/lib/labels";
import { requireAdmin, requireUser } from "@/lib/session";

function refreshLead() {
  revalidatePath("/[tenant]/leads/[id]", "page");
  revalidatePath("/[tenant]/leads", "page");
  revalidatePath("/[tenant]/dashboard", "page");
}

export async function updateStatus(leadId: string, status: LeadStatus) {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  if (!STATUSES.includes(status)) throw new Error("Ungültiger Status");

  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { status: true } });
  if (lead.status === status) return;
  await db.lead.update({
    where: { id: leadId },
    data: {
      status,
      activities: { create: { type: "STATUS_CHANGED", userId: user.id, meta: { from: lead.status, to: status } } },
    },
  });
  refreshLead();
}

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function addNote(leadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Bitte eine Notiz eingeben." };
  if (text.length > 10_000) return { error: "Notiz ist zu lang (max. 10.000 Zeichen)." };

  await db.note.create({ data: { leadId, authorId: user.id, text } });
  refreshLead();
  return { ok: true };
}

const CONTACT_TYPES = {
  call: "CALL_CLICKED",
  whatsapp: "WHATSAPP_CLICKED",
  email: "EMAIL_CLICKED",
} as const;

/** Protokolliert einen Klick auf Anruf/WhatsApp/E-Mail; ein neuer Lead gilt danach als kontaktiert. */
export async function trackContact(leadId: string, channel: keyof typeof CONTACT_TYPES) {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  const type = CONTACT_TYPES[channel];
  if (!type) return;

  await db.$transaction(async (tx) => {
    await tx.activity.create({ data: { leadId, userId: user.id, type } });
    const updated = await tx.lead.updateMany({ where: { id: leadId, status: "NEU" }, data: { status: "KONTAKTIERT" } });
    if (updated.count > 0) {
      await tx.activity.create({
        data: { leadId, userId: user.id, type: "STATUS_CHANGED", meta: { from: "NEU", to: "KONTAKTIERT", auto: true } },
      });
    }
  });
  refreshLead();
}

export async function createReminder(leadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);

  const dueRaw = String(formData.get("dueAt") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Rückruf";
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const setTermin = formData.get("setTermin") === "on";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dueRaw)) return { error: "Bitte Datum und Uhrzeit wählen." };

  const dueAt = parseBerlinLocal(dueRaw);
  if (Number.isNaN(dueAt.getTime())) return { error: "Ungültiges Datum." };

  // Termine gehören dem zuständigen Vertriebler; legt der Admin sie an, landen sie bei diesem.
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { assignedToId: true, status: true } });
  const ownerId = user.role === "ADMIN" && lead.assignedToId ? lead.assignedToId : user.id;

  await db.$transaction(async (tx) => {
    await tx.reminder.create({ data: { leadId, userId: ownerId, dueAt, title, comment } });
    await tx.activity.create({
      data: { leadId, userId: user.id, type: "REMINDER_SET", meta: { dueAt: dueAt.toISOString(), title } },
    });
    if (setTermin && lead.status !== "TERMIN") {
      await tx.lead.update({ where: { id: leadId }, data: { status: "TERMIN" } });
      await tx.activity.create({
        data: { leadId, userId: user.id, type: "STATUS_CHANGED", meta: { from: lead.status, to: "TERMIN" } },
      });
    }
  });
  refreshLead();
  return { ok: true };
}

async function getOwnReminder(reminderId: string) {
  const user = await requireUser();
  const reminder = await db.reminder.findUniqueOrThrow({ where: { id: reminderId } });
  await getAccessibleLeadOr404(user, reminder.leadId);
  return { user, reminder };
}

export async function completeReminder(reminderId: string) {
  const { user, reminder } = await getOwnReminder(reminderId);
  if (reminder.done) return;
  await db.$transaction([
    db.reminder.update({ where: { id: reminderId }, data: { done: true } }),
    db.activity.create({
      data: { leadId: reminder.leadId, userId: user.id, type: "REMINDER_DONE", meta: { title: reminder.title } },
    }),
  ]);
  refreshLead();
}

export async function deleteReminder(reminderId: string) {
  await getOwnReminder(reminderId);
  await db.reminder.delete({ where: { id: reminderId } });
  refreshLead();
}

export async function reassignLead(leadId: string, userId: string) {
  const admin = await requireAdmin();
  await getAccessibleLeadOr404(admin, leadId);
  // Nur an Vertriebler des Dashboards, zu dem der Lead gehört (wichtig für die Gesamtansicht im Hauptaccount).
  const { tenantId } = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { tenantId: true } });
  const target = await db.user.findFirst({ where: { id: userId, tenantId, active: true } });
  if (!target) throw new Error("Benutzer nicht gefunden");

  await db.$transaction([
    db.lead.update({ where: { id: leadId }, data: { assignedToId: userId } }),
    // Offene Rückrufe wandern mit zum neuen Vertriebler.
    db.reminder.updateMany({ where: { leadId, done: false }, data: { userId, notifiedAt: null } }),
    db.activity.create({ data: { leadId, userId: admin.id, type: "ASSIGNED", meta: { toUserId: userId, auto: false } } }),
  ]);
  refreshLead();
}
