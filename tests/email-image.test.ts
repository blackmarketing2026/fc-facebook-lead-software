import { describe, expect, it } from "vitest";
import { emailImageType } from "@/lib/email-image";

describe("Bildtypen für E-Mails", () => {
  it("erkennt GIF und PNG anhand ihres Inhalts", () => {
    expect(emailImageType(Buffer.from("GIF89a"))).toBe("image/gif");
    expect(emailImageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(emailImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
});
