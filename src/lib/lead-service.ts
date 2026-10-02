import { Prisma } from "@prisma/client";
import { db } from "./db";
import { assignNextSalesUser } from "./distribution";
import { PLATFORM_TENANT_SLUG, tenantPath } from "./tenant-paths";
import { parseLeadText, type ParsedAnswer } from "./lead-parser";
import { resolveTenantId, tenantCodeFromSubject } from "./lead-routing";
import { sendPushToUser } from "./push";

export type InboundMail = {
  messageId: string;
  from?: string | null;
  /** Alle Empfänger-Adressen (To, Cc, Delivered-To …) für die Mandanten-Zuordnung. */
  to?: string | null;
  subject?: string | null;
  receivedAt?: Date;
  text: string;
  html?: string | null;
};

export type ProcessResult =
  | { status: "DUPLICATE" }
  | { status: "IGNORED" | "FAILED"; error: string; inboundId: string }
  | { status: "PROCESSED"; leadId: string; assignedToId: string | null; inboundId: string };

/**
 * Mandant für eine Mail aus dem zentralen Postfach: Dashboard-ID im Betreff, sonst erste passende
 * Zuordnungsregel, sonst der Plattform-Mandant (Function Concept).
 */
async function tenantForMail(mail: Pick<InboundMail, "to" | "subject">, answers: ParsedAnswer[]): Promise<string> {
  const tenants = await db.tenant.findMany({ select: { id: true, code: true } });
  const code = tenantCodeFromSubject(mail.subject, tenants.map((t) => t.code));
  if (code) return tenants.find((t) => t.code === code)!.id;

  const rules = await db.leadRoute.findMany({ select: { tenantId: true, type: true, pattern: true, priority: true } });
  const matched = resolveTenantId(rules, mail, answers);
  if (matched) return matched;
  const platform = await db.tenant.findUniqueOrThrow({ where: { slug: PLATFORM_TENANT_SLUG }, select: { id: true } });
  return platform.id;
}

/**
 * Verarbeitet eine eingehende Mail: speichert sie, ordnet sie einem Mandanten zu, parst den Lead,
 * legt ihn an, verteilt ihn per Round-Robin und benachrichtigt den Vertriebler.
 * forceTenantId: für den manuellen Import aus einem bestimmten Dashboard.
 */
export async function processInboundMail(mail: InboundMail, forceTenantId?: string): Promise<ProcessResult> {
  const existing = await db.inboundEmail.findUnique({ where: { messageId: mail.messageId } });
  if (existing) return { status: "DUPLICATE" };

  const rawText = mail.text || mail.html || "";
  const parsed = parseLeadText(mail.text, mail.html);
  const tenantId = forceTenantId ?? (await tenantForMail(mail, parsed.ok ? parsed.lead.answers : []));
  const inboundData = {
    tenantId,
    messageId: mail.messageId,
    from: mail.from,
    to: mail.to,
    subject: mail.subject,
    receivedAt: mail.receivedAt,
    rawText,
  };

  if (!parsed.ok) {
    // Jede Mail wird geprüft; Mails ohne Lead-JSON werden nur protokolliert.
    const inbound = await db.inboundEmail.create({ data: { ...inboundData, status: "IGNORED", error: parsed.error } });
    return { status: "IGNORED", error: parsed.error, inboundId: inbound.id };
  }

  try {
    const { lead, assignedToId, inboundId } = await db.$transaction(async (tx) => {
      const inbound = await tx.inboundEmail.create({ data: { ...inboundData, status: "PROCESSED" } });
      const created = await createLead(tx, tenantId, parsed.lead, inbound.id, mail.receivedAt);
      return { ...created, inboundId: inbound.id };
    });
    await notifyNewLead(tenantId, lead.id, lead.fullName, assignedToId);
    return { status: "PROCESSED", leadId: lead.id, assignedToId, inboundId };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "DUPLICATE" };
    }
    const error = (err as Error).message;
    const inbound = await db.inboundEmail.create({ data: { ...inboundData, status: "FAILED", error } });
    return { status: "FAILED", error, inboundId: inbound.id };
  }
}

/** Verarbeitet eine gespeicherte IGNORED/FAILED-Mail erneut (Admin-Button). */
export async function reprocessInbound(inboundId: string): Promise<ProcessResult> {
  const inbound = await db.inboundEmail.findUniqueOrThrow({ where: { id: inboundId }, include: { lead: true } });
  if (inbound.lead) return { status: "PROCESSED", leadId: inbound.lead.id, assignedToId: inbound.lead.assignedToId, inboundId };

  const parsed = parseLeadText(inbound.rawText, inbound.rawText);
  if (!parsed.ok) {
    await db.inboundEmail.update({ where: { id: inboundId }, data: { error: parsed.error } });
    return { status: inbound.status === "FAILED" ? "FAILED" : "IGNORED", error: parsed.error, inboundId };
  }
  const tenantId = inbound.tenantId ?? (await tenantForMail(inbound, parsed.lead.answers));
  const { lead, assignedToId } = await db.$transaction(async (tx) => {
    await tx.inboundEmail.update({ where: { id: inboundId }, data: { status: "PROCESSED", error: null, tenantId } });
    return createLead(tx, tenantId, parsed.lead, inboundId, inbound.receivedAt);
  });
  await notifyNewLead(tenantId, lead.id, lead.fullName, assignedToId);
  return { status: "PROCESSED", leadId: lead.id, assignedToId, inboundId };
}

async function createLead(
  tx: Prisma.TransactionClient,
  tenantId: string,
  parsed: Extract<ReturnType<typeof parseLeadText>, { ok: true }>["lead"],
  sourceEmailId: string | null,
  receivedAt?: Date,
) {
  const assignedToId = await assignNextSalesUser(tx, tenantId);
  const lead = await tx.lead.create({
    data: {
      tenantId,
      receivedAt: receivedAt ?? new Date(),
      fullName: parsed.fullName,
      email: parsed.email,
      phone: parsed.phone,
      language: parsed.language,
      rawJson: parsed.raw as Prisma.InputJsonValue,
      assignedToId,
      sourceEmailId,
      answers: { create: parsed.answers },
      activities: {
        create: [
          { type: "CREATED" },
          ...(assignedToId ? [{ type: "ASSIGNED" as const, meta: { toUserId: assignedToId, auto: true } }] : []),
        ],
      },
    },
  });
  return { lead, assignedToId };
}

async function notifyNewLead(tenantId: string, leadId: string, name: string | null, userId: string | null) {
  if (!userId) return;
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { slug: true } });
  await sendPushToUser(userId, {
    title: "Neuer Lead",
    body: name ? `Neuer Lead: ${name}` : "Ein neuer Lead wurde dir zugewiesen",
    url: tenantPath(tenant.slug, `/leads/${leadId}`),
    tag: `lead-${leadId}`,
  }).catch((err) => console.error("[push]", err));
}
