import { beforeEach, describe, expect, it } from "vitest";
import { parseBounce } from "@/lib/bounces";
import { decodeUrl, encodeUrl, rewriteLinks, trackToken, verifyTrack } from "@/lib/chain-logic";
import { buildChainMail } from "@/lib/chains";

const SEND_ID = "3f2b8c1e-5d4a-4e7b-9a10-0c6d2e8f1a77";

describe("Tracking-Links", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "s".repeat(40);
    process.env.APP_URL = "https://example.com";
  });

  it("signiert Öffnung und Klick und lehnt Fälschungen ab", () => {
    const t = trackToken("click", SEND_ID, "https://a.de/x");
    expect(verifyTrack("click", SEND_ID, "https://a.de/x", t)).toBe(true);
    expect(verifyTrack("click", SEND_ID, "https://evil.de/x", t)).toBe(false);
    expect(verifyTrack("open", SEND_ID, "https://a.de/x", t)).toBe(false);
    expect(verifyTrack("open", SEND_ID, "", trackToken("open", SEND_ID))).toBe(true);
  });

  it("kodiert URLs und erlaubt nur http(s)", () => {
    expect(decodeUrl(encodeUrl("https://a.de/p?x=1&y=2"))).toBe("https://a.de/p?x=1&y=2");
    expect(decodeUrl(encodeUrl("javascript:alert(1)"))).toBeNull();
  });

  it("schreibt Links um, außer ausgenommene", () => {
    const html = '<a href="https://a.de/x?a=1&amp;b=2">x</a> <a href="https://x.de/api/unsubscribe?l=1">u</a> <a href="mailto:a@b.de">m</a>';
    const out = rewriteLinks(html, (u) => `R(${u})`, (u) => u.includes("/api/unsubscribe"));
    expect(out).toContain('href="R(https://a.de/x?a=1&b=2)"');
    expect(out).toContain('href="https://x.de/api/unsubscribe?l=1"');
    expect(out).toContain('href="mailto:a@b.de"');
  });

  it("baut die Kettenmail mit Pixel, umgeleiteten Links und Zuordnungs-Header", () => {
    const step = { subject: "Hi", body: "Schau hier: https://function-concept.de/angebot" };
    const lead = { id: "l1", fullName: "Max Mustermann", email: "m@example.com" };
    const tracked = buildChainMail(step, lead, "function-concept", { sendId: SEND_ID, tracking: true });
    expect(tracked.html).toContain("/function-concept/api/t/click?s=" + SEND_ID);
    expect(tracked.html).toContain("/function-concept/api/t/open?s=" + SEND_ID);
    expect(tracked.html).toContain("/function-concept/api/unsubscribe?l=l1"); // Abmelden bleibt direkt
    expect(tracked.html).not.toContain("/api/t/click?s=" + SEND_ID + "&u=" + encodeUrl("https://example.com/function-concept/api/unsubscribe"));
    expect(tracked.headers["X-FC-Send"]).toBe(SEND_ID);
    expect(tracked.text).toContain("https://function-concept.de/angebot"); // Text-Teil bleibt unverändert

    const plain = buildChainMail(step, lead, "function-concept", { sendId: SEND_ID, tracking: false });
    expect(plain.html).not.toContain("/api/t/");
    expect(plain.html).toContain('href="https://function-concept.de/angebot"');
    expect(plain.headers["X-FC-Send"]).toBe(SEND_ID);
  });
});

describe("Rückläufer erkennen", () => {
  const dsn = (status: string) => `From: MAILER-DAEMON@mx.example.com
Subject: Undelivered Mail Returned to Sender
Content-Type: multipart/report; report-type=delivery-status; boundary="b"

--b
Content-Type: message/delivery-status

Final-Recipient: rfc822; nobody@example.com
Action: failed
Status: ${status}
Diagnostic-Code: smtp; 550 5.1.1 <nobody@example.com>: Recipient address rejected:
 User unknown

--b
Content-Type: text/rfc822-headers

X-FC-Send: ${SEND_ID}
Subject: Hi
`;

  it("erkennt einen endgültigen Bounce mit Grund", () => {
    const info = parseBounce({ from: "MAILER-DAEMON@mx.example.com", subject: "Undelivered Mail Returned to Sender", raw: dsn("5.1.1") });
    expect(info).toMatchObject({ kind: "BOUNCE", sendId: SEND_ID });
    expect(info?.reason).toContain("550 5.1.1");
    expect(info?.reason).toContain("User unknown");
  });

  it("ignoriert vorübergehende Fehler (4.x.x) und fremde Mails", () => {
    expect(parseBounce({ from: "MAILER-DAEMON@mx.example.com", subject: "Delivery Status Notification (Delay)", raw: dsn("4.2.2") })).toBeNull();
    expect(parseBounce({ from: "kunde@example.com", subject: "Neuer Lead", raw: `X-FC-Send: ${SEND_ID}` })).toBeNull();
    expect(parseBounce({ from: "MAILER-DAEMON@x.de", subject: "Undelivered", raw: "keine ID enthalten" })).toBeNull();
  });

  it("erkennt Spam-Beschwerden (Feedback-Report)", () => {
    const raw = `Content-Type: multipart/report; report-type=feedback-report\n\nX-FC-Send: ${SEND_ID}`;
    expect(parseBounce({ from: "abuse@isp.example", subject: "Complaint", raw })).toMatchObject({ kind: "COMPLAINT", sendId: SEND_ID });
  });
});
