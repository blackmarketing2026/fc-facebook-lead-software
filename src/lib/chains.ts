import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { encodeUrl, renderTemplate, rewriteLinks, SENDER_LINES, textToHtml, trackToken, unsubscribeToken, varsForLead, waitTarget } from "./chain-logic";
import type { BounceInfo } from "./bounces";
import { absoluteUrl } from "./lead-notify-mail";
import { sendMail } from "./mailer";
import { tenantPath } from "./tenant-paths";

/** Setting-Schlüssel: Tag, den jeder neue Lead automatisch bekommt (leer = keiner). */
export const AUTO_TAG_KEY = "lead.autoTag";
export const DEFAULT_AUTO_TAG = "Neuer Lead";
/** Setting-Schlüssel: Öffnungen und Klicks messen (Standard: an). */
export const TRACKING_KEY = "chain.tracking";

export async function getTrackingEnabled(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: TRACKING_KEY } });
  return row ? row.value !== "0" : true;
}

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

/**
 * Baut die E-Mail eines Schritts für einen Lead (mit Abmelde-Link im Fuß und List-Unsubscribe-Header).
 * Mit `sendId` bekommt die Mail den Header X-FC-Send (Zuordnung von Rückläufern) und – bei `tracking` – ein Öffnungs-Pixel
 * sowie umgeleitete Links für die Klick-Statistik. Der Abmelde-Link wird nie umgeleitet.
 */
export function buildChainMail(
  step: StepLike,
  lead: { id: string; fullName: string | null; email: string | null },
  slug: string,
  opts: { sendId?: string; tracking?: boolean } = {},
) {
  const vars = varsForLead(lead);
  const subject = renderTemplate(step.subject ?? "", vars).trim();
  const body = renderTemplate(step.body ?? "", vars);
  const link = unsubscribeUrl(slug, lead.id);
  const { sendId, tracking } = opts;
  let bodyHtml = textToHtml(body);
  let pixel = "";
  if (sendId && tracking) {
    bodyHtml = rewriteLinks(bodyHtml, (url) => absoluteUrl(tenantPath(slug, `/api/t/click?s=${sendId}&u=${encodeUrl(url)}&t=${trackToken("click", sendId, url)}`)));
    pixel = `<img src="${absoluteUrl(tenantPath(slug, `/api/t/open?s=${sendId}&t=${trackToken("open", sendId)}`))}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`;
  }
  const text = `${body}\n\n--\n${SENDER_LINES.join("\n")}\n\nKeine E-Mails mehr erhalten? Hier abmelden: ${link}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1e293b;max-width:600px">${bodyHtml}<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px"><p style="font-size:11px;line-height:1.5;color:#94a3b8;margin:0 0 8px">${SENDER_LINES.join("<br>").replace("support@function-concept.de", `<a href="mailto:support@function-concept.de" style="color:#94a3b8">support@function-concept.de</a>`)}</p><p style="font-size:11px;color:#94a3b8;margin:0">Keine E-Mails mehr erhalten? <a href="${link}" style="color:#94a3b8">Hier abmelden</a></p>${pixel}</div>`;
  return {
    subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", ...(sendId ? { "X-FC-Send": sendId } : {}) } as Record<string, string>,
  };
}

export type ProcessSummary = { runs: number; sent: number; failed: number; finished: number };

/**
 * Arbeitet alle fälligen Kettenläufe ab: E-Mail-Schritte werden versendet, Wartezeit-Schritte setzen den nächsten Zeitpunkt.
 * Wird minütlich vom Worker bzw. Cron-Aufruf gestartet.
 */
