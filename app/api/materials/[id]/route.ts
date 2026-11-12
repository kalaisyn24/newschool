import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLessonAccess } from "@/lib/learning";
import { readUpload } from "@/lib/storage";

/** Protected download of lesson materials: only for users with access to the lesson. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/materials/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const material = await db.lessonMaterial.findUnique({ where: { id } });
  if (!material?.storageKey) return new Response("Not found", { status: 404 });
  const staff = user.role === "ADMIN" || user.role === "SUPPORT";
  if (!staff) {
    const access = await getLessonAccess(user.id, material.lessonId);
    if (!access.ok) return new Response("Forbidden", { status: 403 });
  }
  try {
    const file = await readUpload(material.storageKey);
    const ext = material.storageKey.split(".").pop();
    const filename = encodeURIComponent(`${material.title}.${ext}`);
    const inline = /^(application\/pdf|image\/)/.test(file.mimeType);
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
