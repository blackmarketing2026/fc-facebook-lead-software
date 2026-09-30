import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/lib/cron";

const SECRET = "0123456789abcdef0123";
const url = "https://paula.function-concept.com/api/cron/mailbox";

describe("isAuthorizedCron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("akzeptiert Header und URL-Parameter", () => {
    process.env.CRON_SECRET = SECRET;
    expect(isAuthorizedCron(new Request(url, { headers: { authorization: `Bearer ${SECRET}` } }))).toBe(true);
    expect(isAuthorizedCron(new Request(`${url}?secret=${SECRET}`))).toBe(true);
  });

  it("lehnt falsche oder fehlende Secrets ab", () => {
    process.env.CRON_SECRET = SECRET;
    expect(isAuthorizedCron(new Request(url))).toBe(false);
    expect(isAuthorizedCron(new Request(`${url}?secret=falsch`))).toBe(false);
    expect(isAuthorizedCron(new Request(url, { headers: { authorization: "Bearer falsch" } }))).toBe(false);
  });

  it("ist ohne gesetztes CRON_SECRET gesperrt", () => {
    expect(isAuthorizedCron(new Request(`${url}?secret=`))).toBe(false);
  });
});
