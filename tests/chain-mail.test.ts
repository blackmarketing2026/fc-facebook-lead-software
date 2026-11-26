import { beforeEach, describe, expect, it } from "vitest";
import { buildChainMail } from "@/lib/chains";

describe("Kettenmail: Fußzeile", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "s".repeat(40);
    process.env.APP_URL = "https://example.com";
  });

  it("hängt Absenderdaten klein und den Abmelde-Link an", () => {
    const mail = buildChainMail({ subject: "Hi {{vorname}}", body: "Hallo {{vorname}}" }, { id: "l1", fullName: "Max Mustermann", email: "m@example.com" }, "function-concept");
    expect(mail.subject).toBe("Hi Max");
    for (const part of ["Function Concept", "c/o MDC Management#169", "Welserstraße 3", "87463 Dietmannsried", "support@function-concept.de"]) {
      expect(mail.text).toContain(part);
      expect(mail.html).toContain(part.replace("#", "#"));
    }
    expect(mail.html).toContain("font-size:11px");
    expect(mail.text).toContain("https://example.com/function-concept/api/unsubscribe?l=l1&t=");
    expect(mail.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
