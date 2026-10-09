import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  type Stored = { status: string; lead: { id: string } | null };
  return {
    folder: "INBOX",
    messages: {
      INBOX: new Map<number, string>(),
      Verarbeitet: new Map<number, string>(),
    },
    stored: new Map<string, Stored>(),
    deleted: [] as string[],
    process: vi.fn(),
    status: vi.fn(),
  };
});

vi.mock("imapflow", () => ({
  ImapFlow: class {
    capabilities = new Set(["UIDPLUS"]);
    async connect() {}
    async getMailboxLock(folder: "INBOX" | "Verarbeitet") {
      state.folder = folder;
      return { release() {} };
    }
    async search() {
      return [...state.messages[state.folder as "INBOX" | "Verarbeitet"].keys()];
    }
    async *fetch(uids: number[]) {
      const folder = state.messages[state.folder as "INBOX" | "Verarbeitet"];
      for (const uid of uids) yield { uid, source: Buffer.from(folder.get(uid)!) };
    }
    async messageDelete(uid: number) {
      const folder = state.messages[state.folder as "INBOX" | "Verarbeitet"];
      const id = folder.get(uid)!;
      const saved = state.stored.get(id);
      expect(saved?.status).toBe("PROCESSED");
      expect(saved?.lead).toBeTruthy();
      state.deleted.push(id);
      folder.delete(uid);
      return true;
    }
    async logout() {}
    close() {}
  },
}));

vi.mock("mailparser", () => ({
  simpleParser: async (source: Buffer) => ({ messageId: source.toString(), text: "[]", headers: { get: () => null } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    inboundEmail: { findUnique: async ({ where }: { where: { messageId: string } }) => state.stored.get(where.messageId) ?? null },
    setting: { upsert: state.status },
  },
}));

vi.mock("@/lib/lead-service", () => ({ processInboundMail: state.process }));

import { pollMailbox } from "@/lib/mailbox";

describe("Postfach-Abgleich", () => {
  beforeEach(() => {
    process.env.IMAP_HOST = "imap.example.com";
    process.env.IMAP_USER = "leads@example.com";
    process.env.IMAP_PASS = "test";
    state.messages.INBOX.clear();
    state.messages.Verarbeitet.clear();
    state.stored.clear();
    state.deleted.length = 0;
    state.process.mockReset();
    state.status.mockReset();
  });

  it("löscht nur Mails mit gespeichertem Lead und legt fehlende einmal an", async () => {
    state.messages.INBOX.set(1, "existing");
    state.messages.INBOX.set(2, "ignored");
    state.messages.INBOX.set(3, "new");
    state.messages.INBOX.set(4, "failed");
    state.messages.Verarbeitet.set(5, "old-folder");
    state.stored.set("existing", { status: "PROCESSED", lead: { id: "lead-1" } });
    state.stored.set("ignored", { status: "IGNORED", lead: null });
    state.stored.set("old-folder", { status: "PROCESSED", lead: { id: "lead-2" } });
    state.process.mockImplementation(async ({ messageId }: { messageId: string }) => {
      if (messageId === "failed") return { status: "FAILED", error: "db", inboundId: "failed" };
      state.stored.set(messageId, { status: "PROCESSED", lead: { id: "lead-3" } });
      return { status: "PROCESSED", leadId: "lead-3", assignedToId: null, inboundId: "new" };
    });

    const result = await pollMailbox(true);

    expect(result).toMatchObject({ ok: true, processed: 1, deleted: 3, remaining: 2 });
    expect(state.deleted).toEqual(["existing", "new", "old-folder"]);
    expect(state.process).toHaveBeenCalledTimes(2);
    expect(state.messages.INBOX.get(2)).toBe("ignored");
    expect(state.messages.INBOX.get(4)).toBe("failed");
  });
});
