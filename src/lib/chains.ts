import { Prisma } from "@prisma/client";
import { db } from "./db";
import { renderTemplate, textToHtml, unsubscribeToken, varsForLead, waitMs } from "./chain-logic";
import { absoluteUrl } from "./lead-notify-mail";
import { sendMail } from "./mailer";
import { tenantPath } from "./tenant-paths";

/** Setting-Schlüssel: Tag, den jeder neue Lead automatisch bekommt (leer = keiner). */
export const AUTO_TAG_KEY = "lead.autoTag";
export const DEFAULT_AUTO_TAG = "Neuer Lead";

const MAX_STEPS_PER_RUN = 20;
const MAX_SENDS_PER_TICK = 30;
/** Ein Lauf wird für diese Zeit „reserviert“, während er bearbeitet wird (verhindert Doppelversand durch parallele Aufrufe). */
const CLAIM_MS = 10 * 60 * 1000;

export function cleanTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function getAutoTagName(): Promise<string> {
  const row = await db.setting.findUnique({ where: { key: AUTO_TAG_KEY } });
  return row ? row.value : DEFAULT_AUTO_TAG;
}

export async function ensureTag(tenantId: string, name: string) {
  const clean = cleanTagName(name);
  return db.tag.upsert({ where: { tenantId_name: { tenantId, name: clean } }, update: {}, create: { tenantId, name: clean } });
}

/**
 * Gibt dem Lead den Tag und startet alle aktiven Ketten, die mit diesem Tag beginnen.
 * Jeder Lead durchläuft eine Kette nur einmal. Bereits getaggte Leads werden beim späteren Aktivieren einer Kette nicht nachträglich gestartet.
 */
