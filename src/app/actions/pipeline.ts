"use server";

import { revalidatePath } from "next/cache";
import { getAccessibleLeadOr404 } from "@/lib/access";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";

export type PipelineResult = { ok?: true; error?: string };

function refresh() {
  revalidatePath("/[tenant]/leads", "page");
  revalidatePath("/[tenant]/leads/[id]", "page");
  revalidatePath("/[tenant]/dashboard", "page");
}

/** Lead in eine andere Phase schieben (Drag & Drop, Menü oder Lead-Seite). */
export async function moveLeadToStage(leadId: string, stageId: string): Promise<PipelineResult> {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  const [lead, stage] = await Promise.all([
    db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { stageId: true, stage: { select: { name: true } } } }),
    db.pipelineStage.findFirst({ where: { id: stageId, tenantId: user.tenantId }, select: { id: true, name: true } }),
  ]);
  if (!stage) return { error: "Phase nicht gefunden." };
  if (lead.stageId === stage.id) return { ok: true };
  await db.lead.update({
    where: { id: leadId },
    data: {
      stageId: stage.id,
      activities: { create: { type: "STATUS_CHANGED", userId: user.id, meta: { fromStage: lead.stage?.name ?? null, toStage: stage.name } } },
    },
  });
  refresh();
  return { ok: true };
}

/** Lead endgültig löschen (z. B. unbrauchbar). Notizen, Termine und Verlauf werden mitgelöscht. */
export async function deleteLead(leadId: string): Promise<PipelineResult> {
  const user = await requireUser();
  await getAccessibleLeadOr404(user, leadId);
  await db.lead.delete({ where: { id: leadId } });
  refresh();
  revalidatePath("/[tenant]/contacts", "page");
  revalidatePath("/[tenant]/calendar", "page");
  return { ok: true };
}

export async function createStage(name: string): Promise<PipelineResult> {
  const admin = await requireAdmin();
  const clean = name.trim();
  if (!clean) return { error: "Bitte einen Namen eingeben." };
  if (clean.length > 80) return { error: "Name zu lang (max. 80 Zeichen)." };
  const max = await db.pipelineStage.aggregate({ where: { tenantId: admin.tenantId }, _max: { position: true } });
  await db.pipelineStage.create({ data: { tenantId: admin.tenantId, name: clean, position: (max._max.position ?? 0) + 1 } });
  refresh();
  return { ok: true };
}

export async function renameStage(stageId: string, name: string): Promise<PipelineResult> {
  const admin = await requireAdmin();
  const clean = name.trim();
  if (!clean) return { error: "Bitte einen Namen eingeben." };
  if (clean.length > 80) return { error: "Name zu lang (max. 80 Zeichen)." };
  const res = await db.pipelineStage.updateMany({ where: { id: stageId, tenantId: admin.tenantId }, data: { name: clean } });
  if (!res.count) return { error: "Phase nicht gefunden." };
  refresh();
  return { ok: true };
}

/** Phase eine Position nach links (-1) oder rechts (+1) schieben. */
export async function moveStage(stageId: string, direction: -1 | 1): Promise<PipelineResult> {
  const admin = await requireAdmin();
  const stages = await db.pipelineStage.findMany({ where: { tenantId: admin.tenantId }, orderBy: { position: "asc" }, select: { id: true } });
  const i = stages.findIndex((s) => s.id === stageId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= stages.length) return { ok: true };
  [stages[i], stages[j]] = [stages[j], stages[i]];
  await db.$transaction(stages.map((s, index) => db.pipelineStage.update({ where: { id: s.id }, data: { position: index + 1 } })));
  refresh();
  return { ok: true };
}

/** Phase löschen; ihre Leads wandern in die Standard-Phase (neue Leads). */
export async function deleteStage(stageId: string): Promise<PipelineResult> {
  const admin = await requireAdmin();
  const stage = await db.pipelineStage.findFirst({ where: { id: stageId, tenantId: admin.tenantId } });
  if (!stage) return { error: "Phase nicht gefunden." };
  if (stage.isDefault) return { error: "Die Phase für neue Leads kann nicht gelöscht werden." };
  const fallback = await db.pipelineStage.findFirst({ where: { tenantId: admin.tenantId, isDefault: true } });
  if (!fallback) return { error: "Keine Standard-Phase vorhanden." };
  await db.$transaction([
    db.lead.updateMany({ where: { stageId }, data: { stageId: fallback.id } }),
    db.pipelineStage.delete({ where: { id: stageId } }),
  ]);
  refresh();
  return { ok: true };
}

/** Bestimmt, in welcher Phase neue Leads landen. */
export async function setDefaultStage(stageId: string): Promise<PipelineResult> {
  const admin = await requireAdmin();
  const stage = await db.pipelineStage.findFirst({ where: { id: stageId, tenantId: admin.tenantId } });
  if (!stage) return { error: "Phase nicht gefunden." };
  await db.$transaction([
    db.pipelineStage.updateMany({ where: { tenantId: admin.tenantId }, data: { isDefault: false } }),
    db.pipelineStage.update({ where: { id: stageId }, data: { isDefault: true } }),
  ]);
  refresh();
  return { ok: true };
}
