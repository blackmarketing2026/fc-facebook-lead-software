import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: { emailChainStep: { findFirst: vi.fn() }, chainSend: { findMany: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/session", () => ({ requireAdmin: vi.fn(async () => ({ tenantId: "tenant" })), requireUser: vi.fn() }));
vi.mock("@/lib/access", () => ({ getAccessibleLeadOr404: vi.fn() }));
vi.mock("@/lib/chains", () => ({ AUTO_TAG_KEY: "", TRACKING_KEY: "", addTagToLead: vi.fn(), buildChainMail: vi.fn(), cleanTagName: vi.fn(), ensureTag: vi.fn() }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured: vi.fn(), sendMail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { statisticContacts } from "@/app/actions/chains";

describe("Kontakte der E-Mail-Statistik", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sucht nur gesendete E-Mails mit Öffnung im eigenen Mandanten", async () => {
    db.emailChainStep.findFirst.mockResolvedValue({ id: "step" });
    db.chainSend.findMany.mockResolvedValue([{ run: { lead: { id: "lead", fullName: "Anna", email: "anna@example.com" } } }]);
    expect(await statisticContacts("step", "opened")).toEqual([{ id: "lead", name: "Anna", email: "anna@example.com" }]);
    expect(db.emailChainStep.findFirst).toHaveBeenCalledWith({ where: { id: "step", type: "EMAIL", chain: { tenantId: "tenant" } }, select: { id: true } });
    expect(db.chainSend.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "SENT", openedAt: { not: null }, chain: { tenantId: "tenant" } }) }));
  });

  it("gibt keine Kontakte für fremde Schritte zurück", async () => {
    db.emailChainStep.findFirst.mockResolvedValue(null);
    expect(await statisticContacts("foreign", "sent")).toEqual([]);
    expect(db.chainSend.findMany).not.toHaveBeenCalled();
  });
});
