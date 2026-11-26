import { verifyTrack } from "@/lib/chain-logic";
import { db } from "@/lib/db";

// 1x1 transparentes GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Öffnungs-Pixel der Ketten-Mails: zählt die Öffnung (nur mit gültiger Signatur). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sendId = url.searchParams.get("s") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (sendId && verifyTrack("open", sendId, "", token)) {
    const now = new Date();
    await db.chainSend.updateMany({ where: { id: sendId, openedAt: null }, data: { openedAt: now } }).catch(() => undefined);
    await db.chainSend.updateMany({ where: { id: sendId }, data: { openCount: { increment: 1 } } }).catch(() => undefined);
  }
  return new Response(PIXEL, { headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0" } });
}
