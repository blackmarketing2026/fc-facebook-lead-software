import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const image = await db.emailImage.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.data), { headers: { "Content-Type": image.mimeType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
