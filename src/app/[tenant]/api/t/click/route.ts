import { decodeUrl, verifyTrack } from "@/lib/chain-logic";
import { db } from "@/lib/db";

/** Klick-Weiterleitung der Ketten-Mails: zählt den Klick und leitet zum Original-Link weiter (nur mit gültiger Signatur, kein offener Redirect). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sendId = params.get("s") ?? "";
  const target = decodeUrl(params.get("u") ?? "");
  const token = params.get("t") ?? "";
  if (!sendId || !target || !verifyTrack("click", sendId, target, token)) {
    return new Response("Link ungültig", { status: 400 });
  }
  const now = new Date();
  await db.chainSend.updateMany({ where: { id: sendId, clickedAt: null }, data: { clickedAt: now } }).catch(() => undefined);
  await db.chainSend.updateMany({ where: { id: sendId }, data: { clickCount: { increment: 1 } } }).catch(() => undefined);
  // Ein Klick zeigt auch, dass die Mail geöffnet wurde (falls Bilder blockiert sind).
  await db.chainSend.updateMany({ where: { id: sendId, openedAt: null }, data: { openedAt: now } }).catch(() => undefined);
  return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store" } });
}
