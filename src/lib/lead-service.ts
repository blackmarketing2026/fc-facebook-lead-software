import { Prisma } from "@prisma/client";
import { db } from "./db";
import { assignNextSalesUser } from "./distribution";
import { parseLeadText } from "./lead-parser";
import { sendPushToUser } from "./push";

export type InboundMail = {
  messageId: string;
  from?: string | null;
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
 * Verarbeitet eine eingehende Mail: speichert sie, parst den Lead, legt ihn an,
 * verteilt ihn per Round-Robin und benachrichtigt den Vertriebler.
 */
export async function processInboundMail(mail: InboundMail): Promise<ProcessResult> {
  const existing = await db.inboundEmail.findUnique({ where: { messageId: mail.messageId } });
  if (existing) return { status: "DUPLICATE" };

  const rawText = mail.text || mail.html || "";
  const parsed = parseLeadText(mail.text, mail.html);

  if (!parsed.ok) {
    // Jede Mail wird geprüft; Mails ohne Lead-JSON werden nur protokolliert.
    const inbound = await db.inboundEmail.create({
      data: {
        messageId: mail.messageId,
        from: mail.from,
        subject: mail.subject,
        receivedAt: mail.receivedAt,
        rawText,
        status: "IGNORED",
        error: parsed.error,
      },
    });
    return { status: "IGNORED", error: parsed.error, inboundId: inbound.id };
  }

  try {
    const { lead, assignedToId, inboundId } = await db.$transaction(async (tx) => {
      const inbound = await tx.inboundEmail.create({
        data: {
          messageId: mail.messageId,
          from: mail.from,
          subject: mail.subject,
          receivedAt: mail.receivedAt,
          rawText,
          status: "PROCESSED",
        },
      });
      const created = await createLead(tx, parsed.lead, inbound.id, mail.receivedAt);
      return { ...created, inboundId: inbound.id };
    });
    await notifyNewLead(lead.id, lead.fullName, assignedToId);
    return { status: "PROCESSED", leadId: lead.id, assignedToId, inboundId };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "DUPLICATE" };
    }
    const error = (err as Error).message;
    const inbound = await db.inboundEmail.create({
      data: {
        messageId: mail.messageId,
        from: mail.from,
        subject: mail.subject,
        receivedAt: mail.receivedAt,
        rawText,
        status: "FAILED",
        error,
      },
    });
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
  const { lead, assignedToId } = await db.$transaction(async (tx) => {
    await tx.inboundEmail.update({ where: { id: inboundId }, data: { status: "PROCESSED", error: null } });
    return createLead(tx, parsed.lead, inboundId, inbound.receivedAt);
  });
  await notifyNewLead(lead.id, lead.fullName, assignedToId);
  return { status: "PROCESSED", leadId: lead.id, assignedToId, inboundId };
}

async function createLead(
  tx: Prisma.TransactionClient,
  parsed: Extract<ReturnType<typeof parseLeadText>, { ok: true }>["lead"],
  sourceEmailId: string | null,
  receivedAt?: Date,
) {
  const assignedToId = await assignNextSalesUser(tx);
  const lead = await tx.lead.create({
    data: {
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

async function notifyNewLead(leadId: string, name: string | null, userId: string | null) {
  if (!userId) return;
  await sendPushToUser(userId, {
    title: "Neuer Lead",
    body: name ? `Neuer Lead: ${name}` : "Ein neuer Lead wurde dir zugewiesen",
    url: `/leads/${leadId}`,
    tag: `lead-${leadId}`,
  }).catch((err) => console.error("[push]", err));
}