export async function addTagToLead(leadId: string, tag: { id: string; name: string }, userId?: string): Promise<{ added: boolean; started: number }> {
  const tagId = tag.id;
  const created = await db.leadTag.createMany({ data: [{ leadId, tagId }], skipDuplicates: true });
  if (created.count === 0) return { added: false, started: 0 };
  await db.activity.create({ data: { leadId, userId: userId ?? null, type: "TAG_ADDED", meta: { tag: tag.name } } });
  const chains = await db.emailChain.findMany({ where: { triggerTagId: tagId, active: true }, select: { id: true } });
  let started = 0;
  for (const chain of chains) {
    try {
      await db.chainRun.create({ data: { chainId: chain.id, leadId, nextRunAt: new Date() } });
      started++;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
  }
  return { added: true, started };
}

/** Jeder neue Lead bekommt den eingestellten Auto-Tag (und startet damit die zugehörige Kette). */
export async function autoTagNewLead(tenantId: string, leadId: string): Promise<void> {
  const name = cleanTagName(await getAutoTagName());
  if (!name) return;
  const tag = await ensureTag(tenantId, name);
  await addTagToLead(leadId, tag);
}

export function unsubscribeUrl(slug: string, leadId: string): string {
  return absoluteUrl(tenantPath(slug, `/api/unsubscribe?l=${encodeURIComponent(leadId)}&t=${unsubscribeToken(leadId)}`));
}

type StepLike = { subject: string | null; body: string | null };

/** Baut die E-Mail eines Schritts für einen Lead (mit Abmelde-Link im Fuß und List-Unsubscribe-Header). */
export function buildChainMail(step: StepLike, lead: { id: string; fullName: string | null; email: string | null }, slug: string) {
  const vars = varsForLead(lead);
  const subject = renderTemplate(step.subject ?? "", vars).trim();
  const body = renderTemplate(step.body ?? "", vars);
  const link = unsubscribeUrl(slug, lead.id);
  const text = `${body}\n\n--\nKeine E-Mails mehr erhalten? Hier abmelden: ${link}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1e293b;max-width:600px">${textToHtml(body)}<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px"><p style="font-size:12px;color:#64748b;margin:0">Keine E-Mails mehr erhalten? <a href="${link}" style="color:#64748b">Hier abmelden</a></p></div>`;
  return {
    subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export type ProcessSummary = { runs: number; sent: number; failed: number; finished: number };

/**
 * Arbeitet alle fälligen Kettenläufe ab: E-Mail-Schritte werden versendet, Wartezeit-Schritte setzen den nächsten Zeitpunkt.
 * Wird minütlich vom Worker bzw. Cron-Aufruf gestartet.
 */
export async function processChains(now = new Date()): Promise<ProcessSummary> {
  const summary: ProcessSummary = { runs: 0, sent: 0, failed: 0, finished: 0 };
  const due = await db.chainRun.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: now }, chain: { active: true } },
    orderBy: { nextRunAt: "asc" },
    take: 100,
    select: { id: true, nextRunAt: true },
  });

  for (const candidate of due) {
    if (summary.sent >= MAX_SENDS_PER_TICK) break;
    // Reservieren: nur wer den Lauf mit unverändertem nextRunAt „greift“, bearbeitet ihn.
    const claimed = await db.chainRun.updateMany({
      where: { id: candidate.id, status: "ACTIVE", nextRunAt: candidate.nextRunAt },
      data: { nextRunAt: new Date(now.getTime() + CLAIM_MS) },
    });
    if (claimed.count === 0) continue;
    summary.runs++;

    const run = await db.chainRun.findUniqueOrThrow({
      where: { id: candidate.id },
      include: {
        chain: { select: { id: true, name: true, tenant: { select: { slug: true } }, steps: { orderBy: { position: "asc" } } } },
        lead: { select: { id: true, fullName: true, email: true, emailOptOut: true } },
      },
    });

    const finish = (status: "DONE" | "CANCELLED") =>
      db.chainRun.update({ where: { id: run.id }, data: { status, nextRunAt: null, finishedAt: new Date() } });

    if (run.lead.emailOptOut) {
      await finish("CANCELLED");
      continue;
    }

    let position = run.currentStep;
    let guard = 0;
    let settled = false;
    while (guard++ < MAX_STEPS_PER_RUN) {
      const step = run.chain.steps.find((s) => s.position === position) ?? run.chain.steps[position];
      if (!step) {
        await finish("DONE");
        summary.finished++;
        settled = true;
        break;
      }
      // Erst den Fortschritt speichern, dann senden: lieber eine Mail auslassen als doppelt schicken.
      position++;
      if (step.type === "WAIT") {
        const at = new Date(Date.now() + waitMs(step.waitValue ?? 1, step.waitUnit ?? "DAYS"));
        await db.chainRun.update({ where: { id: run.id }, data: { currentStep: position, nextRunAt: at } });
        settled = true;
        break;
      }
      await db.chainRun.update({ where: { id: run.id }, data: { currentStep: position, nextRunAt: new Date(Date.now() + CLAIM_MS) } });

      const log = (status: "SENT" | "FAILED" | "SKIPPED", subject: string, error?: string) =>
        db.chainSend.create({ data: { runId: run.id, chainId: run.chain.id, stepId: step.id, leadId: run.lead.id, subject: subject.slice(0, 300), status, error } });

      if (!run.lead.email) {
        await log("SKIPPED", step.subject ?? "", "Der Lead hat keine E-Mail-Adresse.");
        await finish("CANCELLED");
        settled = true;
        break;
      }
      const mail = buildChainMail(step, run.lead, run.chain.tenant.slug);
      if (!mail.subject || !(step.body ?? "").trim()) {
        await log("SKIPPED", mail.subject, "Betreff oder Text des Schritts ist leer.");
        continue;
      }
      try {
        const sent = await sendMail({ to: [run.lead.email], ...mail });
        if (sent) {
          await log("SENT", mail.subject);
          await db.activity.create({ data: { leadId: run.lead.id, type: "EMAIL_SENT", meta: { subject: mail.subject, chain: run.chain.name } } }).catch(() => undefined);
          summary.sent++;
        } else {
          await log("FAILED", mail.subject, "SMTP ist nicht eingerichtet oder der Empfänger ist gesperrt.");
          summary.failed++;
        }
      } catch (err) {
        await log("FAILED", mail.subject, (err as Error).message.slice(0, 500));
        summary.failed++;
      }
      if (summary.sent >= MAX_SENDS_PER_TICK) {
        await db.chainRun.update({ where: { id: run.id }, data: { nextRunAt: new Date() } });
        settled = true;
        break;
      }
    }
    // Schleifenlimit erreicht: beim nächsten Durchlauf weitermachen (nicht „reserviert“ lassen).
    if (!settled) await db.chainRun.update({ where: { id: run.id }, data: { nextRunAt: new Date() } });
  }
  return summary;
}
