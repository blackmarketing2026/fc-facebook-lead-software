import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Cron-Aufrufe müssen das CRON_SECRET mitschicken – entweder als Header
 * "Authorization: Bearer <CRON_SECRET>" (Vercel Cron, cron-job.org) oder als
 * Parameter "?secret=<CRON_SECRET>" (z. B. All-Inkl-Cronjobs, die keine Header setzen können).
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const param = new URL(request.url).searchParams.get("secret") ?? "";
  return safeEqual(header, `Bearer ${secret}`) || safeEqual(param, secret);
}
