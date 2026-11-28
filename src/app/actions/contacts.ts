"use server";

import { revalidatePath } from "next/cache";
import { getAccessibleLeadOr404, leadScope } from "@/lib/access";
import { activityText } from "@/lib/activity-text";
import { db } from "@/lib/db";
import { ensureTag, addTagToLead, cleanTagName } from "@/lib/chains";
import { parseContactForm } from "@/lib/contact-input";
import { requireAdmin, requireUser } from "@/lib/session";

export type ContactDetails = {
  receivedAt: string;
  language: string | null;
  source: { from: string | null; subject: string | null } | null;
  unsubscribedAt: string | null;
  protocol: { id: string; at: string; title: string; text: string; by: string | null }[];
  notes: { id: string; at: string; text: string; by: string | null }[];
  facebook: { label: string; values: string[] }[];
  rawJson: string;
};

/** Lädt Protokoll, Notizen und Formulardaten eines Kontakts (wird erst beim Aufklappen abgerufen). */
export async function contactDetails(leadId: string): Promise<ContactDetails> {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: {
      receivedAt: true,
      language: true,
      rawJson: true,
      emailOptOutAt: true,
      sourceEmail: { select: { from: true, subject: true } },
      answers: { orderBy: { position: "asc" }, select: { id: true, questionLabel: true, answers: true } },
      notes: { orderBy: { createdAt: "desc" }, select: { id: true, text: true, createdAt: true, author: { select: { displayName: true } } } },
      activities: { orderBy: { createdAt: "desc" }, select: { id: true, type: true, meta: true, createdAt: true, user: { select: { displayName: true } } } },
    },
  });
  const userNames = new Map<string, string>();
  return {
    receivedAt: lead.receivedAt.toISOString(),
    language: lead.language,
    source: lead.sourceEmail ? { from: lead.sourceEmail.from, subject: lead.sourceEmail.subject } : null,
    unsubscribedAt: lead.emailOptOutAt?.toISOString() ?? null,
    protocol: lead.activities.map((a) => ({
      id: a.id,
      at: a.createdAt.toISOString(),
      title: a.type,
      text: activityText(a.type, a.meta, userNames),
      by: a.user?.displayName ?? null,
    })),
    notes: lead.notes.map((n) => ({ id: n.id, at: n.createdAt.toISOString(), text: n.text, by: n.author?.displayName ?? null })),
    facebook: lead.answers.map((a) => ({
      label: a.questionLabel,
      values: Array.isArray(a.answers) ? (a.answers as unknown[]).map(String) : [String(a.answers ?? "")],
    })),
    rawJson: JSON.stringify(lead.rawJson, null, 2),
  };
}

export type CreateContactState = { error?: string; ok?: string; id?: string; existingId?: string } | undefined;

export async function tagContacts(ids: string[], name: string): Promise<{ message: string; error?: boolean }> {
  const user = await requireUser();
  const uniqueIds = Array.isArray(ids) ? [...new Set(ids)] : [];
  const clean = typeof name === "string" ? cleanTagName(name) : "";
  if (!clean || uniqueIds.length === 0 || uniqueIds.length > 50 || uniqueIds.some((id) => typeof id !== "string")) {
    return { error: true, message: "Bitte Kontakte und einen Tag auswählen." };
  }
  const leads = await db.lead.findMany({ where: { ...leadScope(user), id: { in: uniqueIds } }, select: { id: true } });
  if (leads.length !== uniqueIds.length) return { error: true, message: "Mindestens ein Kontakt ist nicht mehr verfügbar." };

  const tag = await ensureTag(user.tenantId, clean);
  let added = 0;
  try {
    for (const lead of leads) {
      if ((await addTagToLead(lead.id, tag, user.id)).added) added++;
    }
  } catch {
    revalidatePath("/[tenant]/contacts", "page");
    revalidatePath("/[tenant]/leads", "page");
    return { error: true, message: `Die Vergabe wurde unterbrochen. Der Tag wurde ${added} Kontakten hinzugefügt; bitte prüfe das Ergebnis.` };
  }
  revalidatePath("/[tenant]/contacts", "page");
  revalidatePath("/[tenant]/leads", "page");
  return { message: `Tag „${tag.name}“ wurde ${added} von ${leads.length} Kontakten hinzugefügt. Bereits vorhandene Tags bleiben unverändert.` };
}