export async function processChains(now = new Date()): Promise<ProcessSummary> {
  const summary: ProcessSummary = { runs: 0, sent: 0, failed: 0, finished: 0 };
  const tracking = await getTrackingEnabled();
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
        const at = waitTarget(new Date(), step.waitValue ?? 1, step.waitUnit ?? "DAYS", step.waitTime);
        await db.chainRun.update({ where: { id: run.id }, data: { currentStep: position, nextRunAt: at } });
        settled = true;
        break;
      }
      await db.chainRun.update({ where: { id: run.id }, data: { currentStep: position, nextRunAt: new Date(Date.now() + CLAIM_MS) } });

      const sendId = randomUUID();
      const log = (status: "SENT" | "FAILED" | "SKIPPED", subject: string, error?: string) =>
        db.chainSend.create({ data: { id: sendId, runId: run.id, chainId: run.chain.id, stepId: step.id, leadId: run.lead.id, subject: subject.slice(0, 300), status, error } });

      if (!run.lead.email) {
        await log("SKIPPED", step.subject ?? "", "Der Lead hat keine E-Mail-Adresse.");
        await finish("CANCELLED");
        settled = true;
        break;
      }
      const mail = buildChainMail(step, run.lead, run.chain.tenant.slug, { sendId, tracking });
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

/**
 * Verbucht eine Rückläufer-Mail (Bounce) oder Spam-Beschwerde: Statistik, Protokoll, laufende Ketten des Leads enden.
 * Bei einer Spam-Beschwerde wird der Lead zusätzlich vom E-Mail-Verteiler abgemeldet. Gibt false zurück, wenn die Sendung unbekannt ist.
 */
export async function applyBounce(info: BounceInfo): Promise<boolean> {
  const send = await db.chainSend.findUnique({ where: { id: info.sendId }, select: { id: true, leadId: true, subject: true, bouncedAt: true, complainedAt: true } });
  if (!send) return false;
  const now = new Date();
  const stopRuns = () => db.chainRun.updateMany({ where: { leadId: send.leadId, status: "ACTIVE" }, data: { status: "CANCELLED", nextRunAt: null, finishedAt: now } });
  if (info.kind === "BOUNCE") {
    if (send.bouncedAt) return true;
    await db.chainSend.update({ where: { id: send.id }, data: { bouncedAt: now, bounceReason: info.reason?.slice(0, 300) ?? null } });
    await db.activity.create({ data: { leadId: send.leadId, type: "EMAIL_BOUNCED", meta: { subject: send.subject, reason: info.reason } } });
    await stopRuns();
  } else {
    if (send.complainedAt) return true;
    await db.chainSend.update({ where: { id: send.id }, data: { complainedAt: now } });
    await db.activity.create({ data: { leadId: send.leadId, type: "EMAIL_COMPLAINT", meta: { subject: send.subject } } });
    await db.lead.updateMany({ where: { id: send.leadId, emailOptOut: false }, data: { emailOptOut: true, emailOptOutAt: now } });
    await stopRuns();
  }
  return true;
}

export type StepStats = { sent: number; bounced: number; opened: number; clicked: number };

async function collectStats(where: Prisma.ChainSendWhereInput): Promise<Record<string, StepStats>> {
  const rows = await db.chainSend.findMany({
    where: { ...where, status: "SENT", stepId: { not: null } },
    select: { stepId: true, openedAt: true, clickedAt: true, bouncedAt: true, complainedAt: true },
  });
  const out: Record<string, StepStats> = {};
  for (const r of rows) {
    const s = (out[r.stepId!] ??= { sent: 0, bounced: 0, opened: 0, clicked: 0 });
    s.sent++;
    if (r.bouncedAt || r.complainedAt) s.bounced++;
    if (r.openedAt) s.opened++;
    if (r.clickedAt) s.clicked++;
  }
  return out;
}

/** Statistik je E-Mail-Schritt einer Kette (verschickt, Bounce/Spam, geöffnet, geklickt). */
export function stepStats(chainId: string): Promise<Record<string, StepStats>> {
  return collectStats({ chainId });
}

/** Dasselbe für alle Ketten eines Mandanten. */
export function allStepStats(tenantId: string): Promise<Record<string, StepStats>> {
  return collectStats({ chain: { tenantId } });
}
