import { afterEach, describe, expect, it } from "vitest";
import { buildMasterLeadMail } from "@/lib/lead-notify-mail";

const tenant = { slug: "engel", name: "Engel" };
const lead = {
  id: "lead-123",
  fullName: "Max Mustermann",
  email: "max@example.com",
  phone: "+49 170 1234567",
  language: "Deutsch",
  receivedAt: new Date("2026-10-09T08:00:00Z"),
  assignedTo: "Paula",
  answers: [
    { questionKey: "phone_number", questionLabel: "Telefon", answers: ["+49 170 1234567"] },
    { questionKey: "anfrage", questionLabel: "Anfrage", answers: ["Privatrechtsschutz & Beratung"] },
  ],
};

describe("Master-Lead-E-Mail", () => {
  afterEach(() => { delete process.env.APP_URL; });

  it("zeigt Dashboard, Antworten und direkte Kontaktaktionen", () => {
    process.env.APP_URL = "https://paula.function-concept.com";
    const mail = buildMasterLeadMail(tenant, lead);

    expect(mail.subject).toContain("Engel: Max Mustermann");
    expect(mail.text).toContain("Anfrage: Privatrechtsschutz & Beratung");
    expect(mail.text).toContain("Zugewiesen an: Paula");
    expect(mail.text).toContain("Anrufen: tel:+491701234567");
    expect(mail.text).toContain("E-Mail: mailto:max@example.com");
    expect(mail.text).toContain("WhatsApp: https://wa.me/491701234567");
    expect(mail.text).toContain("https://paula.function-concept.com/function-concept/leads/lead-123");
    expect(mail.text.match(/Telefon:/g)).toHaveLength(1);
    expect(mail.html).toContain("Privatrechtsschutz &amp; Beratung");
  });

  it("zeigt ohne Kontaktdaten keine nutzlosen Aktionslinks und escaped Formulartext", () => {
    const mail = buildMasterLeadMail(tenant, {
      ...lead,
      email: null,
      phone: null,
      answers: [{ questionKey: "anfrage", questionLabel: "Anfrage", answers: ["<script>alert(1)</script>"] }],
    });

    expect(mail.html).not.toContain("href=\"tel:");
    expect(mail.html).not.toContain("href=\"mailto:");
    expect(mail.html).not.toContain("wa.me/");
    expect(mail.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
