import { timingSafeEqual } from "node:crypto";

/**
 * Cron-Aufrufe (Vercel Cron oder ein externer Dienst wie cron-job.org) müssen
 * "Authorization: Bearer <CRON_SECRET>" mitschicken. Vercel Cron macht das automatisch.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
