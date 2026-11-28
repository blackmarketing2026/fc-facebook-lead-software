"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { emailImageType, MAX_EMAIL_IMAGE_BYTES } from "@/lib/email-image";

export async function uploadEmailImage(form: FormData): Promise<{ path?: string; error?: string }> {
  const user = await requireAdmin();
  const file = form.get("image");
  if (!(file instanceof File) || !file.size || file.size > MAX_EMAIL_IMAGE_BYTES) return { error: "Bitte ein Bild mit höchstens 3 MB auswählen." };
  const data = Buffer.from(await file.arrayBuffer());
  const mimeType = emailImageType(data);
  if (!mimeType) return { error: "Bitte ein GIF, PNG, JPEG oder WebP auswählen." };
  const image = await db.emailImage.create({ data: { tenantId: user.tenantId, mimeType, data }, select: { id: true } });
  return { path: `/api/email-images/${image.id}` };
}
