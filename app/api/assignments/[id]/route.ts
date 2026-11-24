import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";

/** Protected download of a file attached to an assignment answer: its author, admins and support. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/assignments/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const sub = await db.assignmentSubmission.findUnique({
    where: { id },
    select: { userId: true, fileKey: true, fileName: true },
  });
  if (!sub?.fileKey) return new Response("Not found", { status: 404 });
  const staff = user.role === "ADMIN" || user.role === "SUPPORT";
  if (!staff && sub.userId !== user.id) return new Response("Forbidden", { status: 403 });
  try {
    const file = await readUpload(sub.fileKey);
    const ext = sub.fileKey.split(".").pop();
    const name = (sub.fileName || `Решение.${ext}`).replace(/[\/\\:*?"<>|]/g, " ");
    const inline = /^(application\/pdf|image\/)/.test(file.mimeType);
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
