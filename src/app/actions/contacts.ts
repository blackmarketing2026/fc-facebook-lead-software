"use server";

import { getAccessibleLeadOr404 } from "@/lib/access";
import { activityText } from "@/lib/activity-text";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

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
