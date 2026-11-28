import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => {
  const db = {
    leadTag: { createMany: vi.fn(), findFirst: vi.fn() },
    tag: { upsert: vi.fn() },
    activity: { create: vi.fn() },
    emailChain: { findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    chainRun: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    setting: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db };
});
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/mailer", () => ({ sendMail: vi.fn() }));
vi.mock("@/lib/lead-notify-mail", () => ({ absoluteUrl: (path: string) => `https://example.com${path}` }));

import { addTagToLead, processChains } from "@/lib/chains";
import { completionTagName } from "@/lib/chain-logic";

describe("Abschluss einer E-Mail-Kette", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation(async (fn) => fn(db));
  });

  it("startet keine Kette, wenn ihr Abschluss-Tag bereits vorhanden ist", async () => {
    db.leadTag.createMany.mockResolvedValue({ count: 1 });
    db.activity.create.mockResolvedValue({});
    db.emailChain.findMany.mockResolvedValue([{ id: "chain", tenantId: "tenant", completionTagName: "Kette Ende" }]);
    db.leadTag.findFirst.mockResolvedValue({ leadId: "lead" });
    expect(await addTagToLead("lead", { id: "tag", name: "Start" })).toEqual({ added: true, started: 0 });
    expect(db.chainRun.create).not.toHaveBeenCalled();
  });

  it("startet beim Start-Tag, wenn der Abschluss-Tag fehlt", async () => {
    db.leadTag.createMany.mockResolvedValue({ count: 1 });
    db.activity.create.mockResolvedValue({});
    db.emailChain.findMany.mockResolvedValue([{ id: "chain", tenantId: "tenant", completionTagName: "Kette Ende" }]);
    db.leadTag.findFirst.mockResolvedValue(null);
    db.chainRun.create.mockResolvedValue({});
    expect(await addTagToLead("lead", { id: "tag", name: "Start" })).toEqual({ added: true, started: 1 });
    expect(db.chainRun.create).toHaveBeenCalledOnce();
  });

  it("vergibt keinen Abschluss-Tag bei abgemeldeten Kontakten", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    db.chainRun.findMany.mockResolvedValue([{ id: "run", nextRunAt: new Date() }]);
    db.chainRun.updateMany.mockResolvedValue({ count: 1 });
    db.chainRun.findUniqueOrThrow.mockResolvedValue({ id: "run", chain: { id: "chain", tenantId: "tenant", completionTagName: "Kette Ende", tenant: { slug: "demo" }, steps: [] }, lead: { id: "lead", emailOptOut: true } });
    db.chainRun.update.mockResolvedValue({});
    await processChains();
    expect(db.chainRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) }));
    expect(db.tag.upsert).not.toHaveBeenCalled();
  });

  it("markiert den erfolgreichen Durchlauf und vergibt den Abschluss-Tag atomar", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    db.chainRun.findMany.mockResolvedValue([{ id: "run", nextRunAt: new Date() }]);
    db.chainRun.updateMany.mockResolvedValue({ count: 1 });
    db.chainRun.findUniqueOrThrow.mockResolvedValue({ id: "run", currentStep: 0, chain: { id: "chain", name: "Kette", tenantId: "tenant", completionTagName: "Kette Ende", tenant: { slug: "demo" }, steps: [] }, lead: { id: "lead", emailOptOut: false } });
    db.emailChain.findUniqueOrThrow.mockResolvedValue({ tenantId: "tenant", completionTagName: "Kette Ende" });
    db.tag.upsert.mockResolvedValue({ id: "end-tag", name: "Kette Ende" });
    db.leadTag.createMany.mockResolvedValue({ count: 1 });
    db.activity.create.mockResolvedValue({});
    const result = await processChains();
    expect(result.finished).toBe(1);
    expect(db.chainRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DONE" }) }));
    expect(db.leadTag.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [{ leadId: "lead", tagId: "end-tag" }] }));
    expect(db.activity.create).toHaveBeenCalled();
  });

  it("bildet für gleichnamige Ketten unterschiedliche, begrenzte Abschluss-Tags", () => {
    expect(completionTagName("Beispiel", "1")).not.toBe(completionTagName("Beispiel", "2"));
    expect(Array.from(completionTagName("A".repeat(120), "x".repeat(36))).length).toBeLessThanOrEqual(80);
  });
});
