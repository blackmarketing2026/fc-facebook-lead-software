import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: {
  lead: { findMany: vi.fn() }, tag: { findMany: vi.fn() },
  leadTag: { findMany: vi.fn(), deleteMany: vi.fn() }, activity: { createMany: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/session", () => ({ requireUser: vi.fn(async () => ({ id: "user", role: "SALES", tenantId: "tenant" })), requireAdmin: vi.fn() }));
vi.mock("@/lib/access", () => ({ getAccessibleLeadOr404: vi.fn(), leadScope: () => ({ tenantId: "tenant", assignedToId: "user" }) }));
vi.mock("@/lib/chains", () => ({ ensureTag: vi.fn(), addTagToLead: vi.fn(), cleanTagName: (name: string) => name.trim() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { removeContactTags } from "@/app/actions/contacts";

describe("Tags bei mehreren Kontakten entfernen", () => {
  beforeEach(() => { vi.clearAllMocks(); db.$transaction.mockImplementation(async (fn) => fn(db)); });

  it("entfernt nur vorhandene Zuordnungen und protokolliert jede Entfernung", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    db.tag.findMany.mockResolvedValue([{ id: "t", name: "Interessent" }]);
    db.leadTag.findMany.mockResolvedValue([{ leadId: "a", tagId: "t" }]);
    db.leadTag.deleteMany.mockResolvedValue({ count: 1 });
    db.activity.createMany.mockResolvedValue({});
    const result = await removeContactTags(["a", "b"], ["Interessent"]);
    expect(result.message).toContain("1 Tag-Zuordnung bei 1 Kontakt");
    expect(db.leadTag.deleteMany).toHaveBeenCalledWith({ where: { leadId: { in: ["a", "b"] }, tagId: { in: ["t"] }, lead: { tenantId: "tenant", assignedToId: "user" }, tag: { tenantId: "tenant" } } });
    expect(db.activity.createMany).toHaveBeenCalledWith({ data: [{ leadId: "a", userId: "user", type: "TAG_REMOVED", meta: { tag: "Interessent" } }] });
  });

  it("verweigert die gesamte Aktion, wenn ein Kontakt nicht zugänglich ist", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "a" }]);
    expect((await removeContactTags(["a", "fremd"], ["Interessent"])).error).toBe(true);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
