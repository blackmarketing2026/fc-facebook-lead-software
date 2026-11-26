"use server";

import { WaitUnit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccessibleLeadOr404 } from "@/lib/access";
import { validWait } from "@/lib/chain-logic";
import { AUTO_TAG_KEY, TRACKING_KEY, addTagToLead, buildChainMail, cleanTagName, ensureTag } from "@/lib/chains";
import { db } from "@/lib/db";
import { mailerConfigured, sendMail } from "@/lib/mailer";
import { requireAdmin, requireUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";

export type ChainState = { error?: string; ok?: string; id?: string } | undefined;

function refresh(chainId?: string) {
  revalidatePath("/[tenant]/email-chains", "page");
  if (chainId) revalidatePath("/[tenant]/email-chains/[id]", "page");
}

async function ownChain(chainId: string, tenantId: string) {
  return db.emailChain.findFirst({ where: { id: chainId, tenantId } });
}

const chainSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(120),
  tag: z.string().trim().min(1, "Bitte den Start-Tag eingeben.").max(80),
});

/** Neue Kette anlegen und zum Editor wechseln. */
export async function createChain(_prev: ChainState, formData: FormData): Promise<ChainState> {
  const admin = await requireAdmin();
  const parsed = chainSchema.safeParse({ name: formData.get("name"), tag: formData.get("tag") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const tag = await ensureTag(admin.tenantId, parsed.data.tag);
  const chain = await db.emailChain.create({ data: { tenantId: admin.tenantId, name: parsed.data.name, triggerTagId: tag.id } });
  refresh();
  redirect(tenantPath(admin.tenant.slug, `/email-chains/${chain.id}`));
}

export async function updateChain(chainId: string, _prev: ChainState, formData: FormData): Promise<ChainState> {
  const admin = await requireAdmin();
  const parsed = chainSchema.safeParse({ name: formData.get("name"), tag: formData.get("tag") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  if (!(await ownChain(chainId, admin.tenantId))) return { error: "Kette nicht gefunden." };
  const tag = await ensureTag(admin.tenantId, parsed.data.tag);
  await db.emailChain.update({ where: { id: chainId }, data: { name: parsed.data.name, triggerTagId: tag.id } });
  refresh(chainId);
  return { ok: "Gespeichert." };
}

/** Kette ein- oder ausschalten. Eingeschaltet startet sie für Leads, die den Start-Tag ab jetzt bekommen. */
export async function setChainActive(chainId: string, active: boolean): Promise<ChainState> {
  const admin = await requireAdmin();
  const chain = await db.emailChain.findFirst({ where: { id: chainId, tenantId: admin.tenantId }, include: { steps: true } });
  if (!chain) return { error: "Kette nicht gefunden." };
  if (active) {
    const emails = chain.steps.filter((s) => s.type === "EMAIL");
    if (emails.length === 0) return { error: "Bitte zuerst mindestens eine E-Mail hinzufügen." };
    if (emails.some((s) => !s.subject?.trim() || !s.body?.trim())) return { error: "Eine E-Mail hat noch keinen Betreff oder Text." };
  }
  await db.emailChain.update({ where: { id: chainId }, data: { active } });
  refresh(chainId);
  return { ok: active ? "Kette ist aktiv." : "Kette ist pausiert." };
}

export async function deleteChain(chainId: string): Promise<ChainState> {
  const admin = await requireAdmin();
  if (!(await ownChain(chainId, admin.tenantId))) return { error: "Kette nicht gefunden." };
  await db.emailChain.delete({ where: { id: chainId } });
  refresh();
  redirect(tenantPath(admin.tenant.slug, "/email-chains"));
}

/**
 * Fügt an der Stelle `index` (0 = direkt nach dem Start) einen Schritt ein und gibt dessen ID zurück.
 * Bewusst ohne revalidatePath: Der Editor führt die Schritte selbst nach (schnelle Anzeige, weniger Datenbank-Zugriffe).
 */
export async function addStep(chainId: string, index: number, type: "EMAIL" | "WAIT"): Promise<ChainState> {
  const admin = await requireAdmin();
  const [chain, count] = await Promise.all([ownChain(chainId, admin.tenantId), db.emailChainStep.count({ where: { chainId } })]);
  if (!chain) return { error: "Kette nicht gefunden." };
  const position = Math.max(0, Math.min(Math.trunc(index), count));
  const data = type === "WAIT"
    ? { chainId, position, type, waitValue: 1, waitUnit: "DAYS" as const }
    : { chainId, position, type, subject: "", body: "" };
  const [, created] = await db.$transaction([
    db.emailChainStep.updateMany({ where: { chainId, position: { gte: position } }, data: { position: { increment: 1 } } }),
    db.emailChainStep.create({ data, select: { id: true } }),
  ]);
  return { ok: "Schritt hinzugefügt.", id: created.id };
}

const emailStepSchema = z.object({ subject: z.string().trim().max(300), body: z.string().max(20000) });
const waitStepSchema = z.object({ waitValue: z.coerce.number().int(), waitUnit: z.nativeEnum(WaitUnit), waitTime: z.string().trim().max(5).optional() });

export async function updateStep(stepId: string, _prev: ChainState, formData: FormData): Promise<ChainState> {
  const admin = await requireAdmin();
  const step = await db.emailChainStep.findFirst({ where: { id: stepId, chain: { tenantId: admin.tenantId } } });
  if (!step) return { error: "Schritt nicht gefunden." };
  if (step.type === "WAIT") {
    const useTime = formData.get("useTime") === "on";
    const parsed = waitStepSchema.safeParse({ waitValue: formData.get("waitValue"), waitUnit: formData.get("waitUnit"), waitTime: useTime ? formData.get("waitTime") : undefined });
    const time = useTime ? parsed.data?.waitTime || null : null;
    if (!parsed.success || (useTime && !time) || !validWait(parsed.data.waitValue, parsed.data.waitUnit, time)) {
      return { error: useTime ? "Mit Uhrzeit: Einheit Tage, 0 bis 365 Tage und Uhrzeit wie 08:00." : "Wartezeit: ganze Zahl, mindestens 1 Minute und höchstens 365 Tage." };
    }
    await db.emailChainStep.update({ where: { id: stepId }, data: { waitValue: parsed.data.waitValue, waitUnit: parsed.data.waitUnit, waitTime: time } });
  } else {
    const parsed = emailStepSchema.safeParse({ subject: formData.get("subject"), body: formData.get("body") });
    if (!parsed.success) return { error: "Betreff (max. 300 Zeichen) oder Text ist ungültig." };
    await db.emailChainStep.update({ where: { id: stepId }, data: parsed.data });
  }
  return { ok: "Gespeichert." };
}

export async function moveStep(stepId: string, direction: -1 | 1): Promise<ChainState> {
  const admin = await requireAdmin();
  const step = await db.emailChainStep.findFirst({ where: { id: stepId, chain: { tenantId: admin.tenantId } } });
  if (!step) return { error: "Schritt nicht gefunden." };
  const neighbor = await db.emailChainStep.findFirst({
    where: { chainId: step.chainId, position: direction === -1 ? { lt: step.position } : { gt: step.position } },
    orderBy: { position: direction === -1 ? "desc" : "asc" },
  });
  if (!neighbor) return { ok: "" };
  await db.$transaction([
    db.emailChainStep.update({ where: { id: step.id }, data: { position: neighbor.position } }),
    db.emailChainStep.update({ where: { id: neighbor.id }, data: { position: step.position } }),
  ]);
  return { ok: "Verschoben." };
}

export async function deleteStep(stepId: string): Promise<ChainState> {
  const admin = await requireAdmin();
  const step = await db.emailChainStep.findFirst({ where: { id: stepId, chain: { tenantId: admin.tenantId } } });
  if (!step) return { error: "Schritt nicht gefunden." };
  await db.$transaction([
    db.emailChainStep.delete({ where: { id: stepId } }),
    db.emailChainStep.updateMany({ where: { chainId: step.chainId, position: { gt: step.position } }, data: { position: { decrement: 1 } } }),
  ]);
  return { ok: "Schritt gelöscht." };
}

/** Setzt die Reihenfolge aller Schritte einer Kette (Drag & Drop). `order` enthält alle Schritt-IDs in der neuen Reihenfolge. */
export async function reorderSteps(chainId: string, order: string[]): Promise<ChainState> {
  const admin = await requireAdmin();
  const [chain, steps] = await Promise.all([ownChain(chainId, admin.tenantId), db.emailChainStep.findMany({ where: { chainId }, select: { id: true } })]);
  if (!chain) return { error: "Kette nicht gefunden." };
  const known = new Set(steps.map((s) => s.id));
  if (order.length !== known.size || new Set(order).size !== order.length || order.some((id) => !known.has(id))) {
    return { error: "Die Schritte haben sich geändert. Bitte Seite neu laden." };
  }
  await db.$transaction(order.map((id, i) => db.emailChainStep.update({ where: { id }, data: { position: i } })));
  return { ok: "Reihenfolge gespeichert." };
}

/** Schickt eine E-Mail eines Schritts mit Beispieldaten an eine Test-Adresse. */
export async function sendTestStep(stepId: string, to: string): Promise<ChainState> {
  const admin = await requireAdmin();
  const step = await db.emailChainStep.findFirst({ where: { id: stepId, chain: { tenantId: admin.tenantId }, type: "EMAIL" } });
  if (!step) return { error: "Schritt nicht gefunden." };
  if (!z.email().safeParse(to.trim()).success) return { error: "Ungültige Empfängeradresse." };
  if (!step.subject?.trim() || !step.body?.trim()) return { error: "Bitte zuerst Betreff und Text speichern." };
  if (!(await mailerConfigured())) return { error: "SMTP ist nicht eingerichtet (Bereich SMTP)." };
  const mail = buildChainMail(step, { id: "test", fullName: "Max Mustermann", email: to.trim() }, admin.tenant.slug);
  try {
    const sent = await sendMail({ to: [to.trim()], ...mail, subject: `[Test] ${mail.subject}` });
    return sent ? { ok: `Test-Mail an ${to.trim()} verschickt (Abmelde-Link im Test ist ohne Wirkung).` } : { error: "Versand nicht möglich (Empfänger gesperrt oder SMTP unvollständig)." };
  } catch (err) {
    return { error: `Versand fehlgeschlagen: ${(err as Error).message}` };
  }
}

/** Öffnungs- und Klick-Messung der Ketten-Mails ein- oder ausschalten. */
export async function setTracking(enabled: boolean): Promise<ChainState> {
  await requireAdmin();
  await db.setting.upsert({ where: { key: TRACKING_KEY }, update: { value: enabled ? "1" : "0" }, create: { key: TRACKING_KEY, value: enabled ? "1" : "0" } });
  refresh();
  return { ok: enabled ? "Öffnungen und Klicks werden gemessen." : "Messung ausgeschaltet – neue Mails enthalten kein Tracking mehr." };
}

/** Tag, den jeder neue Lead automatisch bekommt (leer = keiner). */
export async function saveAutoTag(_prev: ChainState, formData: FormData): Promise<ChainState> {
  await requireAdmin();
  const name = cleanTagName(String(formData.get("tag") ?? ""));
  await db.setting.upsert({ where: { key: AUTO_TAG_KEY }, update: { value: name }, create: { key: AUTO_TAG_KEY, value: name } });
  refresh();
  return { ok: name ? `Neue Leads bekommen den Tag „${name}“.` : "Neue Leads bekommen keinen Tag mehr." };
}

export async function addLeadTag(leadId: string, name: string): Promise<ChainState> {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  const clean = cleanTagName(name);
  if (!clean) return { error: "Bitte einen Tag eingeben." };
  const tag = await ensureTag(user.tenantId, clean);
  const res = await addTagToLead(leadId, tag, user.id);
  revalidatePath("/[tenant]/leads/[id]", "page");
  refresh();
  if (!res.added) return { error: "Der Lead hat diesen Tag schon." };
  return { ok: res.started ? `Tag vergeben – ${res.started} E-Mail-Kette(n) gestartet.` : "Tag vergeben." };
}

export async function removeLeadTag(leadId: string, tagId: string): Promise<ChainState> {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  const tag = await db.tag.findFirst({ where: { id: tagId, tenantId: user.tenantId }, select: { name: true } });
  const removed = await db.leadTag.deleteMany({ where: { leadId, tagId, tag: { tenantId: user.tenantId } } });
  if (removed.count && tag) await db.activity.create({ data: { leadId, userId: user.id, type: "TAG_REMOVED", meta: { tag: tag.name } } });
  revalidatePath("/[tenant]/leads/[id]", "page");
  return { ok: "Tag entfernt." };
}

/** Lead (wieder) für E-Mails freigeben bzw. abmelden. */
export async function setLeadOptOut(leadId: string, optOut: boolean): Promise<ChainState> {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { emailOptOut: true } });
  if (lead.emailOptOut === optOut) return { ok: optOut ? "Lead ist abgemeldet." : "Lead bekommt wieder E-Mails." };
  await db.lead.update({ where: { id: leadId }, data: { emailOptOut: optOut, emailOptOutAt: optOut ? new Date() : null } });
  await db.activity.create({ data: { leadId, userId: user.id, type: optOut ? "UNSUBSCRIBED" : "RESUBSCRIBED", meta: { via: "manual" } } });
  if (optOut) await db.chainRun.updateMany({ where: { leadId, status: "ACTIVE" }, data: { status: "CANCELLED", nextRunAt: null, finishedAt: new Date() } });
  revalidatePath("/[tenant]/leads/[id]", "page");
  return { ok: optOut ? "Lead ist abgemeldet." : "Lead bekommt wieder E-Mails." };
}
