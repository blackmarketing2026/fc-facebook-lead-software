import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";

describe("secret-box", () => {
  it("ver- und entschlüsselt ein Passwort", () => {
    process.env.SESSION_SECRET = "x".repeat(40);
    const enc = encryptSecret("geheim!123");
    expect(enc).not.toContain("geheim");
    expect(decryptSecret(enc)).toBe("geheim!123");
  });
  it("liefert null bei beschädigten Daten oder anderem Schlüssel", () => {
    process.env.SESSION_SECRET = "x".repeat(40);
    const enc = encryptSecret("abc");
    process.env.SESSION_SECRET = "y".repeat(40);
    expect(decryptSecret(enc)).toBeNull();
    expect(decryptSecret("kaputt")).toBeNull();
  });
});