export async function removeContactTags(ids: string[], names: string[]): Promise<{ message: string; error?: boolean }> {
  const user = await requireUser();
  const uniqueIds = Array.isArray(ids) ? [...new Set(ids)] : [];
  const uniqueNames = Array.isArray(names) ? [...new Set(names)] : [];
  if (!uniqueIds.length || uniqueIds.length > 50 || uniqueIds.some((id) => typeof id !== "string") || !uniqueNames.length || uniqueNames.length > 20 || uniqueNames.some((name) => typeof name !== "string" || !name.trim() || name.length > 80)) {
    return { error: true, message: "Bitte bis zu 50 Kontakte und bis zu 20 Tags auswählen." };
  }
  const leads = await db.lead.findMany({ where: { ...leadScope(user), id: { in: uniqueIds } }, select: { id: true } });
  if (leads.length !== uniqueIds.length) return { error: true, message: "Mindestens ein Kontakt ist nicht mehr verfügbar." };
  const tags = await db.tag.findMany({ where: { tenantId: user.tenantId, name: { in: uniqueNames } }, select: { id: true, name: true } });
  if (tags.length !== uniqueNames.length) return { error: true, message: "Mindestens ein Tag ist nicht mehr verfügbar. Bitte die Seite neu laden." };

  const result = await db.$transaction(async (tx) => {
    const where = { leadId: { in: uniqueIds }, tagId: { in: tags.map((tag) => tag.id) }, lead: leadScope(user), tag: { tenantId: user.tenantId } };
    const links = await tx.leadTag.findMany({ where, select: { leadId: true, tagId: true } });
    const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]));
    const deleted = await tx.leadTag.deleteMany({ where });
    if (deleted.count !== links.length) throw new Error("Tag-Zuordnungen wurden gleichzeitig geändert.");
    if (links.length) await tx.activity.createMany({ data: links.map((link) => ({ leadId: link.leadId, userId: user.id, type: "TAG_REMOVED" as const, meta: { tag: tagNames.get(link.tagId) ?? "" } })) });
    return { removed: deleted.count, contacts: new Set(links.map((link) => link.leadId)).size };
  });
  revalidatePath("/[tenant]/contacts", "page");
  revalidatePath("/[tenant]/leads", "page");
  revalidatePath("/[tenant]/leads/[id]", "page");
  return { message: `${result.removed} ${result.removed === 1 ? "Tag-Zuordnung" : "Tag-Zuordnungen"} bei ${result.contacts} ${result.contacts === 1 ? "Kontakt" : "Kontakten"} entfernt.` };
}

/** Legt einen Kontakt von Hand an („Kontakte importieren“, Einzelanlage). */
export async function createContact(_prev: CreateContactState, formData: FormData): Promise<CreateContactState> {
  const admin = await requireAdmin();
  const parsed = parseContactForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  const same = [...(d.email ? [{ email: d.email }] : []), ...(d.phone ? [{ phone: d.phone }] : [])];
  if (same.length) {
    const dup = await db.lead.findFirst({ where: { tenantId: admin.tenantId, OR: same }, select: { id: true, fullName: true } });
    if (dup) return { error: `Diesen Kontakt gibt es schon: ${dup.fullName ?? "Unbekannt"}.`, existingId: dup.id };
  }

  const stage = d.stageId
    ? await db.pipelineStage.findFirst({ where: { id: d.stageId, tenantId: admin.tenantId }, select: { id: true } })
    : await db.pipelineStage.findFirst({ where: { tenantId: admin.tenantId, isDefault: true }, select: { id: true } });
  if (d.stageId && !stage) return { error: "Phase nicht gefunden." };

  const now = new Date();
  const lead = await db.lead.create({
    data: {
      tenantId: admin.tenantId,
      fullName: d.fullName,
      email: d.email,
      phone: d.phone,
      language: d.language,
      rawJson: [],
      stageId: stage?.id ?? null,
      // Ohne Einwilligung bekommt der Kontakt keine E-Mails (Ketten): Er wird als abgemeldet geführt, bis jemand ihn freigibt.
      emailOptOut: !d.consent,
      emailOptOutAt: d.consent ? null : now,
      ...(d.note ? { notes: { create: { authorId: admin.id, text: d.note } } } : {}),
      activities: {
        create: [
          { type: "CREATED", userId: admin.id, meta: { manual: true } },
          ...(d.note ? [{ type: "NOTE_ADDED" as const, userId: admin.id }] : []),
          ...(d.consent ? [] : [{ type: "UNSUBSCRIBED" as const, userId: admin.id, meta: { via: "import" } }]),
        ],
      },
    },
    select: { id: true },
  });

  for (const name of d.tags) {
    const tag = await ensureTag(admin.tenantId, name);
    await addTagToLead(lead.id, tag, admin.id);
  }

  revalidatePath("/[tenant]/leads", "page");
  revalidatePath("/[tenant]/contacts", "page");
  revalidatePath("/[tenant]/dashboard", "page");
  return { ok: "Kontakt angelegt.", id: lead.id };
}
